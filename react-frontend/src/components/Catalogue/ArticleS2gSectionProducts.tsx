import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  articleSectionProductsApi,
  type ArticleSectionProductAssignment,
  type ArticleSectionProductsGrouped,
  type RefArticleJalonProductRow,
  type RefArticleRow,
} from '../../api/client'

type Candidate = {
  id: number
  code: string
  libelle: string
}

type Props = {
  article: RefArticleRow
  sectionType: 'technicien' | 'ingenieur' | 'labo'
  canEdit: boolean
}

const SECTION_TYPES = ['technicien', 'ingenieur', 'labo'] as const

function candidatesFromArticle(article: RefArticleRow): Candidate[] {
  if (article.kind === 'product') {
    return [{ id: article.id, code: article.code, libelle: article.libelle }]
  }

  const seen = new Set<number>()
  return (article.jalon_products ?? [])
    .map((row: RefArticleJalonProductRow) => row.product)
    .filter((p): p is NonNullable<typeof p> => p != null)
    .filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
    .map((p) => ({ id: p.id, code: p.code, libelle: p.libelle }))
}

function selectedIdsForSection(
  grouped: ArticleSectionProductsGrouped | undefined,
  sectionType: string,
): number[] {
  return (grouped?.[sectionType as keyof ArticleSectionProductsGrouped] ?? []).map(
    (row) => row.product_article_id,
  )
}

function idsAssignedToOtherSections(
  grouped: ArticleSectionProductsGrouped | undefined,
  sectionType: string,
): number[] {
  return SECTION_TYPES.filter((s) => s !== sectionType).flatMap((s) =>
    (grouped?.[s] ?? []).map((row: ArticleSectionProductAssignment) => row.product_article_id),
  )
}

export default function ArticleS2gSectionProducts({ article, sectionType, canEdit }: Props) {
  const qc = useQueryClient()
  const isProduct = article.kind === 'product'
  const allCandidates = useMemo(() => candidatesFromArticle(article), [article])

  const { data: grouped, isLoading } = useQuery({
    queryKey: ['article-section-products', article.id],
    queryFn: () => articleSectionProductsApi.list(article.id),
    staleTime: 30_000,
  })

  const selectedIds = selectedIdsForSection(grouped, sectionType)
  const blockedIds = idsAssignedToOtherSections(grouped, sectionType)
  const candidates = allCandidates.filter(
    (product) => selectedIds.includes(product.id) || !blockedIds.includes(product.id),
  )

  const syncMut = useMutation({
    mutationFn: (productArticleIds: number[]) =>
      articleSectionProductsApi.sync(article.id, {
        section_type: sectionType,
        product_article_ids: productArticleIds,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-section-products', article.id] })
    },
  })

  function toggleProduct(productId: number, checked: boolean) {
    if (!canEdit || syncMut.isPending) return

    if (isProduct) {
      syncMut.mutate(checked ? [productId] : [])
      return
    }

    const next = checked
      ? [...selectedIds, productId]
      : selectedIds.filter((id) => id !== productId)
    syncMut.mutate(next)
  }

  if (isLoading) {
    return <p className="text-muted article-section-products__loading">Chargement des produits…</p>
  }

  if (allCandidates.length === 0) {
    return (
      <div className="card dossier-tab-panel article-section-products">
        <p className="dossier-tab-empty">
          Aucun produit rattaché à ce jalon. Associez des produits dans l&apos;onglet{' '}
          <strong>Modifier</strong>.
        </p>
      </div>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="card dossier-tab-panel article-section-products">
        <p className="dossier-tab-empty text-muted">
          Tous les produits sont déjà assignés à une autre section.
        </p>
      </div>
    )
  }

  return (
    <div className="card dossier-tab-panel article-section-products">
      <div className="article-section-products__head">
        <h4 className="article-actions-add__title">Produits</h4>
        <span className="badge">
          {selectedIds.length} sélectionné{selectedIds.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="article-section-products__list">
        {candidates.map((product) => {
          const checked = selectedIds.includes(product.id)
          const inputType = isProduct ? 'radio' : 'checkbox'
          const inputName = isProduct ? `section-product-${article.id}` : undefined

          return (
            <label
              key={product.id}
              className={`article-section-products__row${checked ? ' article-section-products__row--selected' : ''}`}
            >
              <input
                type={inputType}
                name={inputName}
                checked={checked}
                disabled={!canEdit || syncMut.isPending}
                onChange={(e) => toggleProduct(product.id, e.target.checked)}
              />
              <span className="article-section-products__label">
                <code className="code-badge">{product.code}</code>
                <span>{product.libelle}</span>
                {!isProduct ? (
                  <Link to={`/catalogue/articles/${product.id}`} className="link-inline article-section-products__link">
                    Fiche
                  </Link>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>

      {syncMut.isError ? <p className="error">{(syncMut.error as Error).message}</p> : null}
    </div>
  )
}
