/** Villes principales (saisie guidée via datalist ; valeur libre possible). */
export const MOROCCO_CITIES: string[] = [
  'Agadir',
  'Azrou',
  'Béni Mellal',
  'Berkane',
  'Berrechid',
  'Bouskoura',
  'Casablanca',
  'Chefchaouen',
  'Dakhla',
  'El Jadida',
  'Errachidia',
  'Essaouira',
  'Fès',
  'Fnideq',
  'Guelmim',
  'Ifrane',
  'Kénitra',
  'Khémisset',
  'Khénifra',
  'Larache',
  'Laâyoune',
  'Marrakech',
  'Martil',
  'Meknès',
  'Mohammedia',
  'Nador',
  'Ouarzazate',
  'Oujda',
  'Rabat',
  'Safi',
  'Salé',
  'Settat',
  'Souk El Arbaa',
  'Tanger',
  'Taza',
  'Témara',
  'Tétouan',
  'Tiznit',
  'Zagora',
].sort((a, b) => a.localeCompare(b, 'fr'))

export const MOROCCO_LEGAL_FORMS: { value: string; label: string }[] = [
  { value: '', label: '— Non renseigné —' },
  { value: 'SARL', label: 'SARL — Société à responsabilité limitée' },
  { value: 'SA', label: 'SA — Société anonyme' },
  { value: 'SNC', label: 'SNC — Société en nom collectif' },
  { value: 'SCS', label: 'SCS — Société en commandite simple' },
  { value: 'SCA', label: 'SCA — Société en commandite par actions' },
  { value: 'EURL', label: 'EURL — Entreprise unipersonnelle à responsabilité limitée' },
  { value: 'SUARL', label: 'SUARL — SARL unipersonnelle' },
  { value: 'SAS', label: 'SAS — Société par actions simplifiée' },
  { value: 'EI', label: 'Entreprise individuelle / auto-entrepreneur' },
  { value: 'COOP', label: 'Coopérative' },
  { value: 'ASSOC', label: 'Association' },
  { value: 'AUTRE', label: 'Autre forme' },
]

/** Indicatifs fréquents pour téléphone / WhatsApp (liste déroulante). */
export const PHONE_COUNTRY_PREFIXES: { value: string; label: string }[] = [
  { value: '+212', label: 'Maroc (+212)' },
  { value: '+33', label: 'France (+33)' },
  { value: '+32', label: 'Belgique (+32)' },
  { value: '+41', label: 'Suisse (+41)' },
  { value: '+1', label: 'États-Unis / Canada (+1)' },
  { value: '+34', label: 'Espagne (+34)' },
  { value: '+213', label: 'Algérie (+213)' },
  { value: '+216', label: 'Tunisie (+216)' },
  { value: '+221', label: 'Sénégal (+221)' },
  { value: '__other__', label: 'Autre indicatif…' },
]

const PREFIX_VALUES = new Set(PHONE_COUNTRY_PREFIXES.map((p) => p.value).filter((v) => v !== '__other__'))

export function splitE164Like(full: string | undefined | null): { prefix: string; local: string; customPrefix: string } {
  const s = (full ?? '').trim()
  if (!s) return { prefix: '+212', local: '', customPrefix: '' }
  const m = s.match(/^(\+\d{1,4})\s*(.*)$/)
  if (m) {
    const pref = m[1]
    const local = m[2].replace(/\s/g, '')
    if (PREFIX_VALUES.has(pref)) return { prefix: pref, local, customPrefix: '' }
    return { prefix: '__other__', local, customPrefix: pref }
  }
  return { prefix: '+212', local: s.replace(/\s/g, ''), customPrefix: '' }
}

export function mergePhone(prefix: string, local: string, customPrefix: string): string {
  const loc = local.replace(/\s/g, '')
  if (!loc) return ''
  if (prefix === '__other__') {
    const cp = customPrefix.trim()
    if (!cp) return loc
    const fullP = cp.startsWith('+') ? cp : `+${cp}`
    return `${fullP} ${loc}`.trim()
  }
  return `${prefix} ${loc}`.trim()
}

export function legalFormLabel(value: string | undefined | null): string {
  if (!value?.trim()) return '—'
  const f = MOROCCO_LEGAL_FORMS.find((x) => x.value === value)
  return f?.label ?? value
}
