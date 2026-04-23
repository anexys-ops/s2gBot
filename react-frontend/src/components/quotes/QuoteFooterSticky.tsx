import { formatMoney } from '../../lib/appLocale'
import type { DocumentTotalsResult } from '../../lib/quoteTotals'

type Props = {
  totals: DocumentTotalsResult
  /** Frais en métadonnée (hors moteur de recalcul serveur) */
  metaFraisTtc?: number
  isSubmitting: boolean
  submitLabel: string
  onCancel: () => void
}

export default function QuoteFooterSticky({ totals, metaFraisTtc, isSubmitting, submitLabel, onCancel }: Props) {
  const m = metaFraisTtc && metaFraisTtc > 0
  return (
    <div className="quote-editor-sticky-footer" role="region" aria-label="Totaux et enregistrement">
      <div className="quote-editor-sticky-footer__totals">
        <div className="quote-editor-sticky-footer__row">
          <span>Sous-total HT (lignes)</span>
          <strong>{formatMoney(totals.lines_ht_subtotal)}</strong>
        </div>
        <div className="quote-editor-sticky-footer__row">
          <span>HT après remise</span>
          <strong>{formatMoney(totals.lines_ht_after_discount)}</strong>
        </div>
        <div className="quote-editor-sticky-footer__row">
          <span>TVA (prorata lignes + port + déplacement)</span>
          <strong>{formatMoney(totals.amount_tva)}</strong>
        </div>
        <div className="quote-editor-sticky-footer__row quote-editor-sticky-footer__row--ttc">
          <span>Total TTC (enregistrement, aligné API)</span>
          <strong>{formatMoney(totals.amount_ttc)}</strong>
        </div>
        {m && (
          <div className="quote-editor-sticky-footer__row" style={{ fontSize: '0.8rem' }}>
            <span>+ frais suppl. (métadonnée)</span>
            <span>{formatMoney(metaFraisTtc!)} TTC</span>
          </div>
        )}
      </div>
      <div className="quote-editor-sticky-footer__actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement…' : submitLabel}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSubmitting}>
          Annuler
        </button>
      </div>
    </div>
  )
}
