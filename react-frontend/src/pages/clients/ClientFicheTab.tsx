import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { clientsApi, type Client } from '../../api/client'
import Modal from '../../components/Modal'
import type { ClientOutletContext } from './ClientLayout'

const emptyForm = (c: Client): Partial<Client> => ({
  name: c.name,
  address: c.address ?? '',
  email: c.email ?? '',
  phone: c.phone ?? '',
  siret: c.siret ?? '',
})

export default function ClientFicheTab() {
  const { clientId, client, isAdmin } = useOutletContext<ClientOutletContext>()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<Client>>(() => emptyForm(client))

  useEffect(() => {
    setForm(emptyForm(client))
  }, [client])

  useEffect(() => {
    if (searchParams.get('edit') === '1' && isAdmin) {
      setModalOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, isAdmin])

  const updateMut = useMutation({
    mutationFn: (body: Partial<Client>) => clientsApi.update(clientId, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['client', clientId], updated)
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client-commercial', clientId] })
      setModalOpen(false)
    },
  })

  const openEdit = () => {
    setForm(emptyForm(client))
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim()) return
    updateMut.mutate(form)
  }

  return (
    <>
      <div className="card">
        <div className="crud-actions" style={{ marginBottom: '1rem' }}>
          {isAdmin && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={openEdit}>
              Modifier la fiche
            </button>
          )}
        </div>
        <dl className="module-fiche-grid">
          <div>
            <dt>Nom</dt>
            <dd>{client.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{client.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Téléphone</dt>
            <dd>{client.phone ?? '—'}</dd>
          </div>
          <div>
            <dt>SIRET</dt>
            <dd>{client.siret ?? '—'}</dd>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <dt>Adresse</dt>
            <dd>{client.address?.trim() ? client.address : '—'}</dd>
          </div>
        </dl>
      </div>

      {modalOpen && isAdmin && (
        <Modal title="Modifier le client" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nom *</label>
              <input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Adresse</label>
              <input value={form.address ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Téléphone</label>
              <input value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>SIRET</label>
              <input value={form.siret ?? ''} onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))} />
            </div>
            {updateMut.isError && <p className="error">{(updateMut.error as Error).message}</p>}
            <div className="crud-actions" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={updateMut.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
