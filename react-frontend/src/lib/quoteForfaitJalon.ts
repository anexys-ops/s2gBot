/** Helpers for forfait pricing at jalon level (document forfait or jalon mode forfait). */

export type ForfaitJalonFields = {
  quantity?: number
  prix_unitaire_ht?: number
  montant_ht?: number
}

export function forfaitJalonQuantity(jalon: ForfaitJalonFields | undefined | null): number {
  const q = Number(jalon?.quantity)
  if (Number.isFinite(q) && q > 0) return Math.round(q)
  return 1
}

export function forfaitJalonUnitPrice(jalon: ForfaitJalonFields | undefined | null): number {
  const pu = Number(jalon?.prix_unitaire_ht)
  if (Number.isFinite(pu) && pu >= 0) return Math.round(pu * 100) / 100
  const ht = Number(jalon?.montant_ht)
  if (Number.isFinite(ht) && ht >= 0) return Math.round(ht * 100) / 100
  return 0
}

export function forfaitJalonTotalHt(jalon: ForfaitJalonFields | undefined | null): number {
  const qty = forfaitJalonQuantity(jalon)
  const pu = forfaitJalonUnitPrice(jalon)
  if (pu > 0 || jalon?.prix_unitaire_ht != null) {
    return Math.round(qty * pu * 100) / 100
  }
  const ht = Number(jalon?.montant_ht)
  return Number.isFinite(ht) && ht >= 0 ? Math.round(ht * 100) / 100 : 0
}

/** Keep montant_ht aligned with qty × PU for persistence / PDF fallback. */
export function withSyncedForfaitJalonMontant<T extends ForfaitJalonFields>(jalon: T): T {
  return { ...jalon, montant_ht: forfaitJalonTotalHt(jalon) }
}

export function sumForfaitJalonsHt(
  jalons: ForfaitJalonFields[] | undefined | null,
): number {
  if (!jalons?.length) return 0
  return Math.round(jalons.reduce((sum, j) => sum + forfaitJalonTotalHt(j), 0) * 100) / 100
}

/** Montant HT effectif d'un devis forfait : somme des jalons, sinon tarif global. */
export function effectiveForfaitDocumentHt(
  jalons: ForfaitJalonFields[] | undefined | null,
  tarifGlobalHt: number | undefined | null,
): number {
  const jalonsTotal = sumForfaitJalonsHt(jalons)
  if (jalonsTotal > 0) return jalonsTotal
  const global = Number(tarifGlobalHt)
  return Number.isFinite(global) && global >= 0 ? Math.round(global * 100) / 100 : 0
}

export function ttcFromHt(ht: number, tvaRate: number): number {
  const rate = Math.min(100, Math.max(0, tvaRate))
  return Math.round(ht * (1 + rate / 100) * 100) / 100
}

export function htFromTtc(ttc: number, tvaRate: number): number {
  const rate = Math.min(100, Math.max(0, tvaRate))
  const divisor = 1 + rate / 100
  return divisor > 0 ? Math.round((ttc / divisor) * 100) / 100 : 0
}

/** Retire les montants d'un jalon forfait (passage au tarif global document). */
export function clearedForfaitJalonPricing<T extends ForfaitJalonFields>(jalon: T): T {
  const next = { ...jalon }
  delete next.prix_unitaire_ht
  delete next.montant_ht
  return next
}
