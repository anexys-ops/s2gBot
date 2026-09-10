/** Devises supportées (aligné sur `CurrencyCode` Laravel). */
export const SUPPORTED_CURRENCIES = [
  { code: 'MAD', label: 'DH', name: 'Dirham marocain' },
  { code: 'EUR', label: '€', name: 'Euro' },
  { code: 'USD', label: 'USD', name: 'Dollar US' },
  { code: 'GBP', label: 'GBP', name: 'Livre sterling' },
  { code: 'CHF', label: 'CHF', name: 'Franc suisse' },
  { code: 'CAD', label: 'CAD', name: 'Dollar canadien' },
  { code: 'SAR', label: 'SAR', name: 'Riyal saoudien' },
  { code: 'AED', label: 'AED', name: 'Dirham des EAU' },
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code']

export const DEFAULT_CURRENCY: CurrencyCode = 'MAD'

export function normalizeCurrencyCode(code?: string | null): CurrencyCode {
  const normalized = (code ?? DEFAULT_CURRENCY).toUpperCase()
  return SUPPORTED_CURRENCIES.some((c) => c.code === normalized)
    ? (normalized as CurrencyCode)
    : DEFAULT_CURRENCY
}

export function currencyLabel(code?: string | null): string {
  const normalized = normalizeCurrencyCode(code)
  return SUPPORTED_CURRENCIES.find((c) => c.code === normalized)?.label ?? normalized
}

export function currencyName(code?: string | null): string {
  const normalized = normalizeCurrencyCode(code)
  return SUPPORTED_CURRENCIES.find((c) => c.code === normalized)?.name ?? normalized
}
