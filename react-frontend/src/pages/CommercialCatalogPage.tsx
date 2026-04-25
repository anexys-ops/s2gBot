import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commercialOfferingsApi, equipmentsApi, moduleSettingsApi, type CommercialOffering, type EquipmentRow } from '../api/client'
import Modal from '../components/Modal'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatMoney, MONEY_UNIT_LABEL } from '../lib/appLocale'

const KIND_LABEL: Record<string, string> = { product: 'Produit', service: 'Prestation' }

const emptyRow = (): Partial<CommercialOffering> & { name: string; kind: 'product' | 'service' } => ({
  code: '',
  name: '',
  description: '',
  kind: 'service',
  unit: '',
  purchase_price_ht: 0,
  sale_price_ht: 0,
  default_tva_rate: 20,
  stock_quantity: 0,
  track_stock: false,
  active: true,
  equipment_id: undefined,
})

export default function CommercialCatalogPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 300)
  const [page, setPage] = useState(1)
  const [kindFilter, setKindFilter] = useState(searchParams.get('kind') ?? '')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<CommercialOffering | null>(null)
  const [form, setForm] = useState(emptyRow())

  const { data, isLoading, error } = useQuery({
    queryKey: ['commercial-offerings', debounced, kindFilter, page],
    queryFn: () =>
      commercialOfferingsApi.list({
        search: debounced.trim() || undefined,
        kind: kindFilter || undefined,
        per_page: 30,
        page,
      }),
  })

  const { data: catalogMod } = useQuery({
    queryKey: ['module-settings', 'commercial_catalog'],
    queryFn: () => moduleSettingsApi.get('commercial_catalog'),
    retry: false,
  })

  const allowEquipmentLink =
    catalogMod?.settings == null
      ? true
      : (catalogMod.settings.link_equipment_to_products as boolean | undefined) !== false

  const { data: equipmentList = [] } = useQuery({
    queryKey: ['equipments', 'catalog-offering'],
    queryFn: () => equipmentsApi.list(),
    enabled: !!modal && allowEquipmentLink,
  })

  const equipmentSorted = useMemo(() => {
    return [...equipmentList].sort((a: EquipmentRow, b: EquipmentRow) =>
      `${a.code}`.localeCompare(b.code, 'fr', { sensitivity: 'base' }),
    )
  }, [equipmentList])

  const createMut = useMutation({
    mutationFn: () =>
      commercialOfferingsApi.create({
        ...(form as Parameters<typeof commercialOfferingsApi.create>[0]),
        name: form.name!,
        kind: form.kind!,
        equipment_id: form.equipment_id ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-offerings'] })
      setModal(null)
      setForm(emptyRow())
    },
  })

  const updateMut = useMutation({
    mutationFn: () => commercialOfferingsApi.update(editing!.id, { ...form, equipment_id: form.equipment_id ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-offerings'] })
      setModal(null)
      setEditing(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => commercialOfferingsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commercial-offerings'] }),
  })

  function openCreate() {
    setForm(emptyRow())
    setModal('create')
  }

  function openEdit(row: CommercialOffering) {
    setEditing(row)
    setForm({
      code: row.code ?? '',
      name: row.name,
      description: row.description ?? '',
      kind: row.kind,
      unit: row.unit ?? '',
      purchase_price_ht: row.purchase_price_ht,
      sale_price_ht: row.sale_price_ht,
      default_tva_rate: row.default_tva_rate,
      stock_quantity: row.stock_quantity,
      track_stock: row.track_stock,
      active: row.active,
      equipment_id: row.equipment_id ?? undefined,
    })
    setModal('edit')
  }

  const rows = data?.data ?? []
  const lastPage = data?.last_page ?? 1

  return (
    <div className="commercial-catalog-page">
      <div className="commercial-catalog-page__head">
        <h2 style={{ margin: 0 }}>Catalogue produits &amp; prestations</h2>
        <p className="text-muted" style={{ margin: '0.35rem 0 0', maxWidth: '52rem' }}>
          Référentiel pour les lignes de devis : prix d&apos;achat (référence interne), prix de vente HT, TVA par défaut,
          stock pour les produits, lien optionnel vers le <strong>matériel</strong> (inventaire) pour affichage sur les
          documents si la configuration l&apos;autorise. Les prestations peuvent avoir le suivi de stock désactivé.
        </p>
        <div className="commercial-catalog-page__toolbar">
          <input
            type="search"
            placeholder="Rechercher code, libellé…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <select
            value={kindFilter}
            onChange={(e) => {
              const next = e.target.value
              setKindFilter(next)
              setPage(1)
              setSearchParams(next ? { kind: next } : {})
            }}
            aria-label="Filtrer par type"
          >
            <option value="">Tous les types</option>
            <option value="service">Services</option>
            <option value="product">Produits</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Nouvelle référence
          </button>
        </div>
      </div>

      {isLoading && <p>Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}

      <div className="card" style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <table className="commercial-catalog-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Libellé</th>
              <th>Type</th>
              <th>Unité</th>
              <th>PA HT ({MONEY_UNIT_LABEL})</th>
              <th>PV HT ({MONEY_UNIT_LABEL})</th>
              <th>TVA %</th>
              <th>Matériel</th>
              <th>Stock</th>
              <th>Actif</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.code ?? '—'}</td>
                <td>
                  <strong>{r.name}</strong>
                  {r.description && <div className="text-muted" style={{ fontSize: '0.8rem' }}>{r.description}</div>}
                </td>
                <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                <td>{r.unit ?? '—'}</td>
                <td>{formatMoney(Number(r.purchase_price_ht))}</td>
                <td>{formatMoney(Number(r.sale_price_ht))}</td>
                <td>{Number(r.default_tva_rate).toFixed(2)}</td>
                <td className="text-muted" style={{ fontSize: '0.85rem', maxWidth: 200 }}>
                  {r.equipment ? (
                    <>
                      {r.equipment.name}
                      {r.equipment.numero_inventaire ? ` · ${r.equipment.numero_inventaire}` : ''}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {r.track_stock ? Number(r.stock_quantity).toFixed(r.stock_quantity % 1 ? 3 : 0) : '—'}
                </td>
                <td>{r.active ? 'Oui' : 'Non'}</td>
                <td className="crud-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-danger-outline"
                    onClick={() => {
                      if (window.confirm(`Supprimer « ${r.name} » ?`)) deleteMut.mutate(r.id)
                    }}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !isLoading && <p style={{ padding: '1rem' }}>Aucune référence. Créez-en une ou lancez le seeder.</p>}
        <div style={{ padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Précédent
          </button>
          <span style={{ alignSelf: 'center', fontSize: '0.9rem' }}>
            Page {page} / {lastPage}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
      </div>

      {modal && (
        <Modal title={modal === 'create' ? 'Nouvelle référence' : 'Modifier'} onClose={() => setModal(null)}>
          <div className="commercial-catalog-form">
            <label>
              Code interne
              <input value={form.code ?? ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </label>
            <label>
              Libellé *
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </label>
            <label>
              Type *
              <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as 'product' | 'service' }))}>
                <option value="service">Prestation / service</option>
                <option value="product">Produit / consommable</option>
              </select>
            </label>
            <label>
              Unité (u, ml, h, forfait…)
              <input value={form.unit ?? ''} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </label>
            <label>
              Prix d&apos;achat HT (réf., {MONEY_UNIT_LABEL})
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.purchase_price_ht ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, purchase_price_ht: Number(e.target.value) }))}
              />
            </label>
            <label>
              Prix de vente HT ({MONEY_UNIT_LABEL})
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.sale_price_ht ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, sale_price_ht: Number(e.target.value) }))}
              />
            </label>
            <label>
              TVA par défaut (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={form.default_tva_rate ?? 20}
                onChange={(e) => setForm((f) => ({ ...f, default_tva_rate: Number(e.target.value) }))}
              />
            </label>
            {allowEquipmentLink && (
              <label style={{ gridColumn: '1 / -1' }}>
                Matériel (inventaire) — optionnel
                <select
                  value={form.equipment_id ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      equipment_id: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                >
                  <option value="">— Aucun —</option>
                  {equipmentSorted.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.code} — {eq.name}
                      {eq.numero_inventaire ? ` (Inv. ${eq.numero_inventaire})` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-muted" style={{ display: 'block', fontSize: '0.78rem', marginTop: 4 }}>
                  Sera mentionné sur le PDF devis (onglet configuration &gt; catalogue) si l&apos;option est activée.
                </span>
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={form.track_stock ?? false}
                onChange={(e) => setForm((f) => ({ ...f, track_stock: e.target.checked }))}
              />
              Suivre le stock
            </label>
            {(form.track_stock ?? false) && (
              <label>
                Quantité en stock
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={form.stock_quantity ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, stock_quantity: Number(e.target.value) }))}
                />
              </label>
            )}
            <label>
              Description
              <textarea
                rows={3}
                value={form.description ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={form.active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Actif (proposé dans les devis)
            </label>
          </div>
          {(createMut.isError || updateMut.isError) && (
            <p className="error">{((createMut.error ?? updateMut.error) as Error).message}</p>
          )}
          <div className="crud-actions" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!form.name?.trim() || createMut.isPending || updateMut.isPending}
              onClick={() => (modal === 'create' ? createMut.mutate() : updateMut.mutate())}
            >
              Enregistrer
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
              Annuler
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
