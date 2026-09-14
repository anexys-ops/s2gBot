import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { labCentreGroupsApi, type LabCentreGroup } from '../../api/client'
import Modal from '../../components/Modal'

function emptyForm(): { code: string; name: string; sort_order: number; active: boolean } {
  return { code: '', name: '', sort_order: 0, active: true }
}

export default function SettingsCentresPage() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<LabCentreGroup | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)

  const { data: centres = [], isLoading, error } = useQuery({
    queryKey: ['lab-centre-groups', 'all'],
    queryFn: () => labCentreGroupsApi.listAll(),
  })

  const createMut = useMutation({
    mutationFn: () => labCentreGroupsApi.create(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lab-centre-groups'] })
      setModal(null)
      setForm(emptyForm())
      setFormError(null)
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const updateMut = useMutation({
    mutationFn: () => labCentreGroupsApi.update(editing!.id, form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lab-centre-groups'] })
      setModal(null)
      setEditing(null)
      setForm(emptyForm())
      setFormError(null)
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => labCentreGroupsApi.delete(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lab-centre-groups'] }),
    onError: (err: Error) => window.alert(err.message),
  })

  const openCreate = () => {
    setForm(emptyForm())
    setEditing(null)
    setFormError(null)
    setModal('create')
  }

  const openEdit = (c: LabCentreGroup) => {
    setEditing(c)
    setForm({ code: c.code, name: c.name, sort_order: c.sort_order, active: c.active })
    setFormError(null)
    setModal('edit')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Centres</h2>
          <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            Regroupements utilisés pour classer les dossiers par centre (labo, région…). Ils apparaissent ensuite dans
            le champ « Centre » à la création d&apos;un dossier.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Nouveau centre
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
              <th>Ordre</th>
              <th>Actif</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {centres.map((c) => (
              <tr key={c.id}>
                <td>
                  <code>{c.code}</code>
                </td>
                <td>{c.name}</td>
                <td>{c.sort_order}</td>
                <td>{c.active ? 'Oui' : 'Non'}</td>
                <td>
                  <div className="crud-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-danger-outline"
                      onClick={() => {
                        if (window.confirm(`Supprimer le centre "${c.name}" ?`)) deleteMut.mutate(c.id)
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && centres.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                  Aucun centre. Créez-en un pour qu&apos;il soit sélectionnable sur les dossiers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <Modal
          title={modal === 'create' ? 'Nouveau centre' : `Modifier — ${editing?.name}`}
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
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Code *</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                required
                maxLength={32}
              />
            </div>
            <div className="form-group">
              <label>Ordre d&apos;affichage</label>
              <input
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Centre actif
              </label>
            </div>
            {formError && <p className="error">{formError}</p>}
            <div className="crud-actions">
              <button type="submit" className="btn btn-primary" disabled={createMut.isPending || updateMut.isPending}>
                Enregistrer
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setModal(null)
                  setFormError(null)
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
