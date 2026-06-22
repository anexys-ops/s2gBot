import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  articleSectionProductsApi,
  type ArticleSectionProductAssignment,
  type RefArticleJalonProductRow,
  type RefArticleRow,
} from '../../api/client'

const SECTION_LABELS: Record<string, string> = {
  technicien: 'Terrain / Technicien',
  ingenieur: 'Ingénieur',
  labo: 'Laboratoire',
}

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

function candidatesFromArticle(article: RefArticleRow): Candidate[] {
  if (article.kind === 'product') {
    return [{ id: article.id, code: article.code, libelle: article.libelle }]
  }

  return (article.jalon_products ?? [])
    .map((row: RefArticleJalonProductRow) => row.product)
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map((p) => ({ id: p.id, code: p.code, libelle: p.libelle }))
}

function selectedIdsForSection(
  grouped: Record<string, ArticleSectionProductAssignment[]> | undefined,
  sectionType: string,
): number[] {
  return (grouped?.[sectionType] ?? []).map((row) => row.product_article_id)
}

export default function ArticleS2gSectionProducts({ article, sectionType, canEdit }: Props) {
  const qc = useQueryClient()
  const isProduct = article.kind === 'product'
  const candidates = useMemo(() => candidatesFromArticle(article), [article])

  const { data: grouped, isLoading } = useQuery({
    queryKey: ['article-section-products', article.id],
    queryFn: () => articleSectionProductsApi.list(article.id),
    staleTime: 30_000,
  })

  const selectedIds = selectedIdsForSection(grouped, sectionType)

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
    return <p className="text-muted article-section-products__loading">Chargement des produits section…</p>
  }

  if (candidates.length === 0) {
    return (
      <div className="card dossier-tab-panel article-section-products">
        <h4 className="article-actions-add__title">Produits pour le devis</h4>
        <p className="dossier-tab-empty">
          Aucun produit rattaché à ce jalon. Associez des produits dans l&apos;onglet{' '}
          <strong>Modifier</strong> avant de les répartir par section.
        </p>
      </div>
    )
  }

  return (
    <div className="card dossier-tab-panel article-section-products">
      <div className="article-section-products__head">
        <h4 className="article-actions-add__title">Produits pour le devis</h4>
        <span className="badge">
          {selectedIds.length} / {candidates.length} sélectionné{selectedIds.length !== 1 ? 's' : ''}
        </span>
      </div>
      <p className="article-section-products__intro text-muted">
        {isProduct
          ? `Activez ce produit pour la section « ${SECTION_LABELS[sectionType]} » afin qu’il soit proposé dans les devis (une seule section à la fois).`
          : `Cochez les produits du jalon à proposer dans les devis lorsque cette prestation est ajoutée en section « ${SECTION_LABELS[sectionType]} ».`}
      </p>

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
