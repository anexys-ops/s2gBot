import type {
  ArticleSectionProductsGrouped,
  ArticleSectionProductAssignment,
  EntityMetaPayload,
  RefArticleRow,
} from '../api/client'
import type { QuoteLineDraft } from '../components/quotes/QuoteFormFields'
import { getEffectiveDevisParcours, lineKeyForRow } from './devisParcours'

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

export function s2gProductDescription(
  product: Pick<RefArticleRow, 'id' | 'libelle' | 'code'>,
): string {
  const label = (product.libelle ?? product.code ?? '').trim()
  return label || `Article #${product.id}`
}

export function lineFromS2gProduct(
  product: Pick<RefArticleRow, 'id' | 'libelle' | 'code' | 'prix_unitaire_ht'> & { tva_rate?: string | number },
  parentJalonId: string | null,
  defaultTva: number,
): QuoteLineDraft {
  return {
    row_key: newDevisLineRowKey(),
    ref_article_id: product.id,
    description: s2gProductDescription(product),
    quantity: 1,
    unit_price: Number(product.prix_unitaire_ht) || 0,
    tva_rate: product.tva_rate != null ? Number(product.tva_rate) || defaultTva : defaultTva,
    discount_percent: 0,
    parent_jalon_id: parentJalonId ?? undefined,
  }
}

/** Restaure le lien jalon ↔ lignes après rechargement (clés row_key ou ref_article_id). */
export function restoreS2gJalonLineLinks(
  lines: QuoteLineDraft[],
  meta: EntityMetaPayload,
): { lines: QuoteLineDraft[]; meta: EntityMetaPayload } {
  const jalons = meta.devis_jalons ?? []
  if (!jalons.length) return { lines, meta }

  const parcours = getEffectiveDevisParcours(lines, meta)
  const lineIdxByKey = new Map(lines.map((l, i) => [lineKeyForRow(l, i), i]))
  const nextLines = lines.map((l) => ({ ...l, parent_jalon_id: undefined as string | undefined }))
  const nextMeta: EntityMetaPayload = {
    ...meta,
    devis_jalons: jalons.map((j) => ({ ...j })),
  }

  for (let i = 0; i < parcours.length; i++) {
    const item = parcours[i]
    if (item.kind !== 'jalon') continue
    const jalon = nextMeta.devis_jalons!.find((j) => j.id === item.id)
    if (!jalon?.id) continue

    const refIds = new Set(jalon.product_ref_article_ids ?? [])
    const linkedKeys: string[] = []

    for (let j = i + 1; j < parcours.length; j++) {
      const pItem = parcours[j]
      if (pItem.kind === 'jalon') break
      if (pItem.kind !== 'ligne') continue
      const li = lineIdxByKey.get(pItem.id)
      if (li == null) continue
      const line = nextLines[li]
      const keyMatch = (jalon.product_line_keys ?? []).includes(pItem.id)
      const refMatch = line.ref_article_id != null && refIds.has(line.ref_article_id)
      if (keyMatch || refMatch) {
        nextLines[li] = { ...line, parent_jalon_id: jalon.id }
        linkedKeys.push(lineKeyForRow(nextLines[li], li))
        if (line.ref_article_id) refIds.delete(line.ref_article_id)
      }
    }

    if (refIds.size > 0) {
      for (let li = 0; li < nextLines.length; li++) {
        const line = nextLines[li]
        if (line.parent_jalon_id || line.ref_article_id == null) continue
        if (refIds.has(line.ref_article_id)) {
          nextLines[li] = { ...line, parent_jalon_id: jalon.id }
          linkedKeys.push(lineKeyForRow(nextLines[li], li))
          refIds.delete(line.ref_article_id)
        }
      }
    }

    jalon.product_line_keys = linkedKeys.length ? linkedKeys : jalon.product_line_keys
  }

  return { lines: nextLines, meta: nextMeta }
}

/** Met à jour product_line_keys dans meta avant envoi API. */
export function syncJalonProductKeysBeforeSave(formLines: QuoteLineDraft[], meta: EntityMetaPayload): void {
  if (!meta.devis_jalons?.length) return
  meta.devis_jalons = meta.devis_jalons.map((j) => {
    const keys: string[] = []
    formLines.forEach((l, i) => {
      if (l.parent_jalon_id === j.id) keys.push(lineKeyForRow(l, i))
    })
    return keys.length ? { ...j, product_line_keys: keys } : j
  })
}
