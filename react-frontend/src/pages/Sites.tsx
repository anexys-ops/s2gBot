import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sitesApi, clientsApi, type Site } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import ListTableToolbar from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import ModuleEntityShell from '../components/module/ModuleEntityShell'
import { MONEY_UNIT_LABEL } from '../lib/appLocale'

const emptyForm: Partial<Site> = {
  client_id: 0,
  name: '',
  address: '',
  reference: '',
  travel_fee_quote_ht: 0,
  travel_fee_invoice_ht: 0,
  travel_fee_label: '',
}

export default function Sites() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState<Partial<Site>>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [clientFilter, setClientFilter] = useState<string>('')
  const { visible, toggle } = usePersistedColumnVisibility('sites', {
    name: true,
    client: true,
    reference: true,
    address: true,
    travelQuote: true,
    travelInvoice: true,
    actions: true,
  })

  const { data: sites, isLoading, error } = useQuery({
    queryKey: ['sites', debouncedSearch],
    queryFn: () => sitesApi.list({ search: debouncedSearch.trim() || undefined }),
  })

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
    enabled: isAdmin,
  })

  const clients = Array.isArray(clientsData) ? clientsData : []

  useEffect(() => {
    const st = location.state as { openCreate?: boolean } | null
    if (st?.openCreate && isAdmin) {
      setForm({ ...emptyForm, client_id: clients[0]?.id ?? 0 })
      setEditingId(null)
      setModal('create')
      navigate('.', { replace: true, state: {} })
    }
  }, [location.state, navigate, isAdmin, clients])

  const createMut = useMutation({
    mutationFn: (body: Partial<Site>) => sitesApi.create(body as { client_id: number; name: string }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setModal(null)
      setForm(emptyForm)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Site> }) => sitesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setModal(null)
      setEditingId(null)
      setForm(emptyForm)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => sitesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sites'] }),
  })

  const openCreate = () => {
    setForm({ ...emptyForm, client_id: clients[0]?.id ?? 0 })
    setEditingId(null)
    setModal('create')
  }

  const openEdit = (s: Site) => {
    setEditingId(s.id)
    setForm({
      client_id: s.client_id,
      name: s.name,
      address: s.address ?? '',
      reference: s.reference ?? '',
      travel_fee_quote_ht: Number(s.travel_fee_quote_ht ?? 0),
      travel_fee_invoice_ht: Number(s.travel_fee_invoice_ht ?? 0),
      travel_fee_label: s.travel_fee_label ?? '',
    })
    setModal('edit')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim() || !form.client_id) return
    if (modal === 'create') {
      createMut.mutate(form)
    } else if (modal === 'edit' && editingId) {
      updateMut.mutate({ id: editingId, body: form })
    }
  }

  const rawList = Array.isArray(sites) ? sites : []
  const list = useMemo(() => {
    if (!clientFilter) return rawList
    const cid = Number(clientFilter)
    if (!cid) return rawList
    return rawList.filter((s) => s.client_id === cid)
  }, [rawList, clientFilter])

  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'CRM', to: '/crm' },
          { label: 'Chantiers' },
        ]}
        moduleBarLabel="Projets — Chantiers"
        title="Chantiers / Sites"
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
          { label: 'CRM', to: '/crm' },
          { label: 'Chantiers' },
        ]}
        moduleBarLabel="Projets — Chantiers"
        title="Chantiers / Sites"
      >
        <p className="error">Erreur : {String(error)}</p>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'CRM', to: '/crm' },
        { label: 'Chantiers' },
      ]}
      moduleBarLabel="Projets — Chantiers"
      title="Chantiers / Sites"
      subtitle={`${list.length} ligne(s) affichée(s)`}
      actions={
        isAdmin ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            Nouveau chantier
          </button>
        ) : null
      }
    >
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Nom, référence, adresse…"
        columns={[
          { id: 'name', label: 'Nom' },
          { id: 'client', label: 'Client' },
          { id: 'reference', label: 'Référence' },
          { id: 'address', label: 'Adresse' },
          { id: 'travelQuote', label: 'Dépl. devis (HT)' },
          { id: 'travelInvoice', label: 'Dépl. facture (HT)' },
          ...(isAdmin ? [{ id: 'actions', label: 'Actions' }] : []),
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
        extra={
          <label style={{ minWidth: 220, margin: 0 }}>
            <span className="filter-label">Filtrer par client</span>
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="">Tous les clients</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              {visible.name !== false && <th>Nom</th>}
              {visible.client !== false && <th>Client</th>}
              {visible.reference !== false && <th>Référence</th>}
              {visible.address !== false && <th>Adresse</th>}
              {visible.travelQuote !== false && <th>Dépl. devis (HT)</th>}
              {visible.travelInvoice !== false && <th>Dépl. facture (HT)</th>}
              {isAdmin && visible.actions !== false && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr
                key={s.id}
                className="table-row-link"
                onClick={(e) => {
                  const t = e.target as HTMLElement
                  if (t.closest('a, button')) return
                  navigate(`/sites/${s.id}/fiche`)
                }}
              >
                {visible.name !== false && (
                  <td>
                    <Link to={`/sites/${s.id}/fiche`} onClick={(e) => e.stopPropagation()}>
                      {s.name}
                    </Link>
                  </td>
                )}
                {visible.client !== false && <td>{s.client?.name}</td>}
                {visible.reference !== false && <td>{s.reference ?? '-'}</td>}
                {visible.address !== false && <td>{s.address ?? '-'}</td>}
                {visible.travelQuote !== false && <td>{Number(s.travel_fee_quote_ht ?? 0).toFixed(2)}</td>}
                {visible.travelInvoice !== false && <td>{Number(s.travel_fee_invoice_ht ?? 0).toFixed(2)}</td>}
                {isAdmin && visible.actions !== false && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="crud-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-outline"
                        onClick={() => {
                          if (window.confirm(`Supprimer le chantier « ${s.name} » ?`)) deleteMut.mutate(s.id)
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
        {!list.length && <p style={{ padding: '1rem' }}>Aucun chantier pour cette vue.</p>}
      </div>

      {modal && isAdmin && (
        <Modal title={modal === 'create' ? 'Nouveau chantier' : 'Modifier le chantier'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Client *</label>
              <select
                value={form.client_id || ''}
                onChange={(e) => setForm((f) => ({ ...f, client_id: Number(e.target.value) }))}
                required
              >
                <option value="">Choisir…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Nom du chantier *</label>
              <input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Référence</label>
              <input value={form.reference ?? ''} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Adresse</label>
              <textarea value={form.address ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} />
            </div>
            <div className="form-group">
              <label>Libellé frais déplacement (facture / devis)</label>
              <input
                value={form.travel_fee_label ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, travel_fee_label: e.target.value }))}
                placeholder="ex. Déplacement équipe terrain"
              />
            </div>
            <div className="form-group">
              <label>Forfait déplacement estimé — devis ({MONEY_UNIT_LABEL} HT)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.travel_fee_quote_ht ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, travel_fee_quote_ht: Number(e.target.value) }))}
              />
            </div>
            <div className="form-group">
              <label>Forfait déplacement — facturation ({MONEY_UNIT_LABEL} HT)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.travel_fee_invoice_ht ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, travel_fee_invoice_ht: Number(e.target.value) }))}
              />
            </div>
            {(createMut.isError || updateMut.isError) && (
              <p className="error">{(createMut.error || updateMut.error)?.message}</p>
            )}
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
    </ModuleEntityShell>
  )
}
