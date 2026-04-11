/**
 * Locale Maroc : interface en français, devise dirham (ISO MAD, affichage DH).
 */
export const APP_LOCALE = 'fr-MA' as const

const moneyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Montant avec séparateurs locaux et suffixe DH. */
export function formatMoney(amount: number): string {
  return `${moneyFormatter.format(amount)} DH`
}

/** Libellé unité pour en-têtes (ex. colonne « TTC (DH) »). */
export const MONEY_UNIT_LABEL = 'DH'

export function formatAppDate(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  return d.toLocaleDateString(APP_LOCALE, options)
}

export function formatAppDateTime(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  return d.toLocaleString(APP_LOCALE, options)
}
