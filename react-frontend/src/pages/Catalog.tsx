import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { articleActionsApi, catalogueApi, testTypesApi, type TestType, type TestTypeFormField } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PageBackNav from '../components/PageBackNav'
import Modal from '../components/Modal'
import ListTableToolbar from '../components/ListTableToolbar'
import { ListTableFootRow, ListTablePanelHeader } from '../components/ListTablePanel'
import { sumNumeric } from '../lib/listTableTotals'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import { formatMoney, MONEY_UNIT_LABEL } from '../lib/appLocale'

type ParamRow = { id?: number; name: string; unit: string; expected_type: string }
type ProductAssignment = { article_id: number; article_action_id: number | null; label: string }

const blankField = (): TestTypeFormField => ({ key: '', label: '', type: 'text', required: false, unit: '', options: [] })

function ProductActionSelect({ assignment, onChange }: { assignment: ProductAssignment; onChange: (id: number | null) => void }) {
  const { data: actions = [] } = useQuery({
    queryKey: ['article-actions', assignment.article_id],
    queryFn: () => articleActionsApi.list(assignment.article_id),
  })
  return <select value={assignment.article_action_id ?? ''} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
    <option value="">Toutes les actions du produit</option>
    {actions.map((action) => <option key={action.id} value={action.id}>{action.libelle} ({action.type})</option>)}
  </select>
}

function normalizeParamPayload(rows: ParamRow[]) {
  return rows
    .filter((p) => p.name.trim())
    .map((p) => ({
      ...(p.id != null ? { id: p.id } : {}),
      name: p.name.trim(),
      unit: p.unit || undefined,
      expected_type: p.expected_type || 'numeric',
    }))
}

export default function Catalog() {
  const { user } = useAuth()
  const canManageCatalog = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    name: '',
    norm: '',
    unit: '',
    unit_price: 0,
  })
  const [paramRows, setParamRows] = useState<ParamRow[]>([{ name: '', unit: '', expected_type: 'numeric' }])
  const [formFields, setFormFields] = useState<TestTypeFormField[]>([blankField()])
  const [assignments, setAssignments] = useState<ProductAssignment[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const { visible, toggle } = usePersistedColumnVisibility('catalog-test-types', {
    name: true,
    norm: true,
    unit: true,
    price: true,
    params: true,
    forms: true,
    actions: true,
  })

  const { data: types, isLoading, error } = useQuery({
    queryKey: ['test-types'],
    queryFn: () => testTypesApi.list(),
  })
  const { data: products = [] } = useQuery({
    queryKey: ['test-type-products', productSearch],
    queryFn: () => catalogueApi.articles({ kind: 'product', q: productSearch }),
    enabled: modal !== null && productSearch.trim().length >= 2,
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const created = await testTypesApi.create({
        name: form.name,
        norm: form.norm || undefined,
        unit: form.unit || undefined,
        unit_price: form.unit_price,
        params: normalizeParamPayload(paramRows),
        form_fields: formFields.filter((field) => field.key.trim() && field.label.trim()).map((field) => ({ ...field, key: field.key.trim(), label: field.label.trim() })),
      })
      if (assignments.length) await testTypesApi.syncProducts(created.id, assignments.map(({ article_id, article_action_id }) => ({ article_id, article_action_id })))
      return created
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-types'] })
      closeModal()
    },
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      await testTypesApi.update(editingId!, {
        name: form.name,
        norm: form.norm || undefined,
        unit: form.unit || undefined,
        unit_price: form.unit_price,
        params: normalizeParamPayload(paramRows),
        form_fields: formFields.filter((field) => field.key.trim() && field.label.trim()).map((field) => ({ ...field, key: field.key.trim(), label: field.label.trim() })),
      })
      return testTypesApi.syncProducts(editingId!, assignments.map(({ article_id, article_action_id }) => ({ article_id, article_action_id })))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-types'] })
      closeModal()
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => testTypesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test-types'] }),
    onError: (err: Error) => window.alert(err.message),
  })

  const list = Array.isArray(types) ? types : []
  const needle = debouncedSearch.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!needle) return list
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        (t.norm ?? '').toLowerCase().includes(needle) ||
        (t.unit ?? '').toLowerCase().includes(needle) ||
        (t.params?.some((p) => p.name.toLowerCase().includes(needle)) ?? false) ||
        (t.form_fields?.some((field) => field.label.toLowerCase().includes(needle)) ?? false) ||
        (t.articles?.some((article) => article.libelle.toLowerCase().includes(needle) || article.code.toLowerCase().includes(needle)) ?? false),
    )
  }, [list, needle])

  const priceTotal = useMemo(
    () => sumNumeric(filtered, (t) => t.unit_price),
    [filtered],
  )

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setForm({ name: '', norm: '', unit: '', unit_price: 0 })
    setParamRows([{ name: '', unit: '', expected_type: 'numeric' }])
    setFormFields([blankField()])
    setAssignments([])
    setProductSearch('')
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', norm: '', unit: '', unit_price: 0 })
    setParamRows([{ name: '', unit: '', expected_type: 'numeric' }])
    setFormFields([blankField()])
    setAssignments([])
    setModal('create')
  }

  const openEdit = (t: TestType) => {
    setEditingId(t.id)
    setForm({
      name: t.name,
      norm: t.norm ?? '',
      unit: t.unit ?? '',
      unit_price: Number(t.unit_price),
    })
    setParamRows(
      t.params && t.params.length > 0
        ? t.params.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit ?? '',
            expected_type: p.expected_type || 'numeric',
          }))
        : [{ name: '', unit: '', expected_type: 'numeric' }],
    )
    setFormFields(t.form_fields?.length ? t.form_fields : [blankField()])
    setAssignments((t.articles ?? []).map((article) => ({
      article_id: article.id,
      article_action_id: article.pivot?.article_action_id ?? null,
      label: `${article.code} — ${article.libelle}`,
    })))
    setModal('edit')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (modal === 'create') createMut.mutate()
    else if (modal === 'edit') updateMut.mutate()
  }

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur : {String(error)}</p>

  return (
    <div>
      <PageBackNav back={{ to: '/back-office', label: 'Back office' }} extras={[{ to: '/terrain', label: 'Terrain' }, { to: '/labo', label: 'Laboratoire' }]} />
      <p className="page-lead" style={{ color: '#64748b', marginBottom: '1rem', maxWidth: '42rem' }}>
        Types d&apos;essais, normes, formulaires de terrain/laboratoire/ingénierie et produits associés. Réservé au
        personnel laboratoire pour la mise à jour.
      </p>
      {canManageCatalog && (
        <button type="button" className="btn btn-primary" style={{ marginBottom: '1rem' }} onClick={openCreate}>
          Nouveau type d&apos;essai
        </button>
      )}
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Nom, norme, paramètre…"
        columns={[
          { id: 'name', label: 'Nom' },
          { id: 'norm', label: 'Norme' },
          { id: 'unit', label: 'Unité' },
          { id: 'price', label: 'Tarif' },
          { id: 'params', label: 'Paramètres' },
          { id: 'forms', label: 'Formulaire / produits' },
          ...(canManageCatalog ? [{ id: 'actions', label: 'Actions' }] : []),
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
      />
      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <ListTablePanelHeader title="Types d'essai" count={filtered.length} />
        <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              {visible.name !== false && <th>Nom</th>}
              {visible.norm !== false && <th>Norme</th>}
              {visible.unit !== false && <th>Unité</th>}
              {visible.price !== false && <th>Tarif unitaire ({MONEY_UNIT_LABEL})</th>}
              {visible.params !== false && <th>Paramètres</th>}
              {visible.forms !== false && <th>Formulaire / produits</th>}
              {canManageCatalog && visible.actions !== false && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                {visible.name !== false && <td>{t.name}</td>}
                {visible.norm !== false && <td>{t.norm ?? '-'}</td>}
                {visible.unit !== false && <td>{t.unit ?? '-'}</td>}
                {visible.price !== false && <td className="data-table__num">{formatMoney(Number(t.unit_price))}</td>}
                {visible.params !== false && <td>{t.params?.map((p) => p.name).join(', ') ?? '-'}</td>}
                {visible.forms !== false && <td>{t.form_fields?.length ?? 0} champ(s) · {t.articles?.length ?? 0} produit(s)</td>}
                {canManageCatalog && visible.actions !== false && (
                  <td>
                    <div className="crud-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-outline"
                        onClick={() => {
                          if (window.confirm(`Supprimer « ${t.name} » ?`)) deleteMut.mutate(t.id)
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <ListTableFootRow
            columns={[
              { id: 'name', kind: 'text' },
              { id: 'norm', kind: 'text' },
              { id: 'unit', kind: 'text' },
              { id: 'price', kind: 'money' },
              { id: 'params', kind: 'text' },
              { id: 'forms', kind: 'text' },
              ...(canManageCatalog ? [{ id: 'actions', kind: 'text' as const }] : []),
            ]}
            visible={{ ...visible, actions: canManageCatalog ? visible.actions : false }}
            totals={{ price: priceTotal }}
          />
        </table>
        </div>
        {filtered.length === 0 && (
          <p className="dossier-tab-empty">
            {list.length === 0
              ? 'Aucun type d’essai en base. Lancez le seed (données de démo) ou ajoutez-en un avec le bouton ci-dessus.'
              : 'Aucun résultat pour cette recherche.'}
          </p>
        )}
      </div>

      {modal && canManageCatalog && (
        <Modal
          title={modal === 'create' ? "Nouveau type d'essai" : "Modifier le type d'essai"}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nom *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Norme</label>
              <input value={form.norm} onChange={(e) => setForm((f) => ({ ...f, norm: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Unité</label>
              <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Tarif unitaire ({MONEY_UNIT_LABEL}) *</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.unit_price}
                onChange={(e) => setForm((f) => ({ ...f, unit_price: Number(e.target.value) }))}
                required
              />
            </div>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
              Paramètres mesurés (utilisés à la saisie des résultats sur les échantillons)
            </p>
            {paramRows.map((row, i) => (
              <div
                key={row.id ?? `new-${i}`}
                className="form-group"
                style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px auto', gap: '0.5rem', alignItems: 'end' }}
              >
                <div>
                  <label>Paramètre</label>
                  <input
                    value={row.name}
                    onChange={(e) =>
                      setParamRows((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                    }
                    placeholder="ex. Résistance"
                  />
                </div>
                <div>
                  <label>Unité</label>
                  <input
                    value={row.unit}
                    onChange={(e) =>
                      setParamRows((rows) => rows.map((r, j) => (j === i ? { ...r, unit: e.target.value } : r)))
                    }
                  />
                </div>
                <div>
                  <label>Type</label>
                  <select
                    value={row.expected_type}
                    onChange={(e) =>
                      setParamRows((rows) => rows.map((r, j) => (j === i ? { ...r, expected_type: e.target.value } : r)))
                    }
                  >
                    <option value="numeric">numérique</option>
                    <option value="text">texte</option>
                    <option value="date">date</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setParamRows((rows) => rows.filter((_, j) => j !== i))}
                  disabled={paramRows.length <= 1}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginBottom: '1rem' }}
              onClick={() => setParamRows((rows) => [...rows, { name: '', unit: '', expected_type: 'numeric' }])}
            >
              + Paramètre
            </button>
            <h3>Formulaire de la tâche</h3>
            <p className="text-muted">Les champs sont enregistrés avec la tâche lors de la première saisie. Leur modification ultérieure ne change pas un formulaire déjà commencé.</p>
            {formFields.map((field, i) => <div key={i} className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <label>Clé<input value={field.key} placeholder="ex. resistance" onChange={(e) => setFormFields((rows) => rows.map((row, j) => j === i ? { ...row, key: e.target.value } : row))} /></label>
              <label>Libellé<input value={field.label} placeholder="ex. Résistance mesurée" onChange={(e) => setFormFields((rows) => rows.map((row, j) => j === i ? { ...row, label: e.target.value } : row))} /></label>
              <label>Type<select value={field.type} onChange={(e) => setFormFields((rows) => rows.map((row, j) => j === i ? { ...row, type: e.target.value as TestTypeFormField['type'] } : row))}>
                <option value="number">Nombre</option><option value="text">Texte</option><option value="date">Date</option><option value="select">Choix</option><option value="boolean">Oui / non</option><option value="photo">Photo</option>
              </select></label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFormFields((rows) => rows.filter((_, j) => j !== i))}>×</button>
              <label>Unité<input value={field.unit ?? ''} onChange={(e) => setFormFields((rows) => rows.map((row, j) => j === i ? { ...row, unit: e.target.value } : row))} /></label>
              {field.type === 'select' ? <label>Choix (séparés par ;)<input value={(field.options ?? []).join('; ')} onChange={(e) => setFormFields((rows) => rows.map((row, j) => j === i ? { ...row, options: e.target.value.split(';').map((v) => v.trim()).filter(Boolean) } : row))} /></label> : null}
              <label><input type="checkbox" checked={field.required} onChange={(e) => setFormFields((rows) => rows.map((row, j) => j === i ? { ...row, required: e.target.checked } : row))} /> Obligatoire</label>
            </div>)}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFormFields((rows) => [...rows, blankField()])}>+ Champ</button>
            <h3>Produits et actions concernés</h3>
            <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Rechercher un produit (2 caractères minimum)" />
            {productSearch.length >= 2 ? <select value="" onChange={(e) => {
              const product = products.find((item) => item.id === Number(e.target.value))
              if (product && !assignments.some((a) => a.article_id === product.id)) setAssignments((rows) => [...rows, { article_id: product.id, article_action_id: null, label: `${product.code} — ${product.libelle}` }])
            }}><option value="">— Ajouter un produit —</option>{products.filter((item) => !assignments.some((a) => a.article_id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.libelle}</option>)}</select> : null}
            {assignments.map((assignment) => <div key={assignment.article_id} className="form-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span>{assignment.label}</span>
              <ProductActionSelect assignment={assignment} onChange={(article_action_id) => setAssignments((rows) => rows.map((row) => row.article_id === assignment.article_id ? { ...row, article_action_id } : row))} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAssignments((rows) => rows.filter((row) => row.article_id !== assignment.article_id))}>Retirer</button>
            </div>)}
            {(createMut.isError || updateMut.isError) && (
              <p className="error">{(createMut.error || updateMut.error)?.message}</p>
            )}
            <div className="crud-actions" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={createMut.isPending || updateMut.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
