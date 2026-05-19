import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agencesApi, type Agency } from '../../api/client'
import Modal from '../../components/Modal'

function emptyForm(): Partial<Agency> & { name: string; code: string } {
  return {
    name: '',
    code: '',
    address: null,
    city: null,
    phone: null,
    email: null,
    is_siege: false,
    active: true,
  }
}

export default function AgencesPage() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<'create' | 'edit' | 'users' | null>(null)
  const [editing, setEditing] = useState<Agency | null>(null)
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [form, setForm] = useState<Partial<Agency> & { name: string; code: string }>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)

  const { data: agences = [], isLoading, error } = useQuery({
    queryKey: ['agences'],
    queryFn: () => agencesApi.list(),
  })

  const { data: agencyUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['agences-users', selectedAgency?.id],
    queryFn: () => agencesApi.users(selectedAgency!.id),
    enabled: modal === 'users' && selectedAgency !== null,
  })

  const createMut = useMutation({
    mutationFn: () => agencesApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agences'] })
      setModal(null)
      setForm(emptyForm())
      setFormError(null)
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const updateMut = useMutation({
    mutationFn: () => agencesApi.update(editing!.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agences'] })
      setModal(null)
      setEditing(null)
      setForm(emptyForm())
      setFormError(null)
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => agencesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agences'] }),
  })

  const openCreate = () => {
    setForm(emptyForm())
    setEditing(null)
    setFormError(null)
    setModal('create')
  }

  const openEdit = (a: Agency) => {
    setEditing(a)
    setForm({
      name: a.name,
      code: a.code,
      address: a.address,
      city: a.city,
      phone: a.phone,
      email: a.email,
      is_siege: a.is_siege,
      active: a.active,
    })
    setFormError(null)
    setModal('edit')
  }

  const openUsers = (a: Agency) => {
    setSelectedAgency(a)
    setModal('users')
  }

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Agences</h2>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Nouvelle agence
        </button>
      </div>

      {isLoading && <p>Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Ville</th>
              <th>Statut</th>
              <th>Actif</th>
              <th>Utilisateurs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {agences.map((a) => (
              <tr key={a.id}>
                <td>
                  <code>{a.code}</code>
                </td>
                <td>{a.name}</td>
                <td>{a.city ?? '—'}</td>
                <td>
                  {a.is_siege ? (
                    <span className="badge" style={{ background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>
                      Siège
                    </span>
                  ) : (
                    <span className="badge" style={{ background: '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>
                      Agence
                    </span>
                  )}
                </td>
                <td>{a.active ? 'Oui' : 'Non'}</td>
                <td>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openUsers(a)}>
                    {a.users_count !== undefined ? `${a.users_count} utilisateur(s)` : 'Voir'}
                  </button>
                </td>
                <td>
                  <div className="crud-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-danger-outline"
                      onClick={() => {
                        if (window.confirm(`Supprimer l'agence "${a.name}" ?`)) deleteMut.mutate(a.id)
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && agences.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                  Aucune agence.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulaire création / édition */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal
          title={modal === 'create' ? 'Nouvelle agence' : `Modifier — ${editing?.name}`}
          onClose={() => {
            setModal(null)
            setFormError(null)
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (modal === 'create') createMut.mutate()
              else updateMut.mutate()
            }}
          >
            <div className="form-group">
              <label>Nom *</label>
              <input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Code * (3–10 caractères)</label>
              <input
                value={form.code}
                onChange={(e) => setField('code', e.target.value.toUpperCase())}
                required
                minLength={3}
                maxLength={10}
                pattern="[A-Z0-9]{3,10}"
                title="3 à 10 caractères majuscules/chiffres"
              />
            </div>
            <div className="form-group">
              <label>Ville</label>
              <input
                value={form.city ?? ''}
                onChange={(e) => setField('city', e.target.value || null)}
              />
            </div>
            <div className="form-group">
              <label>Adresse</label>
              <input
                value={form.address ?? ''}
                onChange={(e) => setField('address', e.target.value || null)}
              />
            </div>
            <div className="form-group">
              <label>Téléphone</label>
              <input
                value={form.phone ?? ''}
                onChange={(e) => setField('phone', e.target.value || null)}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setField('email', e.target.value || null)}
              />
            </div>
            {modal === 'create' && (
              <div className="form-group">
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_siege ?? false}
                    onChange={(e) => setField('is_siege', e.target.checked)}
                  />
                  Cet établissement est le siège social
                </label>
              </div>
            )}
            {modal === 'edit' && editing?.is_siege && (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                Le statut "Siège" ne peut pas être modifié après création.
              </p>
            )}
            <div className="form-group">
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.active ?? true}
                  onChange={(e) => setField('active', e.target.checked)}
                />
                Agence active
              </label>
            </div>
            {formError && <p className="error">{formError}</p>}
            <div className="crud-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createMut.isPending || updateMut.isPending}
              >
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setModal(null); setFormError(null) }}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Vue utilisateurs de l'agence */}
      {modal === 'users' && selectedAgency && (
        <Modal
          title={`Utilisateurs — ${selectedAgency.name}`}
          onClose={() => setModal(null)}
        >
          {usersLoading && <p>Chargement…</p>}
          {!usersLoading && agencyUsers.length === 0 && (
            <p className="text-muted">Aucun utilisateur affecté à cette agence.</p>
          )}
          {agencyUsers.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Rôle</th>
                </tr>
              </thead>
              <tbody>
                {agencyUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="crud-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
              Fermer
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
