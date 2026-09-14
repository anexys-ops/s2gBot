import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accessGroupsApi, permissionsCatalogApi, type AccessGroupRow } from '../../api/client'
import Modal from '../../components/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { canManageGroups } from '../../lib/settingsAccess'

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
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Membres</th>
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
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{g.description}</div>
                      ) : null}
                    </td>
                    <td style={{ textAlign: 'center' }}>{g.users_count ?? '—'}</td>
                    <td>
                      {gPerms.length === 0 ? (
                        <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                          Aucun droit
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {gPerms.map((p) => (
                            <span
                              key={p}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.1rem 0.45rem',
                                borderRadius: 99,
                                background: 'var(--color-primary-alpha, rgba(59,130,246,0.1))',
                                color: 'var(--color-primary, #3b82f6)',
                                whiteSpace: 'nowrap',
                              }}
                              title={labels[p] ?? p}
                            >
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
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau groupe' : `Groupe : ${name}`} onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (modal === 'create') createMut.mutate()
              else updateMut.mutate()
            }}
          >
            <div className="form-group">
              <label>Nom</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Slug technique (optionnel, a-z et tirets)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto si vide"
                pattern="[a-z0-9\-]*"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Droits accordés aux membres du groupe</label>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.65rem' }}>
                Cochez les <strong>modules</strong> visibles dans le menu (section « Modules visibles »), puis
                les fonctions fines selon le rôle souhaité. Les droits cochés sont hérités par tous les membres.
              </p>
              <div
                className="permissions-editor"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  maxHeight: 400,
                  overflow: 'auto',
                  padding: '0.75rem',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: 8,
                }}
              >
                {permSections.map((section) => (
                  <section key={section.title}>
                    <h4
                      style={{
                        margin: '0 0 0.5rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--color-muted)',
                      }}
                    >
                      {section.title}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {section.entries.map(([key, label]) => (
                        <label
                          key={key}
                          style={{
                            display: 'flex',
                            gap: '0.6rem',
                            alignItems: 'flex-start',
                            cursor: 'pointer',
                            padding: '0.35rem 0.5rem',
                            borderRadius: 6,
                            background: perms.includes(key)
                              ? 'var(--color-primary-alpha, rgba(59,130,246,0.07))'
                              : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={perms.includes(key)}
                            onChange={() => togglePerm(key)}
                            style={{ marginTop: 3, flexShrink: 0 }}
                          />
                          <span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{label}</span>
                            <br />
                            <code style={{ fontSize: '0.75rem', color: 'var(--color-muted)', opacity: 0.7 }}>
                              {key}
                            </code>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
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
