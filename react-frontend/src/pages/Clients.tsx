import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientsApi, type Client } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import ListTableToolbar from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import ClientMoroccoFormFields from '../components/clients/ClientMoroccoFormFields'
import ModuleEntityShell from '../components/module/ModuleEntityShell'

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
  const { visible, toggle } = usePersistedColumnVisibility('clients', {
    name: true,
    email: true,
    phone: true,
    city: true,
    ice: true,
    siret: false,
    commercial: true,
    actions: true,
  })

  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['clients', debouncedSearch],
    queryFn: () => clientsApi.list({ search: debouncedSearch.trim() || undefined }),
  })

  useEffect(() => {
    const st = location.state as { openCreate?: boolean } | null
    if (st?.openCreate && isAdmin) {
      setForm(emptyForm)
      setEditingId(null)
      setModal('create')
      navigate('.', { replace: true, state: {} })
    }
  }, [location.state, navigate, isAdmin])

  const createMut = useMutation({
    mutationFn: (body: Partial<Client>) => clientsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setModal(null)
      setForm(emptyForm)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Client> }) => clientsApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setModal(null)
      setEditingId(null)
      setForm(emptyForm)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => clientsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
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

  const rawList = Array.isArray(clients) ? clients : []

  const list = useMemo(() => {
    return rawList.filter((c) => {
      if (viewFilter === 'with_siret') return !!(c.siret && String(c.siret).trim())
      if (viewFilter === 'with_ice') return !!(c.ice && String(c.ice).trim())
      if (viewFilter === 'missing_email') return !c.email?.trim()
      if (viewFilter === 'missing_phone') return !c.phone?.trim()
      if (viewFilter === 'missing_ice') return !(c.ice && String(c.ice).trim())
      return true
    })
  }, [rawList, viewFilter])

  if (isLoading) {
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
      subtitle={`${list.length} fiche(s) affichée(s) sur ${rawList.length} chargée(s)`}
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
        onSearchChange={setSearchInput}
        searchPlaceholder="Nom, email, ICE, RC, ville…"
        columns={[
          { id: 'name', label: 'Nom' },
          { id: 'email', label: 'Email' },
          { id: 'phone', label: 'Téléphone / WhatsApp' },
          { id: 'city', label: 'Ville' },
          { id: 'ice', label: 'ICE' },
          { id: 'siret', label: 'SIRET / autre' },
          ...(isLab ? [{ id: 'commercial', label: 'Commerce (fiche)' }] : []),
          ...(isAdmin ? [{ id: 'actions', label: 'Actions' }] : []),
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
        extra={
          <label style={{ minWidth: 200, margin: 0 }}>
            <span className="filter-label">Vue (filtre liste)</span>
            <select value={viewFilter} onChange={(e) => setViewFilter(e.target.value as ViewFilter)}>
              {(Object.keys(VIEW_LABELS) as ViewFilter[]).map((k) => (
                <option key={k} value={k}>
                  {VIEW_LABELS[k]}
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
              {visible.email !== false && <th>Email</th>}
              {visible.phone !== false && <th>Téléphone / WhatsApp</th>}
              {visible.city !== false && <th>Ville</th>}
              {visible.ice !== false && <th>ICE</th>}
              {visible.siret !== false && <th>SIRET / autre</th>}
              {isLab && visible.commercial !== false && <th>Commerce</th>}
              {isAdmin && visible.actions !== false && <th>Actions</th>}
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
                {isLab && visible.commercial !== false && (
                  <td>
                    <Link className="btn btn-secondary btn-sm" to={`/clients/${c.id}/commerce`} onClick={(e) => e.stopPropagation()}>
                      Commerce
                    </Link>
                  </td>
                )}
                {isAdmin && visible.actions !== false && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="crud-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-outline"
                        onClick={() => {
                          if (window.confirm(`Supprimer le client « ${c.name} » ?`)) deleteMut.mutate(c.id)
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
        {!list.length && <p style={{ padding: '1rem' }}>Aucun client pour cette vue.</p>}
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
