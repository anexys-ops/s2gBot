/** Devises de base (alignées sur `CurrencyCode` Laravel). */
export const CORE_CURRENCIES = [
  { code: 'MAD', label: 'DH', name: 'Dirham marocain' },
  { code: 'EUR', label: '€', name: 'Euro' },
  { code: 'USD', label: 'USD', name: 'Dollar US' },
  { code: 'GBP', label: 'GBP', name: 'Livre sterling' },
  { code: 'CHF', label: 'CHF', name: 'Franc suisse' },
  { code: 'CAD', label: 'CAD', name: 'Dollar canadien' },
  { code: 'SAR', label: 'SAR', name: 'Riyal saoudien' },
  { code: 'AED', label: 'AED', name: 'Dirham des EAU' },
  { code: 'XOF', label: 'FCFA', name: 'Franc CFA (BCEAO)' },
  { code: 'XAF', label: 'FCFA', name: 'Franc CFA (BEAC)' },
] as const

export type CurrencyRow = { code: string; label: string; name: string }

/** @deprecated utiliser CORE_CURRENCIES ou le catalogue API */
export const SUPPORTED_CURRENCIES = CORE_CURRENCIES

export type CurrencyCode = (typeof CORE_CURRENCIES)[number]['code']

export const DEFAULT_CURRENCY: CurrencyCode = 'MAD'

let runtimeCatalog: CurrencyRow[] | null = null

export function setRuntimeCurrencyCatalog(rows: CurrencyRow[] | null | undefined): void {
  runtimeCatalog = rows?.length ? rows : null
}

function catalog(): CurrencyRow[] {
  return runtimeCatalog ?? [...CORE_CURRENCIES]
}

export function normalizeCurrencyCode(code?: string | null): string {
  const normalized = (code ?? DEFAULT_CURRENCY).toUpperCase()
  if (catalog().some((c) => c.code === normalized)) return normalized
  if (/^[A-Z]{3}$/.test(normalized)) return normalized
  return DEFAULT_CURRENCY
}

export function currencyLabel(code?: string | null): string {
  const normalized = (code ?? DEFAULT_CURRENCY).toUpperCase()
  return catalog().find((c) => c.code === normalized)?.label ?? normalized
}

export function currencyName(code?: string | null): string {
  const normalized = (code ?? DEFAULT_CURRENCY).toUpperCase()
  return catalog().find((c) => c.code === normalized)?.name ?? normalized
}
