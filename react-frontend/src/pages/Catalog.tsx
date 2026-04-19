import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { testTypesApi, type TestType } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PageBackNav from '../components/PageBackNav'
import Modal from '../components/Modal'
import ListTableToolbar from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import { MONEY_UNIT_LABEL } from '../lib/appLocale'

type ParamRow = { id?: number; name: string; unit: string; expected_type: string }

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
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const { visible, toggle } = usePersistedColumnVisibility('catalog-test-types', {
    name: true,
    norm: true,
    unit: true,
    price: true,
    params: true,
    actions: true,
  })

  const { data: types, isLoading, error } = useQuery({
    queryKey: ['test-types'],
    queryFn: () => testTypesApi.list(),
  })

  const createMut = useMutation({
    mutationFn: () =>
      testTypesApi.create({
        name: form.name,
        norm: form.norm || undefined,
        unit: form.unit || undefined,
        unit_price: form.unit_price,
        params: normalizeParamPayload(paramRows),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-types'] })
      closeModal()
    },
  })

  const updateMut = useMutation({
    mutationFn: () =>
      testTypesApi.update(editingId!, {
        name: form.name,
        norm: form.norm || undefined,
        unit: form.unit || undefined,
        unit_price: form.unit_price,
        params: normalizeParamPayload(paramRows),
      }),
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
        (t.params?.some((p) => p.name.toLowerCase().includes(needle)) ?? false),
    )
  }, [list, needle])

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setForm({ name: '', norm: '', unit: '', unit_price: 0 })
    setParamRows([{ name: '', unit: '', expected_type: 'numeric' }])
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', norm: '', unit: '', unit_price: 0 })
    setParamRows([{ name: '', unit: '', expected_type: 'numeric' }])
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
        Types d&apos;essais, normes, tarifs unitaires et paramètres mesurés (saisie sur les dossiers). Réservé au
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
          ...(canManageCatalog ? [{ id: 'actions', label: 'Actions' }] : []),
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
      />
      <div className="card">
        <table>
          <thead>
            <tr>
              {visible.name !== false && <th>Nom</th>}
              {visible.norm !== false && <th>Norme</th>}
              {visible.unit !== false && <th>Unité</th>}
              {visible.price !== false && <th>Tarif unitaire ({MONEY_UNIT_LABEL})</th>}
              {visible.params !== false && <th>Paramètres</th>}
              {canManageCatalog && visible.actions !== false && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                {visible.name !== false && <td>{t.name}</td>}
                {visible.norm !== false && <td>{t.norm ?? '-'}</td>}
                {visible.unit !== false && <td>{t.unit ?? '-'}</td>}
                {visible.price !== false && <td>{Number(t.unit_price).toFixed(2)}</td>}
                {visible.params !== false && <td>{t.params?.map((p) => p.name).join(', ') ?? '-'}</td>}
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
        </table>
        {filtered.length === 0 && (
          <p style={{ padding: '1rem' }}>
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
