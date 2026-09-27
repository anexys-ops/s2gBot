import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accessGroupsApi, permissionsCatalogApi, type AccessGroupRow } from '../../api/client'
import Modal from '../../components/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { canManageGroups } from '../../lib/settingsAccess'
import { ListTablePanelHeader } from '../../components/ListTablePanel'

export default function SettingsGroupsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const allowed = canManageGroups(user)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<AccessGroupRow | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [perms, setPerms] = useState<string[]>([])

  const { data: cat } = useQuery({
    queryKey: ['permissions-catalog'],
    queryFn: () => permissionsCatalogApi.get(),
    enabled: allowed,
  })
  const permSections = useMemo(() => {
    const labels = cat?.permissions ?? {}
    const grouped = cat?.groups
    if (grouped && Object.keys(grouped).length > 0) {
      return Object.entries(grouped).map(([title, keys]) => ({
        title,
        entries: keys.map((key) => [key, labels[key] ?? key] as const),
      }))
    }
    return [{ title: 'Droits', entries: Object.entries(labels) }]
  }, [cat])

  const { data: groupsRes, isLoading } = useQuery({
    queryKey: ['admin-access-groups'],
    queryFn: () => accessGroupsApi.list(),
    enabled: allowed,
  })
  const groups = groupsRes?.data ?? []

  const openCreate = () => {
    setEditing(null)
    setName('')
    setSlug('')
    setDescription('')
    setPerms([])
    setModal('create')
  }

  const openEdit = (g: AccessGroupRow) => {
    setEditing(g)
    setName(g.name)
    setSlug(g.slug)
    setDescription(g.description ?? '')
    setPerms([...(g.permissions ?? [])])
    setModal('edit')
  }

  const togglePerm = (key: string) => {
    setPerms((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]))
  }

  const createMut = useMutation({
    mutationFn: () =>
      accessGroupsApi.create({
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || null,
        permissions: perms,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-access-groups'] })
      setModal(null)
    },
  })

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('missing')
      return accessGroupsApi.update(editing.id, {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || null,
        permissions: perms,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-access-groups'] })
      setModal(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => accessGroupsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-access-groups'] }),
  })

  if (!allowed) {
    return <p className="error">Vous n’avez pas la permission de gérer les groupes.</p>
  }

  return (
    <div>
      <div className="crud-actions" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          + Groupe
        </button>
      </div>
      {isLoading ? (
        <p>Chargement…</p>
      ) : (
        <div className="card dossier-tab-panel dossier-tab-panel--table">
          <ListTablePanelHeader title="Groupes d'accès" count={groups.length} />
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th className="data-table__num">Membres</th>
                  <th>Droits accordés</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const labels = cat?.permissions ?? {}
                  const gPerms = g.permissions ?? []
                  return (
                    <tr key={g.id}>
                      <td>
                        <strong>{g.name}</strong>
                        {g.description ? (
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>{g.description}</div>
                        ) : null}
                      </td>
                      <td className="data-table__num">{g.users_count ?? '—'}</td>
                      <td>
                        {gPerms.length === 0 ? (
                          <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                            Aucun droit
                          </span>
                        ) : (
                          <div className="settings-groups__perms-list">
                            {gPerms.map((p) => (
                              <span key={p} className="settings-groups__perm-chip" title={labels[p] ?? p}>
                                {labels[p] ?? p}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="crud-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(g)}>
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-danger-outline"
                            onClick={() => {
                              if (window.confirm(`Supprimer le groupe « ${g.name} » ?`)) deleteMut.mutate(g.id)
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="dossier-tab-empty">Aucun groupe configuré.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau groupe' : `Groupe : ${name}`} onClose={() => setModal(null)} size="xl">
          <form
            className="settings-groups-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (modal === 'create') createMut.mutate()
              else updateMut.mutate()
            }}
          >
            <div className="settings-groups-form__layout">
              {/* Colonne gauche — informations groupe */}
              <div className="settings-groups-form__left">
                <div className="form-group">
                  <label>Nom</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Slug technique</label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="auto si vide (a-z, tirets)"
                    pattern="[a-z0-9\-]*"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <p className="text-muted settings-groups-form__help">
                  Cochez les <strong>modules</strong> visibles dans le menu, puis les fonctions fines selon le rôle.
                  Les droits cochés sont hérités par tous les membres du groupe.
                </p>
                {perms.length > 0 && (
                  <p className="settings-groups-form__perm-count">
                    {perms.length} droit{perms.length > 1 ? 's' : ''} accordé{perms.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Colonne droite — éditeur de droits */}
              <div className="settings-groups-form__right">
                <p className="settings-groups-form__rights-label">Droits accordés aux membres</p>
                <div className="permissions-editor">
                  {permSections.map((section) => (
                    <section key={section.title} className="permissions-editor__section">
                      <h4 className="permissions-editor__section-title">{section.title}</h4>
                      <div className="permissions-editor__entries">
                        {section.entries.map(([key, label]) => {
                          const checked = perms.includes(key)
                          return (
                            <label
                              key={key}
                              className={`permissions-editor__entry${checked ? ' permissions-editor__entry--checked' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePerm(key)}
                                className="permissions-editor__checkbox"
                              />
                              <span className="permissions-editor__entry-label">{label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>

            {(createMut.isError || updateMut.isError) && (
              <p className="error" style={{ marginTop: '0.75rem' }}>{((createMut.error || updateMut.error) as Error).message}</p>
            )}
            <div className="crud-actions settings-groups-form__actions">
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
