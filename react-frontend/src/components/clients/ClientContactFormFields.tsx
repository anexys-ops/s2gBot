import { Link } from 'react-router-dom'
import type { Client } from '../../api/client'
import ClientSelectField from './ClientSelectField'

export const CONTACT_TYPE_OPTIONS = [
  { value: 'facturation', label: 'Facturation' },
  { value: 'livraison', label: 'Livraison' },
  { value: 'technique', label: 'Technique' },
  { value: 'chantier', label: 'Chantier' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'autre', label: 'Autre' },
] as const

export type ContactType = (typeof CONTACT_TYPE_OPTIONS)[number]['value']

export type ClientContactFormState = {
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

type Props = {
  form: ClientContactFormState
  setForm: React.Dispatch<React.SetStateAction<ClientContactFormState>>
  clients: Client[]
  clientSelectDisabled?: boolean
}

export default function ClientContactFormFields({
  form,
  setForm,
  clients,
  clientSelectDisabled = false,
}: Props) {
  const set = <K extends keyof ClientContactFormState>(field: K, value: ClientContactFormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  const selectedClient =
    form.client_id !== '' ? clients.find((c) => c.id === form.client_id) : undefined

  return (
    <div className="client-contact-form__sections">
      <section className="ds-form-section">
        <h3 className="ds-form-section__title">Rattachement client</h3>
        {clientSelectDisabled && form.client_id !== '' ? (
          <div className="form-group client-contact-form__client-readonly">
            <span className="filter-label">Client</span>
            <p className="client-contact-form__client-name">
              <Link to={`/clients/${form.client_id}/fiche`} className="link-inline">
                {selectedClient?.name ?? `Client #${form.client_id}`}
              </Link>
            </p>
            <p className="text-muted client-contact-form__hint">
              Le client ne peut pas être modifié après création du contact.
            </p>
          </div>
        ) : (
          <ClientSelectField
            label="Client"
            clients={clients}
            value={form.client_id === '' ? 0 : form.client_id}
            onChange={(id) => set('client_id', id)}
            required
          />
        )}
        <div className="quote-form-grid client-contact-form__grid">
          <div className="form-group">
            <label htmlFor="contact-type">Type de contact</label>
            <select
              id="contact-type"
              value={form.contact_type}
              onChange={(e) => set('contact_type', e.target.value as ContactType)}
            >
              {CONTACT_TYPE_OPTIONS.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <label className="quote-form-checkbox-row client-contact-form__principal">
            <input
              type="checkbox"
              checked={form.is_principal}
              onChange={(e) => set('is_principal', e.target.checked)}
            />
            <span>Contact principal pour ce client</span>
          </label>
        </div>
      </section>

      <section className="ds-form-section">
        <h3 className="ds-form-section__title">Identité</h3>
        <div className="quote-form-grid client-contact-form__grid">
          <div className="form-group">
            <label htmlFor="contact-prenom">Prénom *</label>
            <input
              id="contact-prenom"
              value={form.prenom}
              onChange={(e) => set('prenom', e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-nom">Nom *</label>
            <input
              id="contact-nom"
              value={form.nom}
              onChange={(e) => set('nom', e.target.value)}
              required
              autoComplete="family-name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-poste">Poste</label>
            <input
              id="contact-poste"
              value={form.poste}
              onChange={(e) => set('poste', e.target.value)}
              placeholder="ex. Directeur travaux"
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-departement">Service / département</label>
            <input
              id="contact-departement"
              value={form.departement}
              onChange={(e) => set('departement', e.target.value)}
              placeholder="ex. Achats, Direction"
            />
          </div>
        </div>
      </section>

      <section className="ds-form-section">
        <h3 className="ds-form-section__title">Coordonnées</h3>
        <div className="quote-form-grid client-contact-form__grid">
          <div className="form-group">
            <label htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="contact@entreprise.ma"
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-tel-direct">Téléphone direct</label>
            <input
              id="contact-tel-direct"
              type="tel"
              value={form.telephone_direct}
              onChange={(e) => set('telephone_direct', e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-tel-mobile">Mobile</label>
            <input
              id="contact-tel-mobile"
              type="tel"
              value={form.telephone_mobile}
              onChange={(e) => set('telephone_mobile', e.target.value)}
              autoComplete="tel-national"
            />
          </div>
        </div>
        <p className="text-muted client-contact-form__hint">
          L&apos;email du contact est utilisé lors de l&apos;envoi d&apos;un devis par email.
        </p>
      </section>

      <section className="ds-form-section">
        <h3 className="ds-form-section__title">Notes internes</h3>
        <div className="form-group client-contact-form__notes">
          <label htmlFor="contact-notes">Notes (optionnel)</label>
          <textarea
            id="contact-notes"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="Préférences, horaires, interlocuteur de secours…"
          />
        </div>
      </section>
    </div>
  )
}
