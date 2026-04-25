import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientContactsApi, clientsApi, type ClientContactRow } from '../../api/client'
import ListTableToolbar from '../../components/ListTableToolbar'
import Modal from '../../components/Modal'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

const CONTACT_TYPES = [
  { value: 'facturation', label: 'Facturation' },
  { value: 'livraison', label: 'Livraison' },
  { value: 'technique', label: 'Technique' },
  { value: 'chantier', label: 'Chantier' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'autre', label: 'Autre' },
] as const

type ContactType = (typeof CONTACT_TYPES)[number]['value']

type ContactForm = {
  client_id: number | ''
  contact_type: ContactType
  prenom: string
  nom: string
  poste: string
  departement: string
  email: string
  telephone_direct: string
  telephone_mobile: string
  is_principal: boolean
  notes: string
}

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

function contactPhone(direct?: string | null, mobile?: string | null) {
  return [direct, mobile].filter(Boolean).join(' / ') || '—'
}

export default function ClientContactsPage() {
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<ClientContactRow | null>(null)
  const [form, setForm] = useState<ContactForm>(emptyForm)

  const { data: contacts = [], isLoading, error } = useQuery({
    queryKey: ['client-contacts', 'all', debouncedSearch],
    queryFn: () => clientContactsApi.listAll({ search: debouncedSearch.trim() || undefined }),
  })
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'contacts-pick'],
    queryFn: () => clientsApi.list(),
  })

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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['client-contacts'] }),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
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

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Clients', to: '/clients' },
        { label: 'Contacts' },
      ]}
      moduleBarLabel="Tiers — Contacts"
      title="Contacts"
      subtitle={`${contacts.length} contact(s) client affiché(s)`}
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          Nouveau contact
        </button>
      }
    >
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Nom, email, téléphone, poste ou client…"
      />

      {isLoading && <p>Chargement des contacts…</p>}
      {error && <p className="error">Erreur : {(error as Error).message}</p>}

      {!isLoading && !error && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th>Poste / service</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Principal</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>{contactName(contact.prenom, contact.nom)}</td>
                    <td>{CONTACT_TYPES.find((t) => t.value === contact.contact_type)?.label ?? 'Commercial'}</td>
                    <td>
                      <Link to={`/clients/${contact.client_id}/fiche`} className="link-inline">
                        {contact.client?.name ?? `Client #${contact.client_id}`}
                      </Link>
                    </td>
                    <td>{[contact.poste, contact.departement].filter(Boolean).join(' — ') || '—'}</td>
                    <td>
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="link-inline">
                          {contact.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{contactPhone(contact.telephone_direct, contact.telephone_mobile)}</td>
                    <td>{contact.is_principal ? 'Oui' : 'Non'}</td>
                    <td>
                      <div className="crud-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(contact)}>
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-danger-outline"
                          onClick={() => {
                            if (window.confirm(`Supprimer ${contactName(contact.prenom, contact.nom)} ?`)) deleteMut.mutate(contact.id)
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
          {contacts.length === 0 && <p style={{ padding: '1rem' }}>Aucun contact client.</p>}
        </div>
      )}
      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau contact' : 'Modifier le contact'} onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (modal === 'create') createMut.mutate()
              else updateMut.mutate()
            }}
          >
            <div className="quote-form-grid">
              <label>
                Client
                <select
                  value={form.client_id === '' ? '' : String(form.client_id)}
                  onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value ? Number(e.target.value) : '' }))}
                  disabled={modal === 'edit'}
                  required
                >
                  <option value="">Choisir…</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select value={form.contact_type} onChange={(e) => setForm((f) => ({ ...f, contact_type: e.target.value as ContactType }))}>
                  {CONTACT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prénom
                <input value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} required />
              </label>
              <label>
                Nom
                <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} required />
              </label>
              <label>
                Poste
                <input value={form.poste} onChange={(e) => setForm((f) => ({ ...f, poste: e.target.value }))} />
              </label>
              <label>
                Service
                <input value={form.departement} onChange={(e) => setForm((f) => ({ ...f, departement: e.target.value }))} />
              </label>
              <label>
                Email
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </label>
              <label>
                Téléphone direct
                <input value={form.telephone_direct} onChange={(e) => setForm((f) => ({ ...f, telephone_direct: e.target.value }))} />
              </label>
              <label>
                Mobile
                <input value={form.telephone_mobile} onChange={(e) => setForm((f) => ({ ...f, telephone_mobile: e.target.value }))} />
              </label>
              <label className="quote-form-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.is_principal}
                  onChange={(e) => setForm((f) => ({ ...f, is_principal: e.target.checked }))}
                />
                Contact principal
              </label>
            </div>
            <label>
              Notes
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </label>
            {(createMut.isError || updateMut.isError) && (
              <p className="error">{((createMut.error ?? updateMut.error) as Error).message}</p>
            )}
            <div className="crud-actions" style={{ marginTop: '1rem' }}>
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
