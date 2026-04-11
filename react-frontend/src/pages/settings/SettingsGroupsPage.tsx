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
  const permEntries = useMemo(() => Object.entries(cat?.permissions ?? {}), [cat])

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
                <th>Slug</th>
                <th>Membres</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>
                    <code>{g.slug}</code>
                  </td>
                  <td>{g.users_count ?? '—'}</td>
                  <td>
                    <div className="crud-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(g)}>
                        Droits
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
              ))}
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
              <label>Droits</label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: 280,
                  overflow: 'auto',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: 8,
                }}
              >
                {permEntries.map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={perms.includes(key)} onChange={() => togglePerm(key)} />
                    <span>
                      <strong>{key}</strong>
                      <br />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>{label}</span>
                    </span>
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
