/** Unités devis — aligné sur `laravel-api/database/seeders/data/unites.csv`. */
export type QuoteUniteOption = {
  code: string
  libelle: string
}

export const QUOTE_UNITES: QuoteUniteOption[] = [
  { code: '10kg / m3', libelle: '10kg / m3' },
  { code: 'APPT', libelle: 'APPT' },
  { code: 'carrière', libelle: 'carrière' },
  { code: 'Carte', libelle: 'Carte' },
  { code: 'Diamétre', libelle: 'Ø' },
  { code: 'ECH', libelle: 'Echantllions' },
  { code: 'Ecole', libelle: 'Ecole' },
  { code: 'ELE', libelle: 'Element' },
  { code: 'Ens', libelle: 'Ensemble' },
  { code: 'F', libelle: 'forfaitaire' },
  { code: 'H', libelle: 'heure' },
  { code: 'Ha', libelle: 'HA' },
  { code: 'IMM', libelle: 'Immeuble' },
  { code: 'Interv', libelle: 'Intervention' },
  { code: 'Jr', libelle: 'journée' },
  { code: 'Km', libelle: 'Km' },
  { code: 'Kn', libelle: 'Kilonewton' },
  { code: 'Lot', libelle: 'Lot' },
  { code: 'm3', libelle: 'm3' },
  { code: 'Mesure', libelle: 'Mesure' },
  { code: 'MG', libelle: 'Magasin' },
  { code: 'Mission', libelle: 'Mission' },
  { code: 'ml', libelle: 'mettre liniére' },
  { code: 'mm', libelle: 'Millimètre' },
  { code: 'Mois', libelle: 'Mois' },
  { code: 'MPa', libelle: 'Mégapascal' },
  { code: 'm²', libelle: 'm²' },
  { code: 'Profil', libelle: 'Profils' },
  { code: 'Pt', libelle: 'point' },
  { code: 'Séries', libelle: 'Séries' },
  { code: 'Site', libelle: 'Site' },
  { code: 'U', libelle: 'unitaire' },
  { code: 'VILLA', libelle: 'VILLA' },
]

export const DEFAULT_QUOTE_UNITE = 'U'
export const DEFAULT_FORFAIT_UNITE = 'F'
/** @deprecated alias */

export function quoteUniteLabel(code: string | null | undefined): string {
  const c = (code ?? '').trim()
  if (!c) return ''
  const opt = QUOTE_UNITES.find((u) => u.code === c)
  if (!opt) return c
  return opt.libelle === opt.code ? opt.code : `${opt.code} — ${opt.libelle}`
}

export function normalizeQuoteUnite(
  value: string | null | undefined,
  fallback = DEFAULT_QUOTE_UNITE,
): string {
  const c = (value ?? '').trim()
  if (!c) return fallback
  return QUOTE_UNITES.some((u) => u.code === c) ? c : c
}
