import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { clientsApi, type Client, type EntityMetaPayload } from '../../api/client'
import ClientMoroccoFormFields from '../../components/clients/ClientMoroccoFormFields'
import EntityMetaCard from '../../components/module/EntityMetaCard'
import Modal from '../../components/Modal'
import { legalFormLabel } from '../../constants/moroccoClient'
import type { ClientOutletContext } from './ClientLayout'

function parseCapital(v: Client['capital_social']): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const emptyForm = (c: Client): Partial<Client> => ({
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

  const metaMut = useMutation({
    mutationFn: (meta: EntityMetaPayload) => clientsApi.update(clientId, { meta }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['client', clientId], updated)
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client-commercial', clientId] })
    },
  })

  const openEdit = () => {
    setForm(emptyForm(client))
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim()) return
    const cap = form.capital_social
    const capital_social =
      cap === undefined || cap === null || cap === ('' as unknown) || Number.isNaN(Number(cap))
        ? null
        : Number(cap)
    updateMut.mutate({ ...form, capital_social } as Partial<Client>)
  }

  const capitalDisplay =
    client.capital_social !== undefined &&
    client.capital_social !== null &&
    client.capital_social !== '' &&
    Number.isFinite(Number(client.capital_social))
      ? `${Number(client.capital_social).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MAD`
      : null

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

        <h3 className="module-fiche-section-title" style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
          Coordonnées
        </h3>
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
            <dd>{client.phone?.trim() ? client.phone : '—'}</dd>
          </div>
          <div>
            <dt>WhatsApp</dt>
            <dd>{client.whatsapp?.trim() ? client.whatsapp : '—'}</dd>
          </div>
          <div>
            <dt>Ville</dt>
            <dd>{client.city?.trim() ? client.city : '—'}</dd>
          </div>
          <div>
            <dt>Code postal</dt>
            <dd>{client.postal_code?.trim() ? client.postal_code : '—'}</dd>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <dt>Adresse (rue, quartier…)</dt>
            <dd>{client.address?.trim() ? client.address : '—'}</dd>
          </div>
        </dl>

        <h3 className="module-fiche-section-title" style={{ margin: '1.25rem 0 0.75rem', fontSize: '1rem' }}>
          Données juridiques — Maroc
        </h3>
        <dl className="module-fiche-grid">
          <div>
            <dt>ICE</dt>
            <dd>{client.ice?.trim() ? client.ice : '—'}</dd>
          </div>
          <div>
            <dt>RC</dt>
            <dd>{client.rc?.trim() ? client.rc : '—'}</dd>
          </div>
          <div>
            <dt>Patente</dt>
            <dd>{client.patente?.trim() ? client.patente : '—'}</dd>
          </div>
          <div>
            <dt>IF (identifiant fiscal)</dt>
            <dd>{client.if_number?.trim() ? client.if_number : '—'}</dd>
          </div>
          <div>
            <dt>Forme juridique</dt>
            <dd>{legalFormLabel(client.legal_form)}</dd>
          </div>
          <div>
            <dt>CNSS employeur</dt>
            <dd>{client.cnss_employer?.trim() ? client.cnss_employer : '—'}</dd>
          </div>
          <div>
            <dt>Capital social</dt>
            <dd>{capitalDisplay ?? '—'}</dd>
          </div>
          <div>
            <dt>SIRET / réf. étrangère</dt>
            <dd>{client.siret?.trim() ? client.siret : '—'}</dd>
          </div>
        </dl>
      </div>

      <EntityMetaCard
        meta={client.meta}
        editable={isAdmin}
        onSave={isAdmin ? (meta) => metaMut.mutateAsync(meta) : undefined}
        isSaving={metaMut.isPending}
        saveError={metaMut.isError ? (metaMut.error as Error).message : null}
      />

      {modalOpen && isAdmin && (
        <Modal title="Modifier le client" onClose={() => setModalOpen(false)}>
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
