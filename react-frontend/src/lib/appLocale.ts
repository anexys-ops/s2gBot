/**
 * Locale Maroc : interface en français, devise par défaut dirham (ISO MAD, affichage DH).
 */
import { currencyLabel, DEFAULT_CURRENCY, normalizeCurrencyCode } from './currencies'

export const APP_LOCALE = 'fr-MA' as const

const moneyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const quantityFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 0,
})

/** Montant avec séparateurs locaux et suffixe devise (DH, €, USD…). */
export function formatMoney(amount: number, currencyCode?: string | null): string {
  const code = normalizeCurrencyCode(currencyCode ?? DEFAULT_CURRENCY)
  const label = currencyLabel(code)
  if (code === 'EUR') {
    return `${moneyFormatter.format(amount)} ${label}`
  }
  return `${moneyFormatter.format(amount)} ${label}`
}

/** Quantité entière (sans décimales affichées). */
export function formatQuantity(value: string | number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return quantityFormatter.format(Math.round(n))
}

/** Libellé unité pour en-têtes (ex. colonne « TTC (DH) »). */
export function moneyUnitLabel(currencyCode?: string | null): string {
  return currencyLabel(currencyCode ?? DEFAULT_CURRENCY)
}

/** @deprecated Préférer `moneyUnitLabel(currencyCode)` */
export const MONEY_UNIT_LABEL = 'DH'

/** Formate un objet `Date` en `YYYY-MM-DD` (calendrier local, sans UTC). */
export function toLocalDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Date du jour locale au format `YYYY-MM-DD` (champs `<input type="date">`, défauts formulaires). */
export function todayLocalDateInput(): string {
  return toLocalDateInput(new Date())
}

/** Ajoute `days` jours calendaires locaux à une date `YYYY-MM-DD`. */
export function addLocalDays(fromYmd: string, days: number): string {
  const [y, m, d] = dateInputFromApi(fromYmd).split('-').map(Number)
  const cur = new Date(y, m - 1, d)
  cur.setDate(cur.getDate() + days)
  return toLocalDateInput(cur)
}

function parseAppCalendarDate(value: string | number | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const s = String(value)
  const plain = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (plain) {
    const y = Number(plain[1])
    const m = Number(plain[2])
    const day = Number(plain[3])
    const local = new Date(y, m - 1, day)
    return Number.isNaN(local.getTime()) ? null : local
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Valeur `YYYY-MM-DD` pour un `<input type="date">` depuis une date API (évite le décalage UTC). */
export function dateInputFromApi(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return ''
  const d = parseAppCalendarDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatAppDate(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = parseAppCalendarDate(value)
  if (!d) return '—'
  return d.toLocaleDateString(APP_LOCALE, options)
}

export function formatAppDateTime(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  return d.toLocaleString(APP_LOCALE, options)
}
