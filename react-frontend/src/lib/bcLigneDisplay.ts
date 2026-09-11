import type { BonCommandeLigne, EntityMetaPayload } from '../api/client'

export type GroupableLigne = {
  id: number
  ref_article_id?: number | null
  ordre?: number
}

/** Meta devis pour grouper les lignes BC/BL (quote directe ou via bon de commande). */
export function resolveDevisDisplayMeta(
  source:
    | {
        devis_display_meta?: EntityMetaPayload | null
        quote?: { meta?: EntityMetaPayload | null } | null
        bonCommande?: { quote?: { meta?: EntityMetaPayload | null } | null } | null
        bon_commande?: { quote?: { meta?: EntityMetaPayload | null } | null } | null
      }
    | null
    | undefined,
): EntityMetaPayload | null | undefined {
  return (
    source?.devis_display_meta ??
    source?.quote?.meta ??
    source?.bonCommande?.quote?.meta ??
    source?.bon_commande?.quote?.meta
  )
}

export type BcLigneDisplayRow<T extends GroupableLigne = BonCommandeLigne> =
  | { type: 'jalon_header'; key: string; jalonId: string; label: string; code?: string | null; ligneIds: number[] }
  | { type: 'product'; key: string; ligne: T; nested: boolean }

export function isDocumentForfaitMeta(meta?: EntityMetaPayload | null): boolean {
  return meta?.mode_devis === 'forfait'
}

export function collectForfaitRefArticleIds(meta?: EntityMetaPayload | null): Set<number> {
  const ids = new Set<number>()
  for (const jalon of meta?.devis_jalons ?? []) {
    if (jalon.mode !== 'forfait') continue
    for (const refId of jalon.product_ref_article_ids ?? []) {
      const id = Number(refId)
      if (id > 0) ids.add(id)
    }
  }
  return ids
}

/** Ligne BC rattachée à un forfait document ou jalon forfait (meta devis source). */
export function isForfaitBcLigne(
  ligne: Pick<BonCommandeLigne, 'ref_article_id'>,
  meta?: EntityMetaPayload | null,
): boolean {
  if (isDocumentForfaitMeta(meta)) return true
  const refId = ligne.ref_article_id != null ? Number(ligne.ref_article_id) : 0
  if (refId <= 0) return false
  return collectForfaitRefArticleIds(meta).has(refId)
}

export function filterForfaitBcLignes<T extends Pick<BonCommandeLigne, 'id' | 'ref_article_id'>>(
  lignes: T[],
  meta?: EntityMetaPayload | null,
): T[] {
  return lignes.filter((l) => isForfaitBcLigne(l, meta))
}

/** Jalon modifiable en masse (forfait document ou jalon forfait). */
export function isForfaitBcJalon(jalonId: string, meta?: EntityMetaPayload | null): boolean {
  if (isDocumentForfaitMeta(meta)) return true
  const jalon = meta?.devis_jalons?.find((j) => j.id === jalonId)
  return jalon?.mode === 'forfait'
}

export function filterForfaitBcLigneIds(
  ligneIds: number[],
  lignesById: ReadonlyMap<number, Pick<BonCommandeLigne, 'ref_article_id'>>,
  meta?: EntityMetaPayload | null,
): number[] {
  return ligneIds.filter((id) => {
    const l = lignesById.get(id)
    return l != null && isForfaitBcLigne(l, meta)
  })
}

export function resolveQuantiteDevis(ligne: Pick<BonCommandeLigne, 'quantite_devis' | 'quantite'>): number | null {
  if (ligne.quantite_devis == null || ligne.quantite_devis === '') return null
  const n = Number(ligne.quantite_devis)
  return Number.isFinite(n) ? n : null
}

export function qtyExceedsDevis(rawQty: string, maxDevis: number | null): boolean {
  if (maxDevis == null) return false
  const n = Number(String(rawQty).replace(',', '.'))
  if (!Number.isFinite(n)) return true
  return n > maxDevis + 1e-9
}

export function clampQtyToDevis(rawQty: string, maxDevis: number | null): string {
  const trimmed = rawQty.trim()
  if (!trimmed || maxDevis == null) return rawQty
  const n = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(n) || n <= maxDevis + 1e-9) return rawQty
  if (Math.abs(maxDevis - Math.round(maxDevis)) < 1e-9) return String(Math.round(maxDevis))
  return String(maxDevis)
}

function sortLignes<T extends GroupableLigne>(lignes: T[]): T[] {
  return [...lignes].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.id - b.id)
}

/** Ordre d’affichage BC/BL : jalons + produits rattachés, puis produits seuls (comme le PDF devis). */
export function buildBcLigneDisplayRows<T extends GroupableLigne>(
  lignes: T[],
  meta?: EntityMetaPayload | null,
): BcLigneDisplayRow<T>[] {
  const sorted = sortLignes(lignes)
  if (sorted.length === 0) return []

  const jalons = meta?.devis_jalons ?? []
  const parcours = meta?.devis_parcours ?? []
  if (jalons.length === 0 && parcours.length === 0) {
    return sorted.map((ligne) => ({
      type: 'product' as const,
      key: `l-${ligne.id}`,
      ligne,
      nested: false,
    }))
  }

  const childRefIds = new Set(jalons.flatMap((j) => j.product_ref_article_ids ?? []))
  const jalonById = new Map(
    jalons.filter((j) => j.id).map((j) => [j.id as string, j]),
  )
  const usedIds = new Set<number>()
  const rows: BcLigneDisplayRow<T>[] = []

  const findByRefId = (refId: number): T | undefined => {
    for (const l of sorted) {
      if (usedIds.has(l.id)) continue
      if (l.ref_article_id === refId) return l
    }
    return undefined
  }

  const nextStandalone = (): T | undefined => {
    for (const l of sorted) {
      if (usedIds.has(l.id)) continue
      const refId = l.ref_article_id
      if (refId != null && childRefIds.has(refId)) continue
      return l
    }
    return undefined
  }

  const emitProduct = (ligne: T, nested: boolean) => {
    if (usedIds.has(ligne.id)) return
    usedIds.add(ligne.id)
    rows.push({ type: 'product', key: `l-${ligne.id}`, ligne, nested })
  }

  const emitJalon = (jalonId: string) => {
    const jalon = jalonById.get(jalonId)
    if (!jalon) return
    const childLignes: T[] = []
    for (const refId of jalon.product_ref_article_ids ?? []) {
      const ligne = findByRefId(refId)
      if (ligne) childLignes.push(ligne)
    }
    rows.push({
      type: 'jalon_header',
      key: `j-${jalonId}`,
      jalonId,
      label: jalon.libelle,
      code: jalon.s2g_code ?? null,
      ligneIds: childLignes.map((l) => l.id),
    })
    for (const ligne of childLignes) emitProduct(ligne, true)
  }

  if (parcours.length > 0) {
    for (const item of parcours) {
      if (item.kind === 'jalon') {
        emitJalon(item.id)
      } else {
        const ligne = nextStandalone()
        if (ligne) emitProduct(ligne, false)
      }
    }
  } else {
    for (const jalon of jalons) {
      if (jalon.id) emitJalon(jalon.id)
    }
  }

  for (const l of sorted) {
    if (!usedIds.has(l.id)) emitProduct(l, false)
  }

  return rows
}
