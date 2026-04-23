/**
 * Totaux devis / facture — aligné sur `CommercialDocumentTotalsService` (Laravel).
 */
export function lineHt(quantity: number, unitPrice: number, lineDiscountPercent: number): number {
  const base = round2(quantity * unitPrice)
  const p = clamp(0, 100, lineDiscountPercent)
  return round2(base * (1 - p / 100))
}

export type QuoteLineTotalsInput = {
  quantity: number
  unit_price: number
  discount_percent?: number
  tva_rate: number
}

export type DocumentTotalsResult = {
  lines_ht_subtotal: number
  lines_ht_after_discount: number
  amount_ht: number
  amount_tva: number
  amount_ttc: number
  /** TVA sur les lignes après prorata de remise document (comme le PHP) */
  document_scaled_line_tva: number
  shipping_tva: number
  travel_tva: number
}

/**
 * @param lines — une entrée par ligne avec `ht` déjà calculé (même règle que côté serveur)
 */
export function computeDocumentTotals(
  lines: Array<{ ht: number; tva_rate: number }>,
  documentDiscountPercent: number,
  documentDiscountAmount: number,
  shippingAmountHt: number,
  shippingTvaRate: number,
  travelFeeHt: number,
  travelFeeTvaRate: number,
): DocumentTotalsResult {
  let linesHt = 0
  let linesTva = 0
  for (const line of lines) {
    const ht = line.ht
    const rate = clamp(0, 100, line.tva_rate)
    linesHt += ht
    linesTva += round2(ht * (rate / 100))
  }

  const dp = clamp(0, 100, documentDiscountPercent)
  const afterPct = round2(linesHt * (1 - dp / 100))
  const afterDiscount = Math.max(0, round2(afterPct - documentDiscountAmount))

  const ratio = linesHt > 0 ? afterDiscount / linesHt : 0
  const scaledTva = round2(linesTva * ratio)

  const shipRate = clamp(0, 100, shippingTvaRate)
  const shipTva = round2(shippingAmountHt * (shipRate / 100))

  const travelHt = Math.max(0, round2(travelFeeHt))
  const trRate = clamp(0, 100, travelFeeTvaRate)
  const travelTva = round2(travelHt * (trRate / 100))

  const totalHt = round2(afterDiscount + shippingAmountHt + travelHt)
  const totalTva = round2(scaledTva + shipTva + travelTva)
  const totalTtc = round2(totalHt + totalTva)

  return {
    lines_ht_subtotal: round2(linesHt),
    lines_ht_after_discount: afterDiscount,
    amount_ht: totalHt,
    amount_tva: totalTva,
    amount_ttc: totalTtc,
    document_scaled_line_tva: scaledTva,
    shipping_tva: shipTva,
    travel_tva: travelTva,
  }
}

/** Construit les HT par ligne + totaux (mêmes formules que le recalcul serveur). */
export function computeQuoteFormDocumentTotals(
  formLines: QuoteLineTotalsInput[],
  defaultTva: number,
  documentDiscountPercent: number,
  documentDiscountAmount: number,
  shippingAmountHt: number,
  shippingTvaRate: number,
  travelFeeHt: number,
  travelFeeTvaRate: number,
): DocumentTotalsResult {
  const lines = formLines.map((l) => {
    const tva = l.tva_rate ?? defaultTva
    const disc = l.discount_percent ?? 0
    const ht = lineHt(l.quantity, l.unit_price, disc)
    return { ht, tva_rate: tva }
  })
  return computeDocumentTotals(
    lines,
    documentDiscountPercent,
    documentDiscountAmount,
    shippingAmountHt,
    shippingTvaRate,
    travelFeeHt,
    travelFeeTvaRate,
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function clamp(min: number, max: number, n: number): number {
  return Math.max(min, Math.min(max, n))
}

type FraisSupp = { montant_ht: number; tva_rate: number }

/** HT + TVA (non inclus dans le recalcul API Laravel) */
export function sumFraisSupplementairesTtc(rows: FraisSupp[] | undefined): number {
  if (!rows?.length) return 0
  let ttc = 0
  for (const f of rows) {
    const ht = Math.max(0, f.montant_ht)
    const rate = clamp(0, 100, f.tva_rate)
    ttc = round2(ttc + (ht + round2(ht * (rate / 100))))
  }
  return round2(ttc)
}
