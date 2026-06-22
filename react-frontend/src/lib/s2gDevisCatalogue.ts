import type {
  ArticleSectionProductsGrouped,
  ArticleSectionProductAssignment,
  RefArticleRow,
} from '../api/client'
import type { QuoteLineDraft } from '../components/quotes/QuoteFormFields'

export function newDevisLineRowKey(): string {
  return `L-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function newDevisJalonId(): string {
  return `j-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Union des produits assignés dans Actions & matériel (toutes sections). */
export function collectSectionProducts(
  grouped: ArticleSectionProductsGrouped,
): ArticleSectionProductAssignment[] {
  const seen = new Set<number>()
  const out: ArticleSectionProductAssignment[] = []
  for (const section of ['technicien', 'ingenieur', 'labo'] as const) {
    for (const row of grouped[section] ?? []) {
      if (seen.has(row.product_article_id)) continue
      seen.add(row.product_article_id)
      out.push(row)
    }
  }
  return out.sort((a, b) => a.ordre - b.ordre || a.product_article_id - b.product_article_id)
}

export function lineFromS2gProduct(
  product: Pick<RefArticleRow, 'id' | 'libelle' | 'prix_unitaire_ht'> & { tva_rate?: string | number },
  parentJalonId: string | null,
  defaultTva: number,
): QuoteLineDraft {
  return {
    row_key: newDevisLineRowKey(),
    ref_article_id: product.id,
    description: product.libelle,
    quantity: 1,
    unit_price: Number(product.prix_unitaire_ht),
    tva_rate: product.tva_rate != null ? Number(product.tva_rate) || defaultTva : defaultTva,
    discount_percent: 0,
    parent_jalon_id: parentJalonId ?? undefined,
  }
}

/** Restaure le lien parent jalon ↔ lignes à partir de la persistance meta. */
export function attachParentJalonIdsFromMeta(
  lines: QuoteLineDraft[],
  devisJalons: NonNullable<import('../api/client').EntityMetaPayload['devis_jalons']> | undefined,
): QuoteLineDraft[] {
  if (!devisJalons?.length) return lines
  const keyToJalon = new Map<string, string>()
  for (const j of devisJalons) {
    if (!j.id) continue
    for (const k of j.product_line_keys ?? []) {
      keyToJalon.set(k, j.id)
    }
  }
  if (keyToJalon.size === 0) return lines
  return lines.map((l) => {
    const key = l.row_key
    if (!key) return l
    const parent = keyToJalon.get(key)
    return parent ? { ...l, parent_jalon_id: parent } : l
  })
}
