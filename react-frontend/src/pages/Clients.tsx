import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { clientsApi, type Client } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import ClientMoroccoFormFields from '../components/clients/ClientMoroccoFormFields'
import ModuleEntityShell from '../components/module/ModuleEntityShell'
import Toast, { toastErrorMessage, type ToastVariant } from '../components/Toast'
import TableRowActions from '../components/TableRowActions'
import ConfirmDialog from '../components/ConfirmDialog'

function parseCapital(v: Client['capital_social']): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const emptyForm: Partial<Client> = {
  name: '',
  address: '',
  city: '',
  postal_code: '',
  email: '',
  phone: '',
  whatsapp: '',
  siret: '',
  ice: '',
  rc: '',
  patente: '',
  if_number: '',
  legal_form: '',
  cnss_employer: '',
  capital_social: undefined,
}

type ViewFilter = 'all' | 'with_siret' | 'with_ice' | 'missing_email' | 'missing_phone' | 'missing_ice'

const VIEW_LABELS: Record<ViewFilter, string> = {
  all: 'Tous les tiers',
  with_siret: 'SIRET renseigné',
  with_ice: 'ICE renseigné',
  missing_email: 'Sans email',
  missing_phone: 'Sans téléphone',
  missing_ice: 'Sans ICE',
}

export default function Clients() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState<Partial<Client>>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [page, setPage] = useState(1)
  const perPage = 20
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
  const { visible, toggle } = usePersistedColumnVisibility('clients', {
    name: true,
    email: true,
    phone: true,
    city: true,
    ice: true,
    siret: false,
    created: false,
    commercial: true,
    actions: true,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['clients', 'paginated', debouncedSearch, viewFilter, page, perPage],
    queryFn: () =>
      clientsApi.listPaginated({
        search: debouncedSearch.trim() || undefined,
        view: viewFilter,
        page,
        per_page: perPage,
      }),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, viewFilter])

  useEffect(() => {
    const st = location.state as { openCreate?: boolean } | null
    if (st?.openCreate && isAdmin) {
      setForm(emptyForm)
      setEditingId(null)
      setModal('create')
      navigate('.', { replace: true, state: {} })
    }
  }, [location.state, navigate, isAdmin])

  const showToast = (message: string, variant: ToastVariant) => {
    setToast({ message, variant })
  }

  const createMut = useMutation({
    mutationFn: (body: Partial<Client>) => clientsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setModal(null)
      setForm(emptyForm)
      showToast('Client créé avec succès.', 'success')
    },
    onError: (err) => {
      showToast(toastErrorMessage(err, 'Échec de la création du client.'), 'error')
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Client> }) => clientsApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setModal(null)
      setEditingId(null)
      setForm(emptyForm)
      showToast('Client mis à jour avec succès.', 'success')
    },
    onError: (err) => {
      showToast(toastErrorMessage(err, 'Échec de la mise à jour du client.'), 'error')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setClientToDelete(null)
    },
  })

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setModal('create')
  }

  const openEdit = (c: Client) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      address: c.address ?? '',
      city: c.city ?? '',
      postal_code: c.postal_code ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      whatsapp: c.whatsapp ?? '',
      siret: c.siret ?? '',
      ice: c.ice ?? '',
      rc: c.rc ?? '',
      patente: c.patente ?? '',
      if_number: c.if_number ?? '',
      legal_form: c.legal_form ?? '',
      cnss_employer: c.cnss_employer ?? '',
      capital_social: parseCapital(c.capital_social),
    })
    setModal('edit')
  }

  const normalizeBody = (f: Partial<Client>): Partial<Client> => {
    const cap = f.capital_social
    const capital_social =
      cap === undefined || cap === null || cap === ('' as unknown) || Number.isNaN(Number(cap))
        ? null
        : Number(cap)
    return { ...f, capital_social } as Partial<Client>
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim()) return
    const body = normalizeBody(form)
    if (modal === 'create') {
      createMut.mutate(body)
    } else if (modal === 'edit' && editingId) {
      updateMut.mutate({ id: editingId, body })
    }
  }

  const list = data?.data ?? []
  const total = data?.total ?? 0
  const lastPage = data?.last_page ?? 1
  const currentPage = data?.current_page ?? page

  const hasActiveFilters = debouncedSearch.trim() !== '' || viewFilter !== 'all'

  const clearAllFilters = () => {
    setSearchInput('')
    setViewFilter('all')
    setPage(1)
  }

  if (isLoading && !data) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Commercial', to: '/crm' },
          { label: 'Clients' },
        ]}
        moduleBarLabel="Tiers — Clients"
        title="Clients"
        subtitle="Liste des sociétés"
      >
        <p>Chargement…</p>
      </ModuleEntityShell>
    )
  }

  if (error) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Commercial', to: '/crm' },
          { label: 'Clients' },
        ]}
        moduleBarLabel="Tiers — Clients"
        title="Clients"
      >
        <p className="error">Erreur : {String(error)}</p>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Commercial', to: '/crm' },
        { label: 'Clients' },
      ]}
      moduleBarLabel="Tiers — Clients"
      title="Clients"
      subtitle={
        total > 0
          ? `${total} client(s) — page ${currentPage} / ${lastPage}`
          : 'Aucun client pour cette vue'
      }
      actions={
        <>
          {isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
              Nouveau client
            </button>
          )}
        </>
      }
    >
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v)
          setPage(1)
        }}
        searchPlaceholder="Nom, email, ICE, RC, ville…"
        columns={[
          { id: 'name', label: 'Nom' },
          { id: 'email', label: 'Email' },
          { id: 'phone', label: 'Téléphone / WhatsApp' },
          { id: 'city', label: 'Ville' },
          { id: 'ice', label: 'ICE' },
          { id: 'siret', label: 'SIRET / autre' },
          { id: 'created', label: 'Date de création' },
          ...(isLab ? [{ id: 'commercial', label: 'Commerce (fiche)' }] : []),
          ...(isAdmin ? [{ id: 'actions', label: 'Actions' }] : []),
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
        extra={
          <label>
            <span className="filter-label">Vue (filtre liste)</span>
            <select
              value={viewFilter}
              onChange={(e) => {
                setViewFilter(e.target.value as ViewFilter)
                setPage(1)
              }}
            >
              {(Object.keys(VIEW_LABELS) as ViewFilter[]).map((k) => (
                <option key={k} value={k}>
                  {VIEW_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        }
        footer={
          hasActiveFilters ? (
            <>
              <span className="list-table-toolbar__footer-label">Filtres actifs</span>
              {debouncedSearch.trim() !== '' && (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">Recherche : « {debouncedSearch.trim()} »</span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => {
                      setSearchInput('')
                      setPage(1)
                    }}
                    aria-label="Retirer la recherche"
                  >
                    ×
                  </button>
                </span>
              )}
              {viewFilter !== 'all' && (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">{VIEW_LABELS[viewFilter]}</span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => {
                      setViewFilter('all')
                      setPage(1)
                    }}
                    aria-label="Retirer le filtre vue"
                  >
                    ×
                  </button>
                </span>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllFilters}>
                Tout effacer
              </button>
            </>
          ) : undefined
        }
      />
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="data-table data-table--compact">
            <thead>
            <tr>
              {visible.name !== false && <th>Nom</th>}
              {visible.email !== false && <th>Email</th>}
              {visible.phone !== false && <th>Téléphone / WhatsApp</th>}
              {visible.city !== false && <th>Ville</th>}
              {visible.ice !== false && <th>ICE</th>}
              {visible.siret !== false && <th>SIRET / autre</th>}
              {visible.created !== false && <th>Création</th>}
              {isLab && visible.commercial !== false && <th>Commerce</th>}
              {isAdmin && visible.actions !== false && <th className="data-table__actions">Actions</th>}
            </tr>
            </thead>
          <tbody>
            {list.map((c) => (
              <tr
                key={c.id}
                className="table-row-link"
                onClick={(e) => {
                  const t = e.target as HTMLElement
                  if (t.closest('a, button')) return
                  navigate(`/clients/${c.id}/fiche`)
                }}
              >
                {visible.name !== false && (
                  <td>
                    <Link to={`/clients/${c.id}/fiche`} onClick={(e) => e.stopPropagation()}>
                      {c.name}
                    </Link>
                  </td>
                )}
                {visible.email !== false && <td>{c.email ?? '-'}</td>}
                {visible.phone !== false && (
                  <td>
                    <div>{c.phone?.trim() ? c.phone : '—'}</div>
                    {c.whatsapp?.trim() && (
                      <div style={{ fontSize: '0.85em', opacity: 0.9 }} title="WhatsApp">
                        WA {c.whatsapp}
                      </div>
                    )}
                  </td>
                )}
                {visible.city !== false && <td>{c.city?.trim() ? c.city : '—'}</td>}
                {visible.ice !== false && <td>{c.ice?.trim() ? c.ice : '—'}</td>}
                {visible.siret !== false && <td>{c.siret?.trim() ? c.siret : '—'}</td>}
                {visible.created !== false && (
                  <td>{c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                )}
                {isLab && visible.commercial !== false && (
                  <td>
                    <Link className="btn btn-secondary btn-sm" to={`/clients/${c.id}/commerce`} onClick={(e) => e.stopPropagation()}>
                      Commerce
                    </Link>
                  </td>
                )}
                {isAdmin && visible.actions !== false && (
                  <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                    <TableRowActions
                      editLabel="Modifier le client"
                      deleteLabel="Supprimer définitivement le client"
                      onEdit={() => openEdit(c)}
                      onDelete={() => setClientToDelete(c)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
        {!list.length && <p style={{ padding: '1rem' }}>Aucun client pour cette vue.</p>}
        <PaginationBar page={currentPage} lastPage={lastPage} onPage={setPage} />
      </div>

      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau client' : 'Modifier le client'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nom *</label>
              <input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Adresse (rue, quartier…)</label>
              <input value={form.address ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <ClientMoroccoFormFields form={form} setForm={setForm} />
            <div className="crud-actions" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={createMut.isPending || updateMut.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
      {toast && (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      )}
      {clientToDelete && (
        <ConfirmDialog
          title="Supprimer le client"
          message={
            <>
              Supprimer définitivement le client <strong>« {clientToDelete.name} »</strong> ?
              <br />
              Cette action est irréversible.
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          error={deleteMut.isError ? (deleteMut.error as Error).message : null}
          onConfirm={() => deleteMut.mutate(clientToDelete.id)}
          onCancel={() => {
            if (!deleteMut.isPending) setClientToDelete(null)
          }}
        />
      )}
    </ModuleEntityShell>
  )
}
