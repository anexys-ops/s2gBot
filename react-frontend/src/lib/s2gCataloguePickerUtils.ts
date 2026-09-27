import type { CommercialOffering, RefArticleRow, RefQualificationTagRow } from '../api/client'

export type S2gPickerSort = 'name-asc' | 'name-desc' | 'count-desc'

export type QualificationGroup = {
  groupe: string
  tags: RefQualificationTagRow[]
  jalonCount: number
}

export type ProductSectionKind = 'technicien' | 'ingenieur' | 'labo' | 'jalon'

const GROUPE_TONES = [
  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', accent: '#2563eb' },
  { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46', accent: '#059669' },
  { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', accent: '#ea580c' },
  { bg: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6', accent: '#7c3aed' },
  { bg: '#fdf2f8', border: '#f9a8d4', text: '#9d174d', accent: '#db2777' },
  { bg: '#f0fdfa', border: '#5eead4', text: '#0f766e', accent: '#0d9488' },
] as const

export function groupeTone(groupe: string) {
  const key = groupe.trim().toLowerCase() || '__default__'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return GROUPE_TONES[hash % GROUPE_TONES.length]
}

export function tagChipTone(index: number): string {
  const tones = ['catalogue-prolab-tag--a', 'catalogue-prolab-tag--b', 'catalogue-prolab-tag--c', 'catalogue-prolab-tag--d']
  return tones[index % tones.length]
}

export function sectionLabel(section: ProductSectionKind): string {
  switch (section) {
    case 'technicien':
      return 'Technicien'
    case 'ingenieur':
      return 'Ingénieur'
    case 'labo':
      return 'Labo'
    case 'jalon':
      return 'Catalogue jalon'
    default: {
      const _exhaustive: never = section
      return _exhaustive
    }
  }
}

export function compareByName(a: string, b: string, sort: S2gPickerSort): number {
  const cmp = a.localeCompare(b, 'fr', { sensitivity: 'base' })
  return sort === 'name-desc' ? -cmp : cmp
}

export function buildJalonCountByQualificationCode(jalons: RefArticleRow[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const jalon of jalons) {
    for (const tag of jalon.qualification_tags ?? []) {
      counts.set(tag.code, (counts.get(tag.code) ?? 0) + 1)
    }
  }
  return counts
}

export function groupQualificationTags(
  tags: RefQualificationTagRow[],
  jalonCountByCode: Map<string, number>,
  sort: S2gPickerSort,
): QualificationGroup[] {
  const byGroupe = new Map<string, RefQualificationTagRow[]>()
  for (const tag of tags) {
    const groupe = tag.groupe?.trim() || 'Autres'
    const list = byGroupe.get(groupe) ?? []
    list.push(tag)
    byGroupe.set(groupe, list)
  }

  const groups: QualificationGroup[] = [...byGroupe.entries()].map(([groupe, groupTags]) => {
    const sortedTags = [...groupTags].sort((a, b) => {
      if (sort === 'count-desc') {
        const ca = jalonCountByCode.get(a.code) ?? 0
        const cb = jalonCountByCode.get(b.code) ?? 0
        if (ca !== cb) return cb - ca
      }
      return compareByName(a.display_label, b.display_label, sort)
    })
    const jalonCount = sortedTags.reduce((sum, t) => sum + (jalonCountByCode.get(t.code) ?? 0), 0)
    return { groupe, tags: sortedTags, jalonCount }
  })

  groups.sort((a, b) => {
    if (sort === 'count-desc' && a.jalonCount !== b.jalonCount) return b.jalonCount - a.jalonCount
    return compareByName(a.groupe, b.groupe, sort)
  })

  return groups
}

export function sortJalons(jalons: RefArticleRow[], sort: S2gPickerSort): RefArticleRow[] {
  return [...jalons].sort((a, b) => {
    if (sort === 'count-desc') {
      const ca = a.products_count ?? 0
      const cb = b.products_count ?? 0
      if (ca !== cb) return cb - ca
    }
    return compareByName(a.libelle, b.libelle, sort)
  })
}

export function formatProductCount(count: number, kind: 'jalon' | 'article' | 'qualification'): string {
  if (kind === 'jalon') {
    return count === 1 ? '1 jalon' : `${count} jalons`
  }
  if (kind === 'qualification') {
    return count === 1 ? '1 qualif.' : `${count} qualif.`
  }
  return count === 1 ? '1 article' : `${count} articles`
}

export function buildStockByArticleCode(offerings: CommercialOffering[]): Map<string, CommercialOffering> {
  const map = new Map<string, CommercialOffering>()
  for (const o of offerings) {
    const code = o.code?.trim().toLowerCase()
    if (!code || !o.track_stock) continue
    map.set(code, o)
  }
  return map
}

export function formatStockBadge(offering: CommercialOffering | undefined): string | null {
  if (!offering?.track_stock) return null
  const qty = Number(offering.stock_quantity)
  if (!Number.isFinite(qty)) return null
  if (qty <= 0) return 'Rupture'
  return `Stock ${qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(1)}`
}

export function stockBadgeClass(offering: CommercialOffering | undefined): string {
  if (!offering?.track_stock) return ''
  const qty = Number(offering.stock_quantity)
  if (!Number.isFinite(qty) || qty <= 0) return 's2g-picker__stock s2g-picker__stock--empty'
  if (qty <= 5) return 's2g-picker__stock s2g-picker__stock--low'
  return 's2g-picker__stock s2g-picker__stock--ok'
}

export function hasPrice(value: string | number | null | undefined): boolean {
  const n = Number(value)
  return Number.isFinite(n) && n > 0
}
