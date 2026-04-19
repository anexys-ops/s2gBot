import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  accessGroupsApi,
  adminUsersApi,
  agenciesApi,
  clientsApi,
  sitesApi,
  type User,
} from '../../api/client'
import Modal from '../../components/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { canManageUsers } from '../../lib/settingsAccess'
import ListTableToolbar, { PaginationBar } from '../../components/ListTableToolbar'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

const ROLES: { value: string; label: string }[] = [
  { value: 'lab_admin', label: 'Administrateur laboratoire' },
  { value: 'lab_technician', label: 'Technicien laboratoire' },
  { value: 'client', label: 'Client' },
  { value: 'site_contact', label: 'Contact chantier' },
]

function emptyForm() {
  return {
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'lab_technician',
    client_id: '' as number | '',
    site_id: '' as number | '',
    access_group_ids: [] as number[],
    agency_ids: [] as number[],
  }
}

export default function SettingsUsersPage() {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState(emptyForm)

  const needsClient = form.role === 'client' || form.role === 'site_contact'
  const needsSite = form.role === 'site_contact'

  const allowed = canManageUsers(me)
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', debouncedSearch, page],
    queryFn: () => adminUsersApi.list({ search: debouncedSearch.trim() || undefined, page }),
    enabled: allowed,
  })
  const { data: groupsRes } = useQuery({
    queryKey: ['admin-access-groups'],
    queryFn: () => accessGroupsApi.list(),
    enabled: allowed,
  })
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'settings-users'],
    queryFn: () => clientsApi.list(),
    enabled: allowed && (modal === 'create' || modal === 'edit'),
  })
  const { data: sites = [] } = useQuery({
    queryKey: ['sites', 'settings-users'],
    queryFn: () => sitesApi.list(),
    enabled: allowed && (modal === 'create' || modal === 'edit'),
  })
  const agencyClientId = form.client_id === '' ? null : form.client_id
  const { data: agenciesForClient = [] } = useQuery({
    queryKey: ['agencies', 'settings-users', agencyClientId],
    queryFn: () => agenciesApi.listForClient(agencyClientId as number),
    enabled: allowed && (modal === 'create' || modal === 'edit') && needsClient && agencyClientId !== null,
  })

  const groups = groupsRes?.data ?? []

  const createMut = useMutation({
    mutationFn: () =>
      adminUsersApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
        role: form.role,
        client_id: form.client_id === '' ? undefined : form.client_id,
        site_id: form.site_id === '' ? undefined : form.site_id,
        access_group_ids: form.access_group_ids,
        ...(needsClient ? { agency_ids: form.agency_ids } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setModal(null)
      setForm(emptyForm())
    },
  })

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('missing')
      const body: Parameters<typeof adminUsersApi.update>[1] = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
        client_id: form.client_id === '' ? null : form.client_id,
        site_id: form.site_id === '' ? null : form.site_id,
        access_group_ids: form.access_group_ids,
        ...(needsClient ? { agency_ids: form.agency_ids } : {}),
      }
      if (form.password.trim()) body.password = form.password
      return adminUsersApi.update(editing.id, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setModal(null)
      setEditing(null)
      setForm(emptyForm())
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminUsersApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const openCreate = () => {
    setForm(emptyForm())
    setEditing(null)
    setModal('create')
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      phone: u.phone ?? '',
      role: u.role,
      client_id: u.client_id ?? '',
      site_id: u.site_id ?? '',
      access_group_ids: (u.access_groups ?? []).map((g) => g.id),
      agency_ids: (u.agencies ?? []).map((a) => a.id),
    })
    setModal('edit')
  }

  const sitesFiltered = useMemo(() => {
    if (form.client_id === '') return sites
    return sites.filter((s) => s.client_id === form.client_id)
  }, [sites, form.client_id])

  if (!allowed) {
    return <p className="error">Vous n’avez pas la permission de gérer les utilisateurs.</p>
  }

  const rows = data?.data ?? []
  const lastPage = data?.last_page ?? 1

  return (
    <div>
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v)
          setPage(1)
        }}
        searchPlaceholder="Nom, e-mail…"
        extra={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            + Utilisateur
          </button>
        }
      />
      {isLoading && <p>Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Groupes</th>
              <th>Agences</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{(u.access_groups ?? []).map((g) => g.name).join(', ') || '—'}</td>
                <td>{(u.agencies ?? []).map((a) => a.name).join(', ') || '—'}</td>
                <td>
                  <div className="crud-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-danger-outline"
                      disabled={u.id === me?.id}
                      onClick={() => {
                        if (window.confirm(`Supprimer ${u.email} ?`)) deleteMut.mutate(u.id)
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={data?.current_page ?? 1} lastPage={lastPage} onPage={setPage} />
      </div>

      {modal && (
        <Modal title={modal === 'create' ? 'Nouvel utilisateur' : `Modifier ${editing?.email}`} onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (modal === 'create') createMut.mutate()
              else updateMut.mutate()
            }}
          >
            <div className="form-group">
              <label>Nom</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>{modal === 'create' ? 'Mot de passe' : 'Nouveau mot de passe (laisser vide pour ne pas changer)'}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
                required={modal === 'create'}
              />
            </div>
            <div className="form-group">
              <label>Téléphone</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Rôle</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value,
                    client_id: '',
                    site_id: '',
                    agency_ids: [],
                  }))
                }
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {needsClient && (
              <div className="form-group">
                <label>Client</label>
                <select
                  value={form.client_id === '' ? '' : String(form.client_id)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      client_id: e.target.value === '' ? '' : Number(e.target.value),
                      site_id: '',
                      agency_ids: [],
                    }))
                  }
                  required
                >
                  <option value="">— Choisir —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {needsSite && (
              <div className="form-group">
                <label>Chantier</label>
                <select
                  value={form.site_id === '' ? '' : String(form.site_id)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, site_id: e.target.value === '' ? '' : Number(e.target.value) }))
                  }
                  required
                >
                  <option value="">— Choisir —</option>
                  {sitesFiltered.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {needsClient && form.client_id !== '' && (
              <div className="form-group">
                <label>Agences (périmètre)</label>
                <p className="text-muted" style={{ fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
                  Laissez vide pour accéder à toutes les agences du client. Cochez pour restreindre.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 160, overflow: 'auto' }}>
                  {agenciesForClient.map((a) => (
                    <label key={a.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={form.agency_ids.includes(a.id)}
                        onChange={() => {
                          setForm((f) => ({
                            ...f,
                            agency_ids: f.agency_ids.includes(a.id)
                              ? f.agency_ids.filter((x) => x !== a.id)
                              : [...f.agency_ids, a.id],
                          }))
                        }}
                      />
                      {a.name}
                      {a.is_headquarters ? ' (siège)' : ''}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="form-group">
              <label>Groupes (droits)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 180, overflow: 'auto' }}>
                {groups.map((g) => (
                  <label key={g.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={form.access_group_ids.includes(g.id)}
                      onChange={() => {
                        setForm((f) => ({
                          ...f,
                          access_group_ids: f.access_group_ids.includes(g.id)
                            ? f.access_group_ids.filter((x) => x !== g.id)
                            : [...f.access_group_ids, g.id],
                        }))
                      }}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
            {(createMut.isError || updateMut.isError) && (
              <p className="error">{((createMut.error || updateMut.error) as Error).message}</p>
            )}
            <div className="crud-actions">
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
    </div>
  )
}
