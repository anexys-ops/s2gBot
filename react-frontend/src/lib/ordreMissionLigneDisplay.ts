import type { BonCommandeLigne, EntityMetaPayload, OrdreMissionLigne } from '../api/client'
import { buildBcLigneDisplayRows } from './bcLigneDisplay'

export type OrdreMissionLigneGroup = {
  key: string
  jalon: { id: string; label: string; code?: string | null; quantite?: string | number | null } | null
  lignes: OrdreMissionLigne[]
}

/**
 * Regroupe les tâches d'un OdM sous les jalons du devis source. Les jalons sans
 * tâche pour le type de l'OdM ne sont jamais retournés.
 */
export function buildOrdreMissionLigneGroups(
  lignes: OrdreMissionLigne[],
  bcLignes: BonCommandeLigne[],
  meta?: EntityMetaPayload | null,
): OrdreMissionLigneGroup[] {
  const sorted = [...lignes].sort((a, b) => a.ordre - b.ordre || a.id - b.id)
  if (sorted.length === 0) return []

  const tasksByBcLineId = new Map<number, OrdreMissionLigne[]>()
  for (const ligne of sorted) {
    const sourceId = Number(ligne.bon_commande_ligne_id ?? 0)
    if (sourceId <= 0) continue
    const bucket = tasksByBcLineId.get(sourceId) ?? []
    bucket.push(ligne)
    tasksByBcLineId.set(sourceId, bucket)
  }

  const emitted = new Set<number>()
  const groups: OrdreMissionLigneGroup[] = []
  for (const row of buildBcLigneDisplayRows(bcLignes, meta)) {
    if (row.type === 'jalon_header') {
      const sourceIds = [...row.ligneIds]
      if (row.forfaitLigne) sourceIds.unshift(row.forfaitLigne.id)
      const groupLignes = sourceIds.flatMap((sourceId) => tasksByBcLineId.get(sourceId) ?? [])
      if (groupLignes.length === 0) continue
      groupLignes.forEach((ligne) => emitted.add(ligne.id))
      groups.push({
        key: row.key,
        jalon: {
          id: row.jalonId,
          label: row.label,
          code: row.code,
          quantite: row.forfaitLigne?.quantite ?? null,
        },
        lignes: groupLignes,
      })
      continue
    }

    const taskLignes = tasksByBcLineId.get(row.ligne.id) ?? []
    if (taskLignes.length === 0 || taskLignes.some((ligne) => emitted.has(ligne.id))) continue
    taskLignes.forEach((ligne) => emitted.add(ligne.id))
    groups.push({ key: `source-${row.ligne.id}`, jalon: null, lignes: taskLignes })
  }

  const remaining = sorted.filter((ligne) => !emitted.has(ligne.id))
  if (remaining.length > 0) groups.push({ key: 'standalone', jalon: null, lignes: remaining })
  return groups
}

export function ordreMissionLigneQuantite(
  ligne: OrdreMissionLigne,
  bcLignesById: ReadonlyMap<number, BonCommandeLigne>,
): string | number {
  const sourceId = Number(ligne.bon_commande_ligne_id ?? 0)
  return ligne.quantite ?? bcLignesById.get(sourceId)?.quantite ?? 0
}
