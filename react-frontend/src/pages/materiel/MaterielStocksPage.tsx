import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  commercialOfferingsApi,
  equipmentsApi,
  type CommercialOffering,
  type EquipmentRow,
} from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ConfirmDialog from '../../components/ConfirmDialog'
import ListTableToolbar, { PaginationBar } from '../../components/ListTableToolbar'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'
import { MATERIEL_HOME, MATERIEL_MODULE_TABS } from './materielModuleTabs'

type StockFilter = '' | 'available' | 'empty'
type ActiveFilter = '' | 'active' | 'inactive'

const STOCK_FILTER_OPTIONS = [
  { value: '', label: 'Tous les stocks' },
  { value: 'available', label: 'En stock (> 0)' },
  { value: 'empty', label: 'Rupture (0)' },
] as const

const ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'inactive', label: 'Inactifs' },
] as const

function emptyConsumableForm(): Partial<CommercialOffering> & { name: string; kind: 'product' } {
  return {
    code: '',
    name: '',
    description: '',
    kind: 'product',
    unit: 'u',
    purchase_price_ht: 0,
    sale_price_ht: 0,
    default_tva_rate: 20,
    stock_quantity: 0,
    track_stock: true,
    active: true,
    equipment_id: undefined,
  }
}

function toWholeNumber(value: number | string | null | undefined): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n))
}

function formatStockQty(value: number): string {
  return String(toWholeNumber(value))
}

function formatTvaRate(value: number): string {
  return `${toWholeNumber(value)} %`
}

function matchesStockFilter(row: CommercialOffering, filter: StockFilter): boolean {
  if (filter === 'available') return Number(row.stock_quantity) > 0
  if (filter === 'empty') return Number(row.stock_quantity) <= 0
  return true
}

function matchesActiveFilter(row: CommercialOffering, filter: ActiveFilter): boolean {
  if (filter === 'active') return row.active
  if (filter === 'inactive') return !row.active
  return true
}

export default function MaterielStocksPage() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [stockFilter, setStockFilter] = useState<StockFilter>('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<CommercialOffering | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CommercialOffering | null>(null)
  const [form, setForm] = useState(emptyConsumableForm())

  const { data, isLoading, error } = useQuery({
    queryKey: ['commercial-offerings', 'consommables', debouncedSearch, page],
    queryFn: () =>
      commercialOfferingsApi.list({
        search: debouncedSearch.trim() || undefined,
        kind: 'product',
        track_stock: true,
        per_page: 30,
        page,
      }),
    enabled: isLab,
    placeholderData: keepPreviousData,
  })

  const { data: equipmentList = [] } = useQuery({
    queryKey: ['equipments', 'consommables-form'],
    queryFn: () => equipmentsApi.list(),
    enabled: !!modal,
  })

  const equipmentSorted = useMemo(
    () => [...equipmentList].sort((a, b) => a.code.localeCompare(b.code, 'fr')),
    [equipmentList],
  )

  const rows = useMemo(() => {
    return (data?.data ?? [])
      .filter((row) => matchesStockFilter(row, stockFilter))
      .filter((row) => matchesActiveFilter(row, activeFilter))
  }, [activeFilter, data?.data, stockFilter])

  const lastPage = data?.last_page ?? 1
  const totalLoaded = data?.data?.length ?? 0
  const hasActiveFilters = search.trim() !== '' || stockFilter !== '' || activeFilter !== ''

  const createMut = useMutation({
    mutationFn: () =>
      commercialOfferingsApi.create({
        ...(form as Parameters<typeof commercialOfferingsApi.create>[0]),
        name: form.name!.trim(),
        kind: 'product',
        track_stock: true,
        stock_quantity: toWholeNumber(form.stock_quantity),
        default_tva_rate: toWholeNumber(form.default_tva_rate),
        equipment_id: form.equipment_id ?? null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['commercial-offerings'] })
      setModal(null)
      setForm(emptyConsumableForm())
    },
  })

  const updateMut = useMutation({
    mutationFn: () =>
      commercialOfferingsApi.update(editing!.id, {
        ...form,
        kind: 'product',
        track_stock: true,
        stock_quantity: toWholeNumber(form.stock_quantity),
        default_tva_rate: toWholeNumber(form.default_tva_rate),
        equipment_id: form.equipment_id ?? null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['commercial-offerings'] })
      setModal(null)
      setEditing(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => commercialOfferingsApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['commercial-offerings'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setForm(emptyConsumableForm())
    setModal('create')
  }

  function openEdit(row: CommercialOffering) {
    setEditing(row)
    setForm({
      code: row.code ?? '',
      name: row.name,
      description: row.description ?? '',
      kind: 'product',
      unit: row.unit ?? 'u',
      purchase_price_ht: row.purchase_price_ht,
      sale_price_ht: row.sale_price_ht,
      default_tva_rate: toWholeNumber(row.default_tva_rate),
      stock_quantity: toWholeNumber(row.stock_quantity),
      track_stock: true,
      active: row.active,
      equipment_id: row.equipment_id ?? undefined,
    })
    setModal('edit')
  }

  function resetFilters() {
    setSearch('')
    setStockFilter('')
    setActiveFilter('')
    setPage(1)
  }

  if (!isLab) {
    return <Navigate to="/" replace />
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Parc équipements', to: MATERIEL_HOME },
        { label: 'Stocks' },
      ]}
      moduleBarLabel="Matériel"
      title="Stocks — consommables"
      subtitle={
        <>
          {rows.length} consommable{rows.length !== 1 ? 's' : ''} affiché{rows.length !== 1 ? 's' : ''}
          {hasActiveFilters && totalLoaded !== rows.length ? (
            <span className="text-muted"> (sur {totalLoaded} sur cette page)</span>
          ) : null}
        </>
      }
      tabs={MATERIEL_MODULE_TABS}
      actions={
        isLab ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            + Consommable
          </button>
        ) : undefined
      }
    >
      <ListTableToolbar
        className="materiel-stocks-toolbar"
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        searchPlaceholder="Code, libellé, unité, description…"
        extra={
          <>
            <label className="list-table-toolbar__field list-table-toolbar__status">
              <span className="filter-label">Niveau de stock</span>
              <select
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value as StockFilter)
                  setPage(1)
                }}
              >
                {STOCK_FILTER_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="list-table-toolbar__field list-table-toolbar__status">
              <span className="filter-label">Statut</span>
              <select
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value as ActiveFilter)
                  setPage(1)
                }}
              >
                {ACTIVE_FILTER_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        }
        footer={
          hasActiveFilters ? (
            <>
              <span className="list-table-toolbar__footer-label">Filtres actifs</span>
              {search.trim() !== '' ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">Recherche : « {search.trim()} »</span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setSearch('')}
                    aria-label="Effacer la recherche"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {stockFilter ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">
                    {STOCK_FILTER_OPTIONS.find((o) => o.value === stockFilter)?.label}
                  </span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setStockFilter('')}
                    aria-label="Effacer le filtre stock"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {activeFilter ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">
                    {ACTIVE_FILTER_OPTIONS.find((o) => o.value === activeFilter)?.label}
                  </span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setActiveFilter('')}
                    aria-label="Effacer le filtre statut"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
                Tout effacer
              </button>
            </>
          ) : null
        }
      />

      {isLoading && !data && <p className="text-muted">Chargement des consommables…</p>}
      {error && <p className="error">{(error as Error).message}</p>}

      {!error && (data || isLoading) && (
        <div className="card dossier-tab-panel dossier-tab-panel--table materiel-stocks-table-card">
          <div className="dossier-tab-panel__header">
            <h2 className="ds-form-section__title">Les consommables</h2>
            <span className="badge">{rows.length}</span>
          </div>

          {rows.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Désignation</th>
                    <th>Unité</th>
                    <th>Stock</th>
                    <th>Prix achat HT</th>
                    <th>Prix vente HT</th>
                    <th>TVA</th>
                    <th>Matériel lié</th>
                    <th>Statut</th>
                    {isLab ? <th className="materiel-stocks-table__actions">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const qty = toWholeNumber(row.stock_quantity)
                    const stockVariant = qty <= 0 ? 'danger' : qty <= 5 ? 'warning' : 'success'
                    return (
                      <tr key={row.id}>
                        <td>
                          <code className="code-badge">{row.code?.trim() || '—'}</code>
                        </td>
                        <td>
                          <strong>{row.name}</strong>
                          {row.description?.trim() ? (
                            <div className="text-muted materiel-stocks-table__desc">{row.description}</div>
                          ) : null}
                        </td>
                        <td>{row.unit?.trim() || '—'}</td>
                        <td>
                          <StatusBadge variant={stockVariant} size="sm">
                            {formatStockQty(qty)}
                          </StatusBadge>
                        </td>
                        <td>{formatMoney(Number(row.purchase_price_ht))}</td>
                        <td>{formatMoney(Number(row.sale_price_ht))}</td>
                        <td>{formatTvaRate(row.default_tva_rate)}</td>
                        <td>
                          {row.equipment ? (
                            <Link to={`/materiel/equipements/${row.equipment.id}`} className="link-inline">
                              {row.equipment.code}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <StatusBadge variant={row.active ? 'success' : 'neutral'} size="sm">
                            {row.active ? 'Actif' : 'Inactif'}
                          </StatusBadge>
                        </td>
                        {isLab ? (
                          <td className="crud-actions materiel-stocks-table__actions">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEdit(row)}
                            >
                              Modifier
                            </button>
                            {isAdmin ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm btn-danger-outline"
                                onClick={() => setDeleteTarget(row)}
                              >
                                Supprimer
                              </button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dossier-tab-empty">Aucun consommable ne correspond aux filtres.</p>
          )}

          <PaginationBar page={page} lastPage={lastPage} onPage={setPage} />
        </div>
      )}

      {deleteTarget ? (
        <ConfirmDialog
          title="Supprimer le consommable"
          message={
            <>
              Supprimer définitivement{' '}
              <strong>{deleteTarget.code?.trim() || deleteTarget.name}</strong>
              {deleteTarget.code?.trim() ? <> — {deleteTarget.name}</> : null} ?
              <span className="text-muted" style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                Stock actuel : {formatStockQty(deleteTarget.stock_quantity)} {deleteTarget.unit ?? 'u'}
              </span>
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          error={deleteMut.isError ? (deleteMut.error as Error).message : null}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          onCancel={() => {
            if (!deleteMut.isPending) setDeleteTarget(null)
          }}
        />
      ) : null}

      {modal ? (
        <Modal
          title={modal === 'create' ? 'Nouveau consommable' : 'Modifier le consommable'}
          onClose={() => setModal(null)}
        >
          <div className="commercial-catalog-form materiel-stocks-form">
            <label>
              Code référence
              <input
                className="article-actions-form__input"
                value={form.code ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="Ex. CONS-001"
              />
            </label>
            <label>
              Désignation *
              <input
                className="article-actions-form__input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label>
              Unité *
              <input
                className="article-actions-form__input"
                value={form.unit ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="u, L, kg, ml…"
              />
            </label>
            <label>
              Quantité en stock *
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="article-actions-form__input"
                value={form.stock_quantity ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stock_quantity: toWholeNumber(e.target.value) }))
                }
              />
            </label>
            <label>
              Prix d&apos;achat HT ({MONEY_UNIT_LABEL})
              <input
                type="number"
                min={0}
                step={0.01}
                className="article-actions-form__input"
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
                className="article-actions-form__input"
                value={form.sale_price_ht ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, sale_price_ht: Number(e.target.value) }))}
              />
            </label>
            <label>
              TVA (%)
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                className="article-actions-form__input"
                value={form.default_tva_rate ?? 20}
                onChange={(e) =>
                  setForm((f) => ({ ...f, default_tva_rate: toWholeNumber(e.target.value) }))
                }
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Matériel lié (optionnel)
              <select
                className="article-actions-form__select"
                value={form.equipment_id ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    equipment_id: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
              >
                <option value="">— Aucun —</option>
                {equipmentSorted.map((eq: EquipmentRow) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.code} — {eq.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Description
              <textarea
                rows={3}
                value={form.description ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="materiel-stocks-form__checkbox">
              <input
                type="checkbox"
                checked={form.active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Actif (disponible à la consommation)
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
              {createMut.isPending || updateMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
              Annuler
            </button>
          </div>
        </Modal>
      ) : null}
    </ModuleEntityShell>
  )
}
