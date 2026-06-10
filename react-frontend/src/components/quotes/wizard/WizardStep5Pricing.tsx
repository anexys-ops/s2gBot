import type { QuoteFormState } from '../QuoteFormFields'
import type { DocumentTotalsResult } from '../../../lib/quoteTotals'
import { formatMoney } from '../../../lib/appLocale'

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
  totals: DocumentTotalsResult
  metaFraisTtc: number
  isSubmitting: boolean
  submitLabel: string
  onCancel: () => void
  readOnly?: boolean
}

const MODES_PAIEMENT = ['virement', 'chèque', 'CB', 'espèces']
const DELAIS_PAIEMENT = ['immédiat', '30j', '45j', '60j', 'à réception']

export default function WizardStep5Pricing({
  form,
  setForm,
  totals,
  metaFraisTtc,
  isSubmitting,
  submitLabel,
  onCancel,
  readOnly = false,
}: Props) {
  const set = <K extends keyof QuoteFormState>(field: K, value: QuoteFormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  const setMeta = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, meta: { ...f.meta, [key]: value } }))

  const discountMode = (form.meta?.discount_mode as string) ?? 'percent'

  const fraisSupp = form.meta?.frais_supplementaires ?? []

  const addFraisSupp = () => {
    const newFrais = {
      id: `fs-${Date.now()}`,
      description: '',
      montant_ht: 0,
      tva_rate: form.tva_rate ?? 20,
    }
    setMeta('frais_supplementaires', [...fraisSupp, newFrais])
  }

  const updateFraisSupp = (index: number, field: string, value: string | number) => {
    const updated = fraisSupp.map((f, i) =>
      i === index ? { ...f, [field]: field === 'description' ? value : Number(value) } : f,
    )
    setMeta('frais_supplementaires', updated)
  }

  const removeFraisSupp = (index: number) => {
    setMeta(
      'frais_supplementaires',
      fraisSupp.filter((_, i) => i !== index),
    )
  }

  return (
    <>
    <fieldset disabled={readOnly} className="qw-step-fieldset">
    <div className="qw-body">
      <p className="qw-section-title">Tarif &amp; Validation</p>
      <p className="qw-section-sub">Remise, frais, TVA, conditions et récapitulatif.</p>

      {/* Remise globale */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>Remise globale</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <div className="qw-mode-btns" style={{ margin: 0 }}>
            <button
              type="button"
              className={`qw-mode-btn${discountMode === 'percent' ? ' qw-mode-btn--active' : ''}`}
              onClick={() => setMeta('discount_mode', 'percent')}
            >
              %
            </button>
            <button
              type="button"
              className={`qw-mode-btn${discountMode === 'amount' ? ' qw-mode-btn--active' : ''}`}
              onClick={() => setMeta('discount_mode', 'amount')}
            >
              Montant fixe
            </button>
          </div>
          {discountMode === 'percent' ? (
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.discount_percent ?? 0}
              onChange={(e) => set('discount_percent', Number(e.target.value))}
              style={{ width: '100px', padding: '.4rem .7rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          ) : (
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.discount_amount ?? 0}
              onChange={(e) => set('discount_amount', Number(e.target.value))}
              style={{ width: '120px', padding: '.4rem .7rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          )}
          <span style={{ color: '#6b7280', fontSize: '.88rem' }}>HT</span>
        </div>
      </div>

      {/* Frais supplémentaires */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>
          Frais supplémentaires
        </p>
        {fraisSupp.map((f, i) => (
          <div key={f.id ?? i} style={{ display: 'flex', gap: '.5rem', marginBottom: '.4rem', alignItems: 'center' }}>
            <input
              type="text"
              value={f.description}
              onChange={(e) => updateFraisSupp(i, 'description', e.target.value)}
              placeholder="Description…"
              style={{ flex: 2, padding: '.35rem .6rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '.88rem' }}
            />
            <input
              type="number"
              min={0}
              step={0.01}
              value={f.montant_ht}
              onChange={(e) => updateFraisSupp(i, 'montant_ht', e.target.value)}
              placeholder="HT"
              style={{ width: '100px', padding: '.35rem .6rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '.88rem' }}
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={f.tva_rate}
              onChange={(e) => updateFraisSupp(i, 'tva_rate', e.target.value)}
              placeholder="TVA %"
              style={{ width: '70px', padding: '.35rem .6rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '.88rem' }}
            />
            <button
              type="button"
              onClick={() => removeFraisSupp(i)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.1rem' }}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="qw-add-line-btn" onClick={addFraisSupp} style={{ marginTop: '.25rem' }}>
          + Frais
        </button>
      </div>

      {/* Transport */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label>Frais de transport HT</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.shipping_amount_ht ?? 0}
            onChange={(e) => set('shipping_amount_ht', Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>TVA transport %</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.shipping_tva_rate ?? 20}
            onChange={(e) => set('shipping_tva_rate', Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>TVA globale %</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.tva_rate ?? 20}
            onChange={(e) => set('tva_rate', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Conditions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label>Mode de paiement</label>
          <select
            value={(form.meta?.mode_paiement as string) ?? ''}
            onChange={(e) => setMeta('mode_paiement', e.target.value || undefined)}
          >
            <option value="">Non précisé</option>
            {MODES_PAIEMENT.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Délai de paiement</label>
          <select
            value={(form.meta?.delai_paiement as string) ?? ''}
            onChange={(e) => setMeta('delai_paiement', e.target.value || undefined)}
          >
            <option value="">Non précisé</option>
            {DELAIS_PAIEMENT.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
        <label>Conditions commerciales</label>
        <textarea
          rows={3}
          value={(form.meta?.conditions_commerciales as string) ?? ''}
          onChange={(e) => setMeta('conditions_commerciales', e.target.value || undefined)}
          placeholder="Conditions générales, remarques…"
        />
      </div>

      {/* Totals card */}
      <div className="qw-totals-card">
        <div className="qw-totals-row">
          <span>Sous-total HT (lignes)</span>
          <strong>{formatMoney(totals.lines_ht_subtotal)}</strong>
        </div>
        {(form.discount_percent ?? 0) > 0 || (form.discount_amount ?? 0) > 0 ? (
          <div className="qw-totals-row">
            <span>
              Remise{' '}
              {(form.discount_percent ?? 0) > 0
                ? `${form.discount_percent}%`
                : formatMoney(form.discount_amount ?? 0)}
            </span>
            <strong style={{ color: '#dc2626' }}>
              -{formatMoney(totals.lines_ht_subtotal - totals.lines_ht_after_discount)}
            </strong>
          </div>
        ) : null}
        {(form.shipping_amount_ht ?? 0) > 0 && (
          <div className="qw-totals-row">
            <span>Frais de port HT</span>
            <strong>{formatMoney(form.shipping_amount_ht ?? 0)}</strong>
          </div>
        )}
        <div className="qw-totals-row">
          <span>Total HT</span>
          <strong>{formatMoney(totals.amount_ht)}</strong>
        </div>
        <div className="qw-totals-row">
          <span>TVA</span>
          <strong>{formatMoney(totals.amount_tva)}</strong>
        </div>
        {metaFraisTtc > 0 && (
          <div className="qw-totals-row" style={{ fontSize: '.8rem' }}>
            <span>+ Frais suppl. TTC</span>
            <span>{formatMoney(metaFraisTtc)}</span>
          </div>
        )}
        <div className="qw-totals-row qw-totals-row--total">
          <span>Total TTC</span>
          <strong style={{ color: '#16a34a', fontSize: '1.2rem' }}>
            {formatMoney(totals.amount_ttc + metaFraisTtc)}
          </strong>
        </div>
      </div>

    </div>
    </fieldset>
    <WizardStep5Actions
      readOnly={readOnly}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      onCancel={onCancel}
    />
    </>
  )
}

function WizardStep5Actions({
  readOnly,
  isSubmitting,
  submitLabel,
  onCancel,
}: {
  readOnly: boolean
  isSubmitting: boolean
  submitLabel: string
  onCancel: () => void
}) {
  if (readOnly) {
    return (
      <div style={{ display: 'flex', gap: '1rem', marginTop: '.5rem', padding: '0 2rem 2rem' }}>
        <button type="button" className="qw-nav__back" onClick={onCancel}>
          Retour à la liste
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '1rem', marginTop: '.5rem', padding: '0 2rem 2rem' }}>
      <button type="submit" className="qw-nav__submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : submitLabel}
      </button>
      <button type="button" className="qw-nav__back" onClick={onCancel} disabled={isSubmitting}>
        Annuler
      </button>
    </div>
  )
}
