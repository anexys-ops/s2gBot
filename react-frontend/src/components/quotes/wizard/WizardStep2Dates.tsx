import type { QuoteFormState } from '../QuoteFormFields'

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
}

export default function WizardStep2Dates({ form, setForm }: Props) {
  const set = (field: keyof QuoteFormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  return (
    <div className="qw-body">
      <p className="qw-section-title">Dates</p>
      <p className="qw-section-sub">Renseignez les dates du devis.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>
            Date du devis <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="date"
            value={form.quote_date ?? ''}
            onChange={(e) => set('quote_date', e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Valable jusqu'au</label>
          <input
            type="date"
            value={form.valid_until ?? ''}
            onChange={(e) => set('valid_until', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Date commande souhaitée</label>
          <input
            type="date"
            value={form.order_date ?? ''}
            onChange={(e) => set('order_date', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Livraison estimée</label>
          <input
            type="date"
            value={form.site_delivery_date ?? ''}
            onChange={(e) => set('site_delivery_date', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
