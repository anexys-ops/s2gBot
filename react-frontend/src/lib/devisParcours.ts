import type { EntityMetaPayload } from '../api/client'

export type DevisParcoursItem = { kind: 'ligne' | 'jalon'; id: string }

export function lineKeyForRow(line: { row_key?: string }, index: number): string {
  return line.row_key ?? `line-idx-${index}`
}

export function buildDefaultDevisParcours(
  lines: { row_key?: string }[],
  devisJalons: NonNullable<EntityMetaPayload['devis_jalons']> | undefined,
): DevisParcoursItem[] {
  return rebuildDevisParcours(lines, devisJalons ?? [], [])
}

export function getEffectiveDevisParcours(
  lines: { row_key?: string }[],
  meta: EntityMetaPayload,
): DevisParcoursItem[] {
  const p = meta.devis_parcours
  if (p && p.length > 0) return p
  return buildDefaultDevisParcours(lines, meta.devis_jalons)
}

/**
 * Après rechargement API, les row_key deviennent `line-{id}` alors que meta peut
 * encore référencer d'anciennes clés `L-…`. On resynchronise product_line_keys et
 * reconstruit devis_parcours en conservant l'ordre d'origine.
 */
export function reconcileDevisParcoursOnLoad(
  lines: { row_key?: string; ref_article_id?: number | null }[],
  meta: EntityMetaPayload,
): EntityMetaPayload {
  const jalons = meta.devis_jalons ?? []
  if (!jalons.length) return meta

  const nextMeta: EntityMetaPayload = {
    ...meta,
    devis_jalons: jalons.map((j) => ({ ...j })),
  }

  refreshJalonProductLineKeys(lines, nextMeta)

  const lineKeys = new Set(lines.map((l, i) => lineKeyForRow(l, i)))
  const oldParcours = meta.devis_parcours ?? []
  const parcoursValid =
    oldParcours.length > 0 &&
    oldParcours.every(
      (item) =>
        item.kind === 'jalon' ||
        (item.kind === 'ligne' && lineKeys.has(item.id)),
    )

  if (parcoursValid) {
    nextMeta.devis_parcours = oldParcours
    return nextMeta
  }

  nextMeta.devis_parcours = rebuildDevisParcours(lines, nextMeta.devis_jalons ?? [], oldParcours)
  return nextMeta
}

function refreshJalonProductLineKeys(
  lines: { row_key?: string; ref_article_id?: number | null }[],
  meta: EntityMetaPayload,
): void {
  if (!meta.devis_jalons?.length) return
  meta.devis_jalons = meta.devis_jalons.map((j) => {
    const keys: string[] = []
    for (const refId of j.product_ref_article_ids ?? []) {
      const idx = lines.findIndex((l) => l.ref_article_id === refId)
      if (idx >= 0) keys.push(lineKeyForRow(lines[idx], idx))
    }
    return keys.length ? { ...j, product_line_keys: keys } : j
  })
}

export function rebuildDevisParcours(
  lines: { row_key?: string; ref_article_id?: number | null }[],
  jalons: NonNullable<EntityMetaPayload['devis_jalons']>,
  oldParcours: DevisParcoursItem[],
): DevisParcoursItem[] {
  const childRefIds = new Set(jalons.flatMap((j) => j.product_ref_article_ids ?? []))
  const lineIdxByRef = new Map<number, number>()
  lines.forEach((l, i) => {
    if (l.ref_article_id != null) lineIdxByRef.set(l.ref_article_id, i)
  })
  const used = new Set<number>()
  const emittedJalons = new Set<string>()
  const key = (i: number) => lineKeyForRow(lines[i], i)

  const pushLineIndex = (idx: number, out: DevisParcoursItem[]) => {
    if (used.has(idx)) return
    out.push({ kind: 'ligne', id: key(idx) })
    used.add(idx)
  }

  const pushJalonBlock = (jalonId: string, out: DevisParcoursItem[]) => {
    const jalon = jalons.find((j) => j.id === jalonId)
    if (!jalon?.id) return
    if (!emittedJalons.has(jalon.id)) {
      emittedJalons.add(jalon.id)
      out.push({ kind: 'jalon', id: jalon.id })
    }
    for (const refId of jalon.product_ref_article_ids ?? []) {
      const idx = lineIdxByRef.get(refId)
      if (idx != null) pushLineIndex(idx, out)
    }
  }

  const nextStandaloneIdx = (): number | null => {
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue
      const refId = lines[i].ref_article_id
      if (refId != null && childRefIds.has(refId)) continue
      return i
    }
    return null
  }

  if (oldParcours.length === 0) {
    const out: DevisParcoursItem[] = []
    for (let i = 0; i < lines.length; i++) {
      const refId = lines[i].ref_article_id
      const owner =
        refId != null
          ? jalons.find((j) => (j.product_ref_article_ids ?? []).includes(refId))
          : undefined
      if (owner?.id) {
        pushJalonBlock(owner.id, out)
      } else {
        pushLineIndex(i, out)
      }
    }
    for (const j of jalons) {
      if (j.id && !emittedJalons.has(j.id)) pushJalonBlock(j.id, out)
    }
    return out
  }

  const out: DevisParcoursItem[] = []
  for (let i = 0; i < oldParcours.length; i++) {
    const item = oldParcours[i]
    if (item.kind === 'jalon') {
      pushJalonBlock(item.id, out)
      while (i + 1 < oldParcours.length && oldParcours[i + 1].kind === 'ligne') {
        i++
      }
      continue
    }
    if (item.kind === 'ligne') {
      const idx = lines.findIndex((l, li) => lineKeyForRow(l, li) === item.id)
      if (idx >= 0) {
        pushLineIndex(idx, out)
      } else {
        const si = nextStandaloneIdx()
        if (si != null) pushLineIndex(si, out)
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (!used.has(i)) pushLineIndex(i, out)
  }

  return out
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
