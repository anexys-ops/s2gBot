import type { QuoteFormState } from '../QuoteFormFields'
import type { ClientAddress, ClientContactRow, DocumentPdfTemplateRow } from '../../../api/client'

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
  clientContacts: ClientContactRow[]
  addresses: ClientAddress[]
  quoteTemplates: DocumentPdfTemplateRow[]
  onAddContact?: () => void
}

export default function WizardStep3Infos({
  form,
  setForm,
  clientContacts,
  addresses,
  quoteTemplates,
}: Props) {
  const set = <K extends keyof QuoteFormState>(field: K, value: QuoteFormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  return (
    <div className="qw-body">
      <p className="qw-section-title">Informations</p>
      <p className="qw-section-sub">Contact, adresses et modèle PDF.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>Contact</label>
          <select
            value={form.contact_id ?? ''}
            onChange={(e) =>
              set('contact_id', e.target.value ? Number(e.target.value) : undefined)
            }
          >
            <option value="">Aucun</option>
            {clientContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom} {c.nom}
                {c.poste ? ` — ${c.poste}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Modèle PDF</label>
          <select
            value={form.pdf_template_id ?? ''}
            onChange={(e) =>
              set('pdf_template_id', e.target.value ? Number(e.target.value) : undefined)
            }
          >
            <option value="">Par défaut</option>
            {quoteTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Adresse de facturation</label>
          <select
            value={form.billing_address_id ?? ''}
            onChange={(e) =>
              set('billing_address_id', e.target.value ? Number(e.target.value) : undefined)
            }
          >
            <option value="">Aucune</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label || a.line1}
                {a.city ? `, ${a.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Adresse de livraison</label>
          <select
            value={form.delivery_address_id ?? ''}
            onChange={(e) =>
              set('delivery_address_id', e.target.value ? Number(e.target.value) : undefined)
            }
          >
            <option value="">Aucune</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label || a.line1}
                {a.city ? `, ${a.city}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group" style={{ marginTop: '1rem' }}>
        <label>Notes</label>
        <textarea
          rows={4}
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Notes visibles sur le devis…"
        />
      </div>
    </div>
  )
}
