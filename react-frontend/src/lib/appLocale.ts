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

/** Valeur `YYYY-MM-DD` pour un `<input type="date">` depuis une date API (évite le décalage UTC). */
export function dateInputFromApi(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return ''
  const s = String(value)
  const plain = s.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (plain) return plain[1]
  const d = typeof value === 'object' && value instanceof Date ? value : new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
