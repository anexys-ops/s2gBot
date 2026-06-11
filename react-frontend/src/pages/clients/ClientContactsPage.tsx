import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { clientContactsApi, clientsApi, type ClientContactRow } from '../../api/client'
import ClientContactFormFields, {
  CONTACT_TYPE_OPTIONS,
  type ClientContactFormState,
  type ContactType,
} from '../../components/clients/ClientContactFormFields'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusBadge, { type StatusBadgeVariant } from '../../components/ds/StatusBadge'
import ListTableToolbar from '../../components/ListTableToolbar'
import Modal from '../../components/Modal'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import TableRowActions from '../../components/TableRowActions'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility'

const CONTACT_TYPE_BADGE: Record<ContactType, StatusBadgeVariant> = {
  facturation: 'info',
  livraison: 'warning',
  technique: 'primary',
  chantier: 'success',
  commercial: 'info',
  autre: 'neutral',
}

type ContactForm = ClientContactFormState

const emptyForm: ContactForm = {
  client_id: '',
  contact_type: 'commercial',
  prenom: '',
  nom: '',
  poste: '',
  departement: '',
  email: '',
  telephone_direct: '',
  telephone_mobile: '',
  is_principal: false,
  notes: '',
}

function contactName(prenom?: string | null, nom?: string | null) {
  return [prenom, nom].filter(Boolean).join(' ').trim() || 'Contact sans nom'
}

function contactTypeLabel(type?: string | null) {
  return CONTACT_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? 'Commercial'
}

function contactTypeVariant(type?: string | null): StatusBadgeVariant {
  const key = (type ?? 'commercial') as ContactType
  return CONTACT_TYPE_BADGE[key] ?? 'neutral'
}

export default function ClientContactsPage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const clientFilterRaw = searchParams.get('client')
  const clientFilterId =
    clientFilterRaw && Number.isFinite(Number(clientFilterRaw)) && Number(clientFilterRaw) > 0
      ? Number(clientFilterRaw)
      : null

  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [typeFilter, setTypeFilter] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<ClientContactRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientContactRow | null>(null)
  const [form, setForm] = useState<ContactForm>(emptyForm)

  const { visible, toggle } = usePersistedColumnVisibility('client-contacts', {
    name: true,
    type: true,
    client: true,
    role: true,
    email: true,
    phone: true,
    principal: true,
    actions: true,
  })

  const { data: contactsRaw = [], isLoading, error } = useQuery({
    queryKey: ['client-contacts', clientFilterId ? 'client' : 'all', clientFilterId, debouncedSearch],
    queryFn: () =>
      clientFilterId
        ? clientContactsApi.list(clientFilterId)
        : clientContactsApi.listAll({ search: debouncedSearch.trim() || undefined }),
    placeholderData: keepPreviousData,
  })

  const contacts = useMemo(() => {
    let list = contactsRaw
    if (clientFilterId && debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase()
      list = list.filter((c) => {
        const hay = [
          c.prenom,
          c.nom,
          c.email,
          c.poste,
          c.departement,
          c.telephone_direct,
          c.telephone_mobile,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }
    if (typeFilter) {
      list = list.filter((c) => (c.contact_type ?? 'commercial') === typeFilter)
    }
    return list
  }, [clientFilterId, contactsRaw, debouncedSearch, typeFilter])

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'contacts-pick'],
    queryFn: () => clientsApi.list(),
  })

  const filteredClientName = useMemo(() => {
    if (!clientFilterId) return null
    return (
      clients.find((c) => c.id === clientFilterId)?.name ??
      contactsRaw[0]?.client?.name ??
      `Client #${clientFilterId}`
    )
  }, [clientFilterId, clients, contactsRaw])

  const hasActiveFilters =
    debouncedSearch.trim() !== '' || typeFilter !== '' || clientFilterId != null

  const clearAllFilters = () => {
    setSearchInput('')
    setTypeFilter('')
    if (clientFilterId) setSearchParams({})
  }

  const createMut = useMutation({
    mutationFn: () => {
      if (!form.client_id) throw new Error('Sélectionnez un client.')
      return clientContactsApi.create(form.client_id, toBody(form))
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client-contacts'] })
      setModal(null)
      setForm(emptyForm)
    },
  })

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('Contact introuvable.')
      return clientContactsApi.update(editing.id, toBody(form))
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client-contacts'] })
      setModal(null)
      setEditing(null)
      setForm(emptyForm)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => clientContactsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client-contacts'] })
      setDeleteTarget(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, client_id: clientFilterId ?? '' })
    setModal('create')
  }

  const openEdit = (contact: ClientContactRow) => {
    setEditing(contact)
    setForm({
      client_id: contact.client_id,
      contact_type: (contact.contact_type ?? 'commercial') as ContactType,
      prenom: contact.prenom ?? '',
      nom: contact.nom ?? '',
      poste: contact.poste ?? '',
      departement: contact.departement ?? '',
      email: contact.email ?? '',
      telephone_direct: contact.telephone_direct ?? '',
      telephone_mobile: contact.telephone_mobile ?? '',
      is_principal: Boolean(contact.is_principal),
      notes: contact.notes ?? '',
    })
    setModal('edit')
  }

  const shellProps = {
    shellClassName: 'module-shell--crm' as const,
    breadcrumbs: [
      { label: 'Accueil', to: '/' },
      { label: 'Commercial', to: '/crm' },
      { label: 'Clients', to: '/clients' },
      { label: 'Contacts' },
    ],
    moduleBarLabel: 'Tiers — Contacts',
    title: 'Contacts clients',
    subtitle:
      clientFilterId && filteredClientName
        ? `${contacts.length} contact(s) pour ${filteredClientName}`
        : contacts.length > 0
          ? `${contacts.length} contact(s) affiché(s)`
          : 'Personnes de contact rattachées aux fiches clients (devis, BC, factures…)',
    actions: (
      <>
        <Link to="/clients" className="btn btn-secondary btn-sm page-action-back">
          ← Liste clients
        </Link>
        {clientFilterId ? (
          <Link to="/clients/contacts" className="btn btn-secondary btn-sm">
            Tous les contacts
          </Link>
        ) : null}
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          Nouveau contact
        </button>
      </>
    ),
  }

  if (isLoading && contactsRaw.length === 0) {
    return (
      <ModuleEntityShell {...shellProps} subtitle="Chargement…">
        <p className="text-muted">Chargement des contacts…</p>
      </ModuleEntityShell>
    )
  }

  if (error) {
    return (
      <ModuleEntityShell {...shellProps}>
        <p className="error">Erreur : {(error as Error).message}</p>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell {...shellProps}>
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Nom, email, téléphone, poste ou client…"
        columns={[
          { id: 'name', label: 'Contact' },
          { id: 'type', label: 'Type' },
          { id: 'client', label: 'Client' },
          { id: 'role', label: 'Poste / service' },
          { id: 'email', label: 'Email' },
          { id: 'phone', label: 'Téléphone' },
          { id: 'principal', label: 'Principal' },
          { id: 'actions', label: 'Actions' },
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
        extra={
          <label>
            <span className="filter-label">Type de contact</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Tous</option>
              {CONTACT_TYPE_OPTIONS.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        }
        footer={
          hasActiveFilters ? (
            <>
              <span className="list-table-toolbar__footer-label">Filtres actifs</span>
              {clientFilterId && filteredClientName ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">Client : {filteredClientName}</span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setSearchParams({})}
                    aria-label="Retirer le filtre client"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {debouncedSearch.trim() !== '' ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">
                    Recherche : « {debouncedSearch.trim()} »
                  </span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setSearchInput('')}
                    aria-label="Effacer la recherche"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {typeFilter ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">
                    {contactTypeLabel(typeFilter)}
                  </span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setTypeFilter('')}
                    aria-label="Retirer le filtre type"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllFilters}>
                Tout effacer
              </button>
            </>
          ) : null
        }
      />

      <div className="card dossier-tab-panel dossier-tab-panel--table">
        {contacts.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {visible.name !== false && <th>Contact</th>}
                  {visible.type !== false && <th>Type</th>}
                  {visible.client !== false && <th>Client</th>}
                  {visible.role !== false && <th>Poste / service</th>}
                  {visible.email !== false && <th>Email</th>}
                  {visible.phone !== false && <th>Téléphone</th>}
                  {visible.principal !== false && <th>Principal</th>}
                  {visible.actions !== false && <th className="data-table__actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const name = contactName(contact.prenom, contact.nom)
                  const role = [contact.poste, contact.departement].filter(Boolean).join(' — ')
                  return (
                    <tr key={contact.id}>
                      {visible.name !== false && (
                        <td>
                          <strong>{name}</strong>
                        </td>
                      )}
                      {visible.type !== false && (
                        <td className="data-table__status">
                          <StatusBadge
                            variant={contactTypeVariant(contact.contact_type)}
                            size="sm"
                          >
                            {contactTypeLabel(contact.contact_type)}
                          </StatusBadge>
                        </td>
                      )}
                      {visible.client !== false && (
                        <td>
                          <Link to={`/clients/${contact.client_id}/fiche`} className="link-inline">
                            {contact.client?.name ?? `Client #${contact.client_id}`}
                          </Link>
                        </td>
                      )}
                      {visible.role !== false && <td>{role || '—'}</td>}
                      {visible.email !== false && (
                        <td>
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} className="link-inline">
                              {contact.email}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {visible.phone !== false && (
                        <td>
                          {contact.telephone_direct?.trim() ? (
                            <div>{contact.telephone_direct}</div>
                          ) : null}
                          {contact.telephone_mobile?.trim() ? (
                            <div className="text-muted" style={{ fontSize: '0.85em' }}>
                              {contact.telephone_direct?.trim() ? `Mob. ${contact.telephone_mobile}` : contact.telephone_mobile}
                            </div>
                          ) : null}
                          {!contact.telephone_direct?.trim() && !contact.telephone_mobile?.trim()
                            ? '—'
                            : null}
                        </td>
                      )}
                      {visible.principal !== false && (
                        <td className="data-table__status">
                          {contact.is_principal ? (
                            <StatusBadge variant="success" size="sm">
                              Principal
                            </StatusBadge>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {visible.actions !== false && (
                        <td className="data-table__actions">
                          <TableRowActions
                            editLabel={`Modifier ${name}`}
                            deleteLabel={`Supprimer ${name}`}
                            onEdit={() => openEdit(contact)}
                            onDelete={() => setDeleteTarget(contact)}
                          />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun contact ne correspond aux filtres.</p>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau contact' : 'Modifier le contact'} onClose={() => setModal(null)}>
          <form
            className="client-contact-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (modal === 'create') createMut.mutate()
              else updateMut.mutate()
            }}
          >
            <p className="text-muted client-contact-form__lead">
              {modal === 'create'
                ? 'Personne de contact rattachée à un client — utilisée sur les devis, bons de commande et factures.'
                : 'Mettez à jour les informations du contact. Le rattachement client reste inchangé.'}
            </p>
            <ClientContactFormFields
              form={form}
              setForm={setForm}
              clients={clients}
              clientSelectDisabled={modal === 'edit'}
            />
            {(createMut.isError || updateMut.isError) && (
              <p className="error">{((createMut.error ?? updateMut.error) as Error).message}</p>
            )}
            <div className="crud-actions client-contact-form__actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  createMut.isPending ||
                  updateMut.isPending ||
                  !form.prenom.trim() ||
                  !form.nom.trim() ||
                  form.client_id === ''
                }
              >
                {createMut.isPending || updateMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget ? (
        <ConfirmDialog
          title="Supprimer le contact"
          message={
            <>
              Supprimer définitivement{' '}
              <strong>{contactName(deleteTarget.prenom, deleteTarget.nom)}</strong> ?
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          error={deleteMut.isError ? (deleteMut.error as Error).message : null}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          onCancel={() => {
            if (!deleteMut.isPending) setDeleteTarget(null)
          }}
        />
      ) : null}
    </ModuleEntityShell>
  )
}

function toBody(form: ContactForm) {
  return {
    contact_type: form.contact_type,
    prenom: form.prenom,
    nom: form.nom,
    poste: form.poste || null,
    departement: form.departement || null,
    email: form.email || null,
    telephone_direct: form.telephone_direct || null,
    telephone_mobile: form.telephone_mobile || null,
    is_principal: form.is_principal,
    notes: form.notes || null,
  }
}
