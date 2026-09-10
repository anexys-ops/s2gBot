import type { AgencyRow, Site, User } from '../api/client'

export function filialeAgencyLabel(agency?: AgencyRow | null): string {
  if (!agency) return '—'
  const code = agency.code?.trim()
  return code ? `${agency.name} (${code})` : agency.name
}

/** Agences filiales disponibles pour un utilisateur portail (pivot) ou toutes celles du client (staff). */
export function selectableFilialeAgencies(
  clientAgencies: AgencyRow[],
  user?: User | null,
): AgencyRow[] {
  const isPortal = user?.role === 'client' || user?.role === 'site_contact'
  if (!isPortal) return clientAgencies
  const userAgencies = user?.agencies ?? []
  if (userAgencies.length === 0) return clientAgencies
  const allowed = new Set(userAgencies.map((a) => a.id))
  return clientAgencies.filter((a) => allowed.has(a.id))
}

export function resolveDefaultFilialeAgencyId(params: {
  site?: Site | null
  user?: User | null
  agencies: AgencyRow[]
}): number | undefined {
  const { site, user, agencies } = params
  const selectable = selectableFilialeAgencies(agencies, user)

  if (site?.agency_id && selectable.some((a) => a.id === site.agency_id)) {
    return site.agency_id
  }

  if (selectable.length === 1) return selectable[0].id

  const userAgencies = user?.agencies ?? []
  if (userAgencies.length === 1 && selectable.some((a) => a.id === userAgencies[0].id)) {
    return userAgencies[0].id
  }

  const hq = selectable.find((a) => a.is_headquarters) ?? agencies.find((a) => a.is_headquarters)
  if (hq) return hq.id

  return selectable[0]?.id
}

export function needsFilialeAgencyChoice(params: {
  user?: User | null
  agencies: AgencyRow[]
  currentId?: number | null
}): boolean {
  const { user, agencies, currentId } = params
  const selectable = selectableFilialeAgencies(agencies, user)
  if (selectable.length <= 1) return false
  return currentId == null || !selectable.some((a) => a.id === currentId)
}
