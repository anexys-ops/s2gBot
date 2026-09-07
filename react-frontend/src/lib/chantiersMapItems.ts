import type { DossierRow, Site } from '../api/client'
import { hasValidGps, parseCoord } from './mapCoords'

export type ChantierMapItem = {
  site: Site
  lat: number | null
  lng: number | null
  hasGps: boolean
  dossiers: DossierRow[]
  primaryDossier: DossierRow | null
  sortDate: string | null
}

export type ChantierMapFilters = {
  search: string
  dateFrom: string
  dateTo: string
  status: string
  gpsOnly: boolean
}

export function buildChantierMapItems(sites: Site[], dossiers: DossierRow[]): ChantierMapItem[] {
  const bySite = new Map<number, DossierRow[]>()
  for (const d of dossiers) {
    const list = bySite.get(d.site_id) ?? []
    list.push(d)
    bySite.set(d.site_id, list)
  }

  return sites.map((site) => {
    const lat = parseCoord(site.latitude)
    const lng = parseCoord(site.longitude)
    const siteDossiers = [...(bySite.get(site.id) ?? [])].sort((a, b) =>
      (b.date_debut ?? '').localeCompare(a.date_debut ?? ''),
    )
    const primaryDossier = siteDossiers[0] ?? null
    const sortDate = primaryDossier?.date_debut ?? site.created_at ?? null
    return {
      site,
      lat,
      lng,
      hasGps: hasValidGps(lat, lng),
      dossiers: siteDossiers,
      primaryDossier,
      sortDate,
    }
  })
}

function itemMatchesSearch(item: ChantierMapItem, q: string): boolean {
  const s = item.site
  const parts = [
    s.name,
    s.address ?? '',
    s.reference ?? '',
    s.client?.name ?? '',
    ...item.dossiers.flatMap((d) => [d.reference, d.titre]),
  ]
  return parts.some((p) => p.toLowerCase().includes(q))
}

function itemMatchesDate(item: ChantierMapItem, dateFrom: string, dateTo: string): boolean {
  const date = item.sortDate?.slice(0, 10) ?? ''
  if (!date) return !dateFrom && !dateTo
  if (dateFrom && date < dateFrom) return false
  if (dateTo && date > dateTo) return false
  return true
}

export function filterChantierMapItems(items: ChantierMapItem[], filters: ChantierMapFilters): ChantierMapItem[] {
  const q = filters.search.trim().toLowerCase()
  return items.filter((item) => {
    if (filters.gpsOnly && !item.hasGps) return false
    if (filters.status && (item.site.status ?? 'not_started') !== filters.status) return false
    if (q && !itemMatchesSearch(item, q)) return false
    if (!itemMatchesDate(item, filters.dateFrom, filters.dateTo)) return false
    return true
  })
}

export function primaryDossierHref(item: ChantierMapItem): string | null {
  if (item.primaryDossier) return `/dossiers/${item.primaryDossier.id}`
  return null
}

export function siteDetailHref(siteId: number): string {
  return `/sites/${siteId}/fiche`
}
