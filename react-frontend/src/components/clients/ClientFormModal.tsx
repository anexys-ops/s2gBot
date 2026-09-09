import type { FormEvent } from 'react'
import type { Client } from '../../api/client'
import Modal from '../Modal'
import ClientMoroccoFormFields from './ClientMoroccoFormFields'

type StaffUser = { id: number; name: string }

type Props = {
  mode: 'create' | 'edit'
  form: Partial<Client>
  setForm: React.Dispatch<React.SetStateAction<Partial<Client>>>
  onSubmit: (e: FormEvent) => void
  onClose: () => void
  isPending?: boolean
  errorMessage?: string | null
  staffUsers?: StaffUser[]
}

const STAFF_FIELDS = [
  { key: 'commercial_id', label: 'Commercial', icon: '💼' },
  { key: 'responsable_technique_id', label: 'Responsable technique', icon: '🔬' },
  { key: 'responsable_facturation_id', label: 'Facturation', icon: '🧾' },
  { key: 'responsable_recouvrement_id', label: 'Recouvrement', icon: '💰' },
] as const

export default function ClientFormModal({
  mode,
  form,
  setForm,
  onSubmit,
  onClose,
  isPending = false,
  errorMessage,
  staffUsers,
}: Props) {
  const showInternal = staffUsers !== undefined
  const previewName = form.name?.trim() || (mode === 'create' ? 'Nouveau client' : 'Client')

  return (
    <Modal
      title={mode === 'create' ? 'Nouveau client' : 'Modifier le client'}
      onClose={onClose}
      size="xl"
    >
      <form className="client-form-modal" onSubmit={onSubmit}>
        <div className="client-form-modal__hero">
          <div className="client-form-modal__avatar" aria-hidden>
            {previewName.charAt(0).toUpperCase()}
          </div>
          <div className="client-form-modal__hero-text">
            <p className="client-form-modal__hero-kicker">
              {mode === 'create' ? 'Création de fiche' : 'Édition de fiche'}
            </p>
            <p className="client-form-modal__hero-name">{previewName}</p>
            <p className="client-form-modal__hero-hint">
              Coordonnées, identifiants marocains et référents internes — tout est regroupé ci-dessous.
            </p>
          </div>
        </div>

        <div className="client-form-modal__sections">
          <section className="client-form-modal__panel client-form-modal__panel--identity">
            <header className="client-form-modal__panel-head">
              <span className="client-form-modal__panel-icon" aria-hidden>🏢</span>
              <div>
                <h3 className="client-form-modal__panel-title">Identité</h3>
                <p className="client-form-modal__panel-desc">Raison sociale et contact principal</p>
              </div>
            </header>
            <div className="quote-form-grid client-form-modal__grid">
              <div className="form-group client-form-modal__field client-form-modal__field--wide">
                <label>Nom / raison sociale *</label>
                <input
                  value={form.name ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Ex. JET CONTRACTORS"
                  autoFocus
                />
              </div>
              <div className="form-group client-form-modal__field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="contact@entreprise.ma"
                />
              </div>
            </div>
          </section>

          <section className="client-form-modal__panel client-form-modal__panel--location">
            <header className="client-form-modal__panel-head">
              <span className="client-form-modal__panel-icon" aria-hidden>📍</span>
              <div>
                <h3 className="client-form-modal__panel-title">Adresse & contact</h3>
                <p className="client-form-modal__panel-desc">Localisation et moyens de joindre le client</p>
              </div>
            </header>
            <div className="form-group client-form-modal__field client-form-modal__field--wide">
              <label>Adresse</label>
              <input
                value={form.address ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Rue, quartier, zone industrielle…"
              />
            </div>
            <ClientMoroccoFormFields form={form} setForm={setForm} part="location" layout="grid" />
          </section>

          <section className="client-form-modal__panel client-form-modal__panel--legal">
            <header className="client-form-modal__panel-head">
              <span className="client-form-modal__panel-icon" aria-hidden>⚖️</span>
              <div>
                <h3 className="client-form-modal__panel-title">Données juridiques — Maroc</h3>
                <p className="client-form-modal__panel-desc">ICE, RC, patente et forme juridique pour la facturation</p>
              </div>
            </header>
            <ClientMoroccoFormFields form={form} setForm={setForm} part="legal" layout="grid" />
          </section>

          {showInternal && (
            <>
              <section className="client-form-modal__panel client-form-modal__panel--gps">
                <header className="client-form-modal__panel-head">
                  <span className="client-form-modal__panel-icon" aria-hidden>🗺️</span>
                  <div>
                    <h3 className="client-form-modal__panel-title">Coordonnées GPS</h3>
                    <p className="client-form-modal__panel-desc">Optionnel — pour la carte clients</p>
                  </div>
                </header>
                <div className="quote-form-grid client-form-modal__grid">
                  <div className="form-group client-form-modal__field">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.lat ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lat: e.target.value ? Number(e.target.value) : null }))
                      }
                      placeholder="33.5731"
                    />
                  </div>
                  <div className="form-group client-form-modal__field">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.lng ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lng: e.target.value ? Number(e.target.value) : null }))
                      }
                      placeholder="-7.5898"
                    />
                  </div>
                </div>
              </section>

              <section className="client-form-modal__panel client-form-modal__panel--staff">
                <header className="client-form-modal__panel-head">
                  <span className="client-form-modal__panel-icon" aria-hidden>👥</span>
                  <div>
                    <h3 className="client-form-modal__panel-title">Référents S2G</h3>
                    <p className="client-form-modal__panel-desc">Interlocuteurs internes assignés à ce client</p>
                  </div>
                </header>
                <div className="quote-form-grid client-form-modal__grid client-form-modal__grid--staff">
                  {STAFF_FIELDS.map(({ key, label, icon }) => (
                    <div key={key} className="form-group client-form-modal__field client-form-modal__staff-field">
                      <label>
                        <span className="client-form-modal__staff-icon" aria-hidden>{icon}</span>
                        {label}
                      </label>
                      <select
                        value={String(form[key as keyof Client] ?? '')}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, [key]: e.target.value ? Number(e.target.value) : null }))
                        }
                      >
                        <option value="">— Aucun —</option>
                        {staffUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {errorMessage && <p className="error client-form-modal__error">{errorMessage}</p>}

        <div className="crud-actions client-form-modal__actions">
          <button type="submit" className="btn btn-primary" disabled={isPending || !form.name?.trim()}>
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  )
}
