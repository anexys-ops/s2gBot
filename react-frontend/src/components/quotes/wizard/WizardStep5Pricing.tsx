import type { QuoteFormState } from '../QuoteFormFields'
import type { DocumentTotalsResult } from '../../../lib/quoteTotals'
import { formatMoney } from '../../../lib/appLocale'
import {
  forfaitDocumentTotalHt,
  ttcFromHt,
} from '../../../lib/quoteForfaitJalon'

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
  totals: DocumentTotalsResult
  metaFraisTtc: number
  readOnly?: boolean
}

const MODES_PAIEMENT = ['virement', 'chèque', 'CB', 'espèces']
const DELAIS_PAIEMENT = ['immédiat', '30j', '45j', '60j', 'à réception']

function PricingCard({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`card qw-pricing-card${className ? ` ${className}` : ''}`}>
      <header className="card__header qw-pricing-card__header">
        <div>
          <h3>{title}</h3>
          {hint ? <p className="qw-pricing-card__hint">{hint}</p> : null}
        </div>
      </header>
      <div className="qw-pricing-card__body">{children}</div>
    </section>
  )
}

export default function WizardStep5Pricing({
  form,
  setForm,
  totals,
  metaFraisTtc,
  readOnly = false,
}: Props) {
  const set = <K extends keyof QuoteFormState>(field: K, value: QuoteFormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  const setMeta = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, meta: { ...f.meta, [key]: value } }))

  const discountMode = (form.meta?.discount_mode as string) ?? 'percent'
  const isForfait = form.meta?.mode_devis === 'forfait'
  const fraisSupp = form.meta?.frais_supplementaires ?? []
  const totalTtc = totals.amount_ttc + metaFraisTtc
  const forfaitHt = isForfait ? forfaitDocumentTotalHt(form.meta) : 0
  const forfaitTtc = isForfait ? ttcFromHt(forfaitHt, form.tva_rate ?? 20) : 0

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
    <fieldset disabled={readOnly} className="qw-step-fieldset">
      <div className="qw-body qw-pricing-step">
        <p className="qw-section-title">Tarif &amp; Validation</p>
        <p className="qw-section-sub">
          Ajustez remises, frais et conditions, puis vérifiez le récapitulatif avant enregistrement.
        </p>

        <div className="qw-pricing-layout">
          <div className="qw-pricing-main">
            {isForfait ? (
              <PricingCard
                title="Devis forfaitaire"
                hint="Le montant global se saisit à l’étape Lignes (boîte jaune)."
                className="qw-pricing-card--forfait"
              >
                <div className="qw-pricing-forfait-summary">
                  <div className="qw-pricing-forfait-summary__item">
                    <span>Montant HT forfait</span>
                    <strong>{formatMoney(forfaitHt)}</strong>
                  </div>
                  <div className="qw-pricing-forfait-summary__item">
                    <span>TTC estimé ({form.tva_rate ?? 20} %)</span>
                    <strong>{formatMoney(forfaitTtc)}</strong>
                  </div>
                </div>
              </PricingCard>
            ) : null}

            <PricingCard title="Remise globale" hint="Appliquée sur le sous-total HT des lignes.">
              <div className="qw-pricing-discount">
                <div className="qw-mode-btns qw-pricing-discount__mode">
                  <button
                    type="button"
                    className={`qw-mode-btn${discountMode === 'percent' ? ' qw-mode-btn--active' : ''}`}
                    onClick={() => setMeta('discount_mode', 'percent')}
                  >
                    Pourcentage
                  </button>
                  <button
                    type="button"
                    className={`qw-mode-btn${discountMode === 'amount' ? ' qw-mode-btn--active' : ''}`}
                    onClick={() => setMeta('discount_mode', 'amount')}
                  >
                    Montant fixe
                  </button>
                </div>
                <div className="qw-pricing-discount__value">
                  {discountMode === 'percent' ? (
                    <div className="form-group qw-pricing-field">
                      <label htmlFor="qw-discount-percent">Remise %</label>
                      <input
                        id="qw-discount-percent"
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={form.discount_percent ?? 0}
                        onChange={(e) => set('discount_percent', Number(e.target.value))}
                      />
                    </div>
                  ) : (
                    <div className="form-group qw-pricing-field">
                      <label htmlFor="qw-discount-amount">Montant HT</label>
                      <input
                        id="qw-discount-amount"
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.discount_amount ?? 0}
                        onChange={(e) => set('discount_amount', Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              </div>
            </PricingCard>

            <PricingCard
              title="Frais supplémentaires"
              hint="Frais complémentaires affichés en TTC sur le PDF."
            >
              {fraisSupp.length === 0 ? (
                <p className="qw-pricing-empty">Aucun frais supplémentaire pour l’instant.</p>
              ) : (
                <div className="qw-pricing-frais-list">
                  {fraisSupp.map((f, i) => (
                    <div key={f.id ?? i} className="qw-pricing-frais-row">
                      <div className="form-group qw-pricing-field qw-pricing-field--grow">
                        <label>Description</label>
                        <input
                          type="text"
                          value={f.description}
                          onChange={(e) => updateFraisSupp(i, 'description', e.target.value)}
                          placeholder="Ex. déplacement, dossier…"
                        />
                      </div>
                      <div className="form-group qw-pricing-field">
                        <label>HT</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={f.montant_ht}
                          onChange={(e) => updateFraisSupp(i, 'montant_ht', e.target.value)}
                        />
                      </div>
                      <div className="form-group qw-pricing-field qw-pricing-field--tva">
                        <label>TVA %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={f.tva_rate}
                          onChange={(e) => updateFraisSupp(i, 'tva_rate', e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="ds-icon-btn ds-icon-btn--danger qw-pricing-frais-row__remove"
                        title="Supprimer ce frais"
                        aria-label="Supprimer ce frais"
                        onClick={() => removeFraisSupp(i)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                          <path
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 6h14v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6zM10 11v6M14 11v6"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="qw-add-line-btn qw-pricing-add-frais" onClick={addFraisSupp}>
                + Ajouter un frais
              </button>
            </PricingCard>

            <PricingCard title="Transport &amp; TVA">
              <div className="qw-pricing-grid">
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
                <div className="form-group qw-pricing-grid__full">
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
            </PricingCard>

            <PricingCard title="Conditions commerciales">
              <div className="qw-pricing-grid">
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
                <div className="form-group qw-pricing-grid__full">
                  <label>Conditions commerciales</label>
                  <textarea
                    rows={3}
                    value={(form.meta?.conditions_commerciales as string) ?? ''}
                    onChange={(e) => setMeta('conditions_commerciales', e.target.value || undefined)}
                    placeholder="Conditions générales, remarques, validité…"
                  />
                </div>
              </div>
            </PricingCard>
          </div>

          <aside className="qw-pricing-aside">
            <section className="card qw-totals-card qw-totals-card--aside">
              <header className="card__header qw-pricing-card__header">
                <div>
                  <h3>Récapitulatif</h3>
                  <p className="qw-pricing-card__hint">Montants calculés à partir des lignes et options.</p>
                </div>
              </header>

              <div className="qw-totals-row">
                <span>Sous-total HT (lignes)</span>
                <strong>{formatMoney(totals.lines_ht_subtotal)}</strong>
              </div>
              {(form.discount_percent ?? 0) > 0 || (form.discount_amount ?? 0) > 0 ? (
                <div className="qw-totals-row qw-totals-row--discount">
                  <span>
                    Remise{' '}
                    {(form.discount_percent ?? 0) > 0
                      ? `${form.discount_percent}%`
                      : formatMoney(form.discount_amount ?? 0)}
                  </span>
                  <strong>
                    -{formatMoney(totals.lines_ht_subtotal - totals.lines_ht_after_discount)}
                  </strong>
                </div>
              ) : null}
              {(form.shipping_amount_ht ?? 0) > 0 ? (
                <div className="qw-totals-row">
                  <span>Frais de port HT</span>
                  <strong>{formatMoney(form.shipping_amount_ht ?? 0)}</strong>
                </div>
              ) : null}
              <div className="qw-totals-row">
                <span>Total HT</span>
                <strong>{formatMoney(totals.amount_ht)}</strong>
              </div>
              <div className="qw-totals-row">
                <span>TVA</span>
                <strong>{formatMoney(totals.amount_tva)}</strong>
              </div>
              {metaFraisTtc > 0 ? (
                <div className="qw-totals-row qw-totals-row--muted">
                  <span>Frais suppl. TTC</span>
                  <span>{formatMoney(metaFraisTtc)}</span>
                </div>
              ) : null}
              <div className="qw-totals-row qw-totals-row--total">
                <span>Total TTC</span>
                <strong>{formatMoney(totalTtc)}</strong>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </fieldset>
  )
}
