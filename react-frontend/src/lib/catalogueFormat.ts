import { formatMoney } from './appLocale'

/** Montant article catalogue : priorité au libellé API, sinon nombre → DH. */
export function formatRefArticlePrice(article: {
  prix_unitaire_ht?: string | number | null
  prix_unitaire_ht_formate?: string | null
}): string {
  const fmt = article.prix_unitaire_ht_formate
  if (typeof fmt === 'string' && fmt.trim() !== '') return fmt
  const n = Number(article.prix_unitaire_ht)
  if (Number.isFinite(n)) return formatMoney(n)
  return '—'
}

export function formatTvaPercent(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n} %`
}

export function formatOptionalNumber(
  v: unknown,
  opts: { fractionDigits?: number; suffix?: string; empty?: string } = {},
): string {
  const { fractionDigits = 0, suffix = '', empty = '—' } = opts
  if (v === null || v === undefined || v === '') return empty
  const n = Number(v)
  if (!Number.isFinite(n)) return empty
  if (fractionDigits > 0) {
    return `${n.toLocaleString('fr-FR', { maximumFractionDigits: fractionDigits, minimumFractionDigits: 0 })}${suffix}`
  }
  return `${Math.round(n)}${suffix}`
}
