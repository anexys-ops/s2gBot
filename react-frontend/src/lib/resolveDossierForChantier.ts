import type { DossierRow } from '../api/client'

export function dossiersForChantier(
  dossiers: DossierRow[],
  clientId: number,
  siteId: number,
): DossierRow[] {
  return dossiers.filter((d) => d.client_id === clientId && d.site_id === siteId)
}

/** Auto-link when exactly one dossier matches client + chantier. */
export function resolveUniqueDossierForChantier(
  dossiers: DossierRow[],
  clientId: number,
  siteId: number,
): number | undefined {
  const matches = dossiersForChantier(dossiers, clientId, siteId)
  return matches.length === 1 ? matches[0]!.id : undefined
}
