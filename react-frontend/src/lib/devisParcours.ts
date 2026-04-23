import type { EntityMetaPayload } from '../api/client'

export type DevisParcoursItem = { kind: 'ligne' | 'jalon'; id: string }

export function lineKeyForRow(line: { row_key?: string }, index: number): string {
  return line.row_key ?? `line-idx-${index}`
}

export function buildDefaultDevisParcours(
  lines: { row_key?: string }[],
  devisJalons: NonNullable<EntityMetaPayload['devis_jalons']> | undefined,
): DevisParcoursItem[] {
  return [
    ...lines.map((l, i) => ({ kind: 'ligne' as const, id: lineKeyForRow(l, i) })),
    ...(devisJalons ?? []).map((j, i) => ({ kind: 'jalon' as const, id: j.id ?? `j-idx-${i}` })),
  ]
}

export function getEffectiveDevisParcours(
  lines: { row_key?: string }[],
  meta: EntityMetaPayload,
): DevisParcoursItem[] {
  const p = meta.devis_parcours
  if (p && p.length > 0) return p
  return buildDefaultDevisParcours(lines, meta.devis_jalons)
}

export function filterDevisParcoursRemoveLigne(
  p: DevisParcoursItem[] | undefined,
  lineId: string,
): DevisParcoursItem[] {
  if (!p) return []
  return p.filter((x) => !(x.kind === 'ligne' && x.id === lineId))
}

export function filterDevisParcoursRemoveJalon(
  p: DevisParcoursItem[] | undefined,
  jalonId: string,
): DevisParcoursItem[] {
  if (!p) return []
  return p.filter((x) => !(x.kind === 'jalon' && x.id === jalonId))
}

/** Nettoie la persistance (clés de lignes / ids jalons inconnus). */
export function normalizeDevisParcoursInMeta(
  formLines: { row_key?: string }[],
  devisJalons: NonNullable<EntityMetaPayload['devis_jalons']> | undefined,
  meta: EntityMetaPayload,
): void {
  const p = meta.devis_parcours
  if (!p || p.length === 0) {
    delete meta.devis_parcours
    return
  }
  const lineKeySet = new Set(formLines.map((l, i) => lineKeyForRow(l, i)))
  const jalonIdSet = new Set((devisJalons ?? []).map((j) => j.id).filter((id): id is string => Boolean(id)))
  const next = p.filter((x) => {
    if (x.kind === 'ligne') return lineKeySet.has(x.id)
    if (x.kind === 'jalon') return jalonIdSet.has(x.id)
    return false
  })
  if (next.length === 0) {
    delete meta.devis_parcours
  } else {
    meta.devis_parcours = next
  }
}
