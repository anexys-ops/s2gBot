/** Somme numérique des lignes affichées (page courante / filtres actifs). */
export function sumNumeric<T>(items: readonly T[], getter: (item: T) => unknown): number {
  let total = 0
  for (const item of items) {
    const n = Number(getter(item))
    if (Number.isFinite(n)) total += n
  }
  return total
}
