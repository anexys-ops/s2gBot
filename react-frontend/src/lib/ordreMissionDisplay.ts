import type { OrdreMission } from '../api/client'

export function ordreMissionBonCommande(om: OrdreMission) {
  return om.bonCommande ?? om.bon_commande ?? null
}

export function ordreMissionQuote(om: OrdreMission): { id: number; number: string } | null {
  const bc = ordreMissionBonCommande(om)
  if (!bc) return null
  if (bc.quote?.number) return bc.quote
  if (bc.quote_id) return { id: bc.quote_id, number: `#${bc.quote_id}` }
  return null
}

export function ordreMissionDossier(om: OrdreMission) {
  return om.dossier ?? om.bonCommande?.dossier ?? om.bon_commande?.dossier ?? null
}

export function ordreMissionDossierId(om: OrdreMission): number | null {
  return om.dossier_id ?? ordreMissionDossier(om)?.id ?? null
}
