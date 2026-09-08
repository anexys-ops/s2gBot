import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  accessGroupsApi,
  adminUsersApi,
  agenciesApi,
  agencesApi,
  clientsApi,
  sitesApi,
  type User,
} from '../../api/client'
import Modal from '../../components/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { canManageUsers } from '../../lib/settingsAccess'
import ListTableToolbar, { PaginationBar } from '../../components/ListTableToolbar'
import { ListTablePanelHeader } from '../../components/ListTablePanel'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { userPosteLabel, userRoleLabel, userRoleTone } from '../../lib/userRolePresentation'

const ROLES: { value: string; label: string }[] = [
  { value: 'lab_admin', label: 'Administrateur laboratoire' },
  { value: 'lab_technician', label: 'Technicien laboratoire' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'ingenieur', label: 'Ingénieur' },
  { value: 'laborantin', label: 'Laborantin' },
  { value: 'responsable', label: 'Responsable' },
  { value: 'receptionnaire', label: 'Réceptionnaire' },
  { value: 'client', label: 'Client' },
  { value: 'site_contact', label: 'Contact chantier' },
]

const POSTE_SUGGESTIONS = [
  'Responsable laboratoire',
  'Ingénieur géotechnique',
  'Technicien essais',
  'Commercial BTP',
  'Réceptionnaire',
  'Directeur d’agence',
] as const

type FormTab = 'identite' | 'rh' | 'acces' | 'securite'

function emptyForm(agencyId: number | '' = '') {
  return {
    name: '',
    email: '',
    password: '',
    phone: '',
    poste: '',
    role: 'lab_technician',
    client_id: '' as number | '',
    site_id: '' as number | '',
    access_group_ids: [] as number[],
    agency_ids: [] as number[],
    agency_id: agencyId,
  }
}

function UserRoleBadge({ role }: { role: string }) {
  const tone = userRoleTone(role)
  return (
    <span className={`user-role-badge user-role-badge--${tone}`}>
      {userRoleLabel(role)}
    </span>
  )
}

function UserFormTabs({
  tab,
  onTab,
}: {
  tab: FormTab
  onTab: (t: FormTab) => void
}) {
  const tabs: { id: FormTab; label: string }[] = [
    { id: 'identite', label: 'Identité' },
    { id: 'rh', label: 'RH' },
    { id: 'acces', label: 'Accès & périmètre' },
    { id: 'securite', label: 'Sécurité' },
  ]
  return (
    <nav className="user-admin-form__tabs" aria-label="Sections du formulaire utilisateur">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`user-admin-form__tab${tab === t.id ? ' user-admin-form__tab--active' : ''}`}
          onClick={() => onTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}

export default function SettingsUsersPage() {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const agencyFilterRaw = searchParams.get('agency')
  const agencyFilter = agencyFilterRaw && /^\d+$/.test(agencyFilterRaw) ? Number(agencyFilterRaw) : null

  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [formTab, setFormTab] = useState<FormTab>('identite')
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState(emptyForm())

  const needsClient = form.role === 'client' || form.role === 'site_contact'
  const needsSite = form.role === 'site_contact'
  const needsLabAgency = form.role !== 'client' && form.role !== 'site_contact'

  const allowed = canManageUsers(me)
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', debouncedSearch, page],
    queryFn: () => adminUsersApi.list({ search: debouncedSearch.trim() || undefined, page }),
    enabled: allowed,
    placeholderData: keepPreviousData,
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
  const { data: labAgences = [] } = useQuery({
    queryKey: ['agences', 'settings-users'],
    queryFn: () => agencesApi.list(),
    enabled: allowed,
  })
  const { data: labAgencesForm = [] } = useQuery({
    queryKey: ['agences', 'settings-users', 'form'],
    queryFn: () => agencesApi.list(),
    enabled: allowed && (modal === 'create' || modal === 'edit') && needsLabAgency,
  })

  const groups = groupsRes?.data ?? []
  const filteredAgency = useMemo(
    () => (agencyFilter !== null ? labAgences.find((a) => a.id === agencyFilter) : undefined),
    [agencyFilter, labAgences],
  )

  const createMut = useMutation({
    mutationFn: () =>
      adminUsersApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
        poste: form.poste.trim() || null,
        role: form.role,
        client_id: form.client_id === '' ? undefined : form.client_id,
        site_id: form.site_id === '' ? undefined : form.site_id,
        access_group_ids: form.access_group_ids,
        ...(needsClient ? { agency_ids: form.agency_ids } : {}),
        ...(needsLabAgency ? { agency_id: form.agency_id === '' ? null : form.agency_id } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setModal(null)
      setForm(emptyForm())
      setFormTab('identite')
    },
  })

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('missing')
      const body: Parameters<typeof adminUsersApi.update>[1] = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        poste: form.poste.trim() || null,
        role: form.role,
        client_id: form.client_id === '' ? null : form.client_id,
        site_id: form.site_id === '' ? null : form.site_id,
        access_group_ids: form.access_group_ids,
        ...(needsClient ? { agency_ids: form.agency_ids } : {}),
        ...(needsLabAgency ? { agency_id: form.agency_id === '' ? null : form.agency_id } : {}),
      }
      if (form.password.trim()) body.password = form.password
      return adminUsersApi.update(editing.id, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setModal(null)
      setEditing(null)
      setForm(emptyForm())
      setFormTab('identite')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminUsersApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const openCreate = () => {
    setForm(emptyForm(agencyFilter ?? ''))
    setEditing(null)
    setFormTab('identite')
    setModal('create')
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      phone: u.phone ?? '',
      poste: u.poste ?? '',
      role: u.role,
      client_id: u.client_id ?? '',
      site_id: u.site_id ?? '',
      access_group_ids: (u.access_groups ?? []).map((g) => g.id),
      agency_ids: (u.agencies ?? []).map((a) => a.id),
      agency_id: u.agency_id ?? '',
    })
    setFormTab('identite')
    setModal('edit')
  }

  const sitesFiltered = useMemo(() => {
    if (form.client_id === '') return sites
    return sites.filter((s) => s.client_id === form.client_id)
  }, [sites, form.client_id])

  const allRows = data?.data ?? []
  const rows = useMemo(() => {
    if (agencyFilter === null) return allRows
    return allRows.filter((u) => u.agency_id === agencyFilter)
  }, [allRows, agencyFilter])

  if (!allowed) {
    return <p className="error">Vous n’avez pas la permission de gérer les utilisateurs.</p>
  }

  const lastPage = data?.last_page ?? 1

  return (
    <div className="settings-users-page">
      {agencyFilter !== null && (
        <div className="user-admin-filter-banner">
          <span>
            Filtre agence : <strong>{filteredAgency?.name ?? `Agence #${agencyFilter}`}</strong>
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              searchParams.delete('agency')
              setSearchParams(searchParams, { replace: true })
            }}
          >
            Tous les utilisateurs
          </button>
        </div>
      )}

      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v)
          setPage(1)
        }}
        searchPlaceholder="Nom, e-mail, poste…"
        extra={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            + Utilisateur
          </button>
        }
      />
      {isLoading && !data && <p>Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <ListTablePanelHeader title="Utilisateurs de l’application" count={rows.length} />
        <div className="table-wrap">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Poste</th>
                <th>Rôle</th>
                <th>Agence labo</th>
                <th>Groupes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="settings-users-page__name">{u.name}</td>
                  <td>{u.email}</td>
                  <td>{userPosteLabel(u)}</td>
                  <td>
                    <UserRoleBadge role={u.role} />
                  </td>
                  <td>{u.agency?.name ?? (u.agency_id ? `#${u.agency_id}` : 'Siège')}</td>
                  <td>{(u.access_groups ?? []).map((g) => g.name).join(', ') || '—'}</td>
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
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="dossier-tab-empty">
                    {agencyFilter !== null ? 'Aucun utilisateur pour cette agence.' : 'Aucun utilisateur.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={data?.current_page ?? 1} lastPage={lastPage} onPage={setPage} />
      </div>

      {modal && (
        <Modal
          title={modal === 'create' ? 'Nouvel utilisateur' : `Modifier — ${editing?.name ?? editing?.email}`}
          onClose={() => setModal(null)}
        >
          <form
            className="user-admin-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (modal === 'create') createMut.mutate()
              else updateMut.mutate()
            }}
          >
            <div className="user-admin-form__header">
              <div className="user-admin-form__avatar" aria-hidden>
                {(form.name.trim()[0] ?? '?').toUpperCase()}
              </div>
              <div>
                <p className="user-admin-form__preview-name">{form.name.trim() || 'Nouvel utilisateur'}</p>
                <UserRoleBadge role={form.role} />
              </div>
            </div>

            <UserFormTabs tab={formTab} onTab={setFormTab} />

            {formTab === 'identite' && (
              <section className="ds-form-section user-admin-form__section">
                <h3 className="ds-form-section__title">Coordonnées</h3>
                <div className="quote-form-grid user-admin-form__grid">
                  <div className="form-group">
                    <label htmlFor="user-name">Nom complet *</label>
                    <input
                      id="user-name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="user-email">E-mail *</label>
                    <input
                      id="user-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="user-phone">Téléphone</label>
                    <input
                      id="user-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      autoComplete="tel"
                      placeholder="+212 …"
                    />
                  </div>
                </div>
              </section>
            )}

            {formTab === 'rh' && (
              <section className="ds-form-section user-admin-form__section user-admin-form__section--rh">
                <h3 className="ds-form-section__title">Informations RH</h3>
                <div className="quote-form-grid user-admin-form__grid">
                  <div className="form-group user-admin-form__grid-span-2">
                    <label htmlFor="user-poste">Intitulé de poste</label>
                    <input
                      id="user-poste"
                      value={form.poste}
                      onChange={(e) => setForm((f) => ({ ...f, poste: e.target.value }))}
                      placeholder="Ex. Ingénieur géotechnique — Casablanca"
                      list="user-poste-suggestions"
                    />
                    <datalist id="user-poste-suggestions">
                      {POSTE_SUGGESTIONS.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                    <p className="text-muted user-admin-form__hint">
                      Affiché dans les listes terrain et labo. Si vide, le libellé du rôle est utilisé.
                    </p>
                  </div>
                </div>
                <div className="user-admin-form__rh-card">
                  <p className="user-admin-form__rh-card-title">Aperçu fiche RH</p>
                  <dl className="user-admin-form__rh-dl">
                    <div>
                      <dt>Nom</dt>
                      <dd>{form.name.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt>Poste affiché</dt>
                      <dd>{form.poste.trim() || userRoleLabel(form.role)}</dd>
                    </div>
                    <div>
                      <dt>Contact</dt>
                      <dd>{form.phone.trim() || form.email.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt>Rôle système</dt>
                      <dd>
                        <UserRoleBadge role={form.role} />
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
            )}

            {formTab === 'acces' && (
              <section className="ds-form-section user-admin-form__section">
                <h3 className="ds-form-section__title">Rôle et périmètre</h3>
                <div className="quote-form-grid user-admin-form__grid">
                  <div className="form-group user-admin-form__grid-span-2">
                    <label htmlFor="user-role">Rôle applicatif *</label>
                    <select
                      id="user-role"
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
                </div>

                {needsLabAgency && (
                  <div className="user-admin-form__panel user-admin-form__panel--lab">
                    <p className="user-admin-form__panel-title">Agence labo S2G</p>
                    <p className="text-muted user-admin-form__hint">
                      Laissez vide pour le siège (accès global).{' '}
                      <Link to="/config/agences" className="link-inline">
                        Gérer les agences
                      </Link>
                    </p>
                    <div className="form-group">
                      <label htmlFor="user-lab-agency">Rattachement</label>
                      <select
                        id="user-lab-agency"
                        value={form.agency_id === '' ? '' : String(form.agency_id)}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            agency_id: e.target.value === '' ? '' : Number(e.target.value),
                          }))
                        }
                      >
                        <option value="">— Siège (toutes agences) —</option>
                        {labAgencesForm
                          .filter((a) => a.active !== false)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                              {a.code ? ` (${a.code})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}

                {needsClient && (
                  <div className="user-admin-form__panel user-admin-form__panel--client">
                    <p className="user-admin-form__panel-title">Portail client</p>
                    <div className="quote-form-grid user-admin-form__grid">
                      <div className="form-group">
                        <label htmlFor="user-client">Client *</label>
                        <select
                          id="user-client"
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
                      {needsSite && (
                        <div className="form-group">
                          <label htmlFor="user-site">Chantier *</label>
                          <select
                            id="user-site"
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
                    </div>
                    {form.client_id !== '' && (
                      <div className="form-group">
                        <label>Agences client (périmètre portail)</label>
                        <p className="text-muted user-admin-form__hint">
                          Laissez vide pour accéder à toutes les agences du client.
                        </p>
                        <div className="user-admin-form__checkbox-list">
                          {agenciesForClient.map((a) => (
                            <label key={a.id} className="user-admin-form__checkbox-row">
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
                              <span>
                                {a.name}
                                {a.is_headquarters ? ' (siège)' : ''}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="user-admin-form__panel user-admin-form__panel--groups">
                  <p className="user-admin-form__panel-title">Groupes &amp; droits</p>
                  <div className="user-admin-form__checkbox-list">
                    {groups.length === 0 && <p className="text-muted">Aucun groupe configuré.</p>}
                    {groups.map((g) => (
                      <label key={g.id} className="user-admin-form__checkbox-row">
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
                        <span>{g.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {formTab === 'securite' && (
              <section className="ds-form-section user-admin-form__section user-admin-form__section--security">
                <h3 className="ds-form-section__title">Mot de passe</h3>
                <div className="form-group">
                  <label htmlFor="user-password">
                    {modal === 'create' ? 'Mot de passe initial *' : 'Nouveau mot de passe'}
                  </label>
                  <input
                    id="user-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password"
                    required={modal === 'create'}
                    placeholder={modal === 'edit' ? 'Laisser vide pour ne pas modifier' : undefined}
                  />
                  {modal === 'edit' && (
                    <p className="text-muted user-admin-form__hint">
                      Ne renseignez ce champ que si vous souhaitez réinitialiser le mot de passe.
                    </p>
                  )}
                </div>
              </section>
            )}

            {(createMut.isError || updateMut.isError) && (
              <p className="error">{((createMut.error || updateMut.error) as Error).message}</p>
            )}
            <div className="crud-actions user-admin-form__actions">
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
