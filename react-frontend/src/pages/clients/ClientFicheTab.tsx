import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { clientsApi, adminUsersApi, type Client, type EntityMetaPayload } from '../../api/client'
import ClientFormModal from '../../components/clients/ClientFormModal'
import EntityMetaCard from '../../components/module/EntityMetaCard'
import Toast, { toastErrorMessage, type ToastVariant } from '../../components/Toast'
import { legalFormLabel } from '../../constants/moroccoClient'
import ClientPortalModulesPanel from '../../components/clients/ClientPortalModulesPanel'
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
  commercial_id: c.commercial_id ?? null,
  responsable_technique_id: c.responsable_technique_id ?? null,
  responsable_facturation_id: c.responsable_facturation_id ?? null,
  responsable_recouvrement_id: c.responsable_recouvrement_id ?? null,
  lat: c.lat ?? null,
  lng: c.lng ?? null,
})

const INTERNAL_ROLES = ['lab_admin', 'lab_technician', 'lab_manager', 'commercial', 'admin']

export default function ClientFicheTab() {
  const { clientId, client, isAdmin } = useOutletContext<ClientOutletContext>()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<Client>>(() => emptyForm(client))
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)

  // Liste des utilisateurs internes pour les selects référents
  const { data: usersData } = useQuery({
    queryKey: ['admin-users-all'],
    queryFn: () => adminUsersApi.list({ page: 1 }),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  })
  const staffUsers = (usersData?.data ?? []).filter((u) =>
    INTERNAL_ROLES.includes(u.role),
  )

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
      setToast({ message: 'Client mis à jour avec succès.', variant: 'success' })
    },
    onError: (err) => {
      setToast({
        message: toastErrorMessage(err, 'Échec de la mise à jour du client.'),
        variant: 'error',
      })
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

  const ref = (id?: number | null, label?: string | null) =>
    label ?? (id ? `#${id}` : '—')

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
          <div><dt>Nom</dt><dd>{client.name}</dd></div>
          <div><dt>Email</dt><dd>{client.email ?? '—'}</dd></div>
          <div><dt>Téléphone</dt><dd>{client.phone?.trim() ? client.phone : '—'}</dd></div>
          <div><dt>WhatsApp</dt><dd>{client.whatsapp?.trim() ? client.whatsapp : '—'}</dd></div>
          <div><dt>Ville</dt><dd>{client.city?.trim() ? client.city : '—'}</dd></div>
          <div><dt>Code postal</dt><dd>{client.postal_code?.trim() ? client.postal_code : '—'}</dd></div>
          <div style={{ gridColumn: '1 / -1' }}>
            <dt>Adresse</dt>
            <dd>{client.address?.trim() ? client.address : '—'}</dd>
          </div>
          {(client.lat || client.lng) && (
            <div>
              <dt>GPS</dt>
              <dd>{client.lat}, {client.lng}</dd>
            </div>
          )}
        </dl>

        {/* ---- Référents S2G ---- */}
        <h3 className="module-fiche-section-title" style={{ margin: '1.25rem 0 0.75rem', fontSize: '1rem' }}>
          Référents S2G
        </h3>
        <dl className="module-fiche-grid">
          <div>
            <dt>Commercial</dt>
            <dd>{ref(client.commercial_id, client.commercial?.name)}</dd>
          </div>
          <div>
            <dt>Responsable technique</dt>
            <dd>{ref(client.responsable_technique_id, client.responsable_technique?.name)}</dd>
          </div>
          <div>
            <dt>Facturation</dt>
            <dd>{ref(client.responsable_facturation_id, client.responsable_facturation?.name)}</dd>
          </div>
          <div>
            <dt>Recouvrement</dt>
            <dd>{ref(client.responsable_recouvrement_id, client.responsable_recouvrement?.name)}</dd>
          </div>
        </dl>

        <h3 className="module-fiche-section-title" style={{ margin: '1.25rem 0 0.75rem', fontSize: '1rem' }}>
          Données juridiques — Maroc
        </h3>
        <dl className="module-fiche-grid">
          <div><dt>ICE</dt><dd>{client.ice?.trim() ? client.ice : '—'}</dd></div>
          <div><dt>RC</dt><dd>{client.rc?.trim() ? client.rc : '—'}</dd></div>
          <div><dt>Patente</dt><dd>{client.patente?.trim() ? client.patente : '—'}</dd></div>
          <div><dt>IF (identifiant fiscal)</dt><dd>{client.if_number?.trim() ? client.if_number : '—'}</dd></div>
          <div><dt>Forme juridique</dt><dd>{legalFormLabel(client.legal_form)}</dd></div>
          <div><dt>CNSS employeur</dt><dd>{client.cnss_employer?.trim() ? client.cnss_employer : '—'}</dd></div>
          <div><dt>Capital social</dt><dd>{capitalDisplay ?? '—'}</dd></div>
          <div><dt>SIRET / réf. étrangère</dt><dd>{client.siret?.trim() ? client.siret : '—'}</dd></div>
        </dl>
      </div>

      <ClientPortalModulesPanel clientId={clientId} client={client} canEdit={isAdmin} />

      <EntityMetaCard
        meta={client.meta}
        editable={isAdmin}
        onSave={isAdmin ? (meta) => metaMut.mutateAsync(meta) : undefined}
        isSaving={metaMut.isPending}
        saveError={metaMut.isError ? (metaMut.error as Error).message : null}
      />

      {modalOpen && isAdmin && (
        <ClientFormModal
          mode="edit"
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onClose={() => setModalOpen(false)}
          isPending={updateMut.isPending}
          errorMessage={updateMut.isError ? (updateMut.error as Error).message : null}
          staffUsers={staffUsers}
        />
      )}
      {toast && (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      )}
    </>
  )
}
