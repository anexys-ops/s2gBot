import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  catalogueApi,
  type RefArticleKind,
  type RefArticleRow,
  type RefQualificationTagRow,
} from '../../api/client'
import { formatMoney } from '../../lib/appLocale'
import {
  formatProductCount,
  hasPrice,
  sortJalons,
  tagChipTone,
  type S2gPickerSort,
} from '../../lib/s2gCataloguePickerUtils'

type Props = {
  search: string
  kind: RefArticleKind | ''
  qualificationCode: string
  sort: S2gPickerSort
  qualificationTags: RefQualificationTagRow[]
  onSearchChange: (value: string) => void
  onKindChange: (kind: RefArticleKind | '') => void
  onQualificationChange: (code: string) => void
  onSortChange: (sort: S2gPickerSort) => void
  onPickJalon: (jalon: RefArticleRow) => void
  onPickProduct: (product: RefArticleRow) => void
}

function kindBadge(kind: RefArticleRow['kind']): string {
  if (kind === 'jalon') return 'Jalon'
  if (kind === 'product') return 'Produit'
  return 'Article'
}

export default function S2gCatalogueBrowsePanel({
  search,
  kind,
  qualificationCode,
  sort,
  qualificationTags,
  onSearchChange,
  onKindChange,
  onQualificationChange,
  onSortChange,
  onPickJalon,
  onPickProduct,
}: Props) {
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['catalogue', 's2g-picker-browse', kind, qualificationCode, search],
    queryFn: () =>
      catalogueApi.articles({
        kind: kind || undefined,
        qualification_tag_code: qualificationCode.trim() || undefined,
        q: search.trim() || undefined,
        with_products_count: true,
      }),
    staleTime: 30_000,
  })

  const sortedArticles = useMemo(() => {
    const jalons = articles.filter((a) => a.kind === 'jalon')
    const products = articles.filter((a) => a.kind === 'product')
    const other = articles.filter((a) => a.kind !== 'jalon' && a.kind !== 'product')
    const sortedJalons = sortJalons(jalons, sort)
    const sortedProducts = [...products].sort((a, b) => {
      if (sort === 'name-desc') return b.libelle.localeCompare(a.libelle, 'fr')
      return a.libelle.localeCompare(b.libelle, 'fr')
    })
    const sortedOther = [...other].sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
    if (kind === 'jalon') return sortedJalons
    if (kind === 'product') return sortedProducts
    return [...sortedJalons, ...sortedProducts, ...sortedOther]
  }, [articles, kind, sort])

  return (
    <>
      <p className="text-muted s2g-picker__intro">
        Recherche globale dans le catalogue S2G — jalons et produits. Cliquez un <strong>jalon</strong>{' '}
        pour choisir ses articles, ou un <strong>produit</strong> pour l’ajouter via son jalon parent.
      </p>

      <div className="s2g-picker__filters s2g-picker__filters--catalogue">
        <input
          type="search"
          placeholder="Rechercher code, libellé, famille…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="s2g-picker__search"
          autoFocus
        />
        <label className="s2g-picker__filter-field">
          <span className="s2g-picker__sort-label">Type</span>
          <select value={kind} onChange={(e) => onKindChange(e.target.value as RefArticleKind | '')}>
            <option value="">Jalons + produits</option>
            <option value="jalon">Jalons seulement</option>
            <option value="product">Produits seulement</option>
          </select>
        </label>
        <label className="s2g-picker__filter-field">
          <span className="s2g-picker__sort-label">Qualification</span>
          <select value={qualificationCode} onChange={(e) => onQualificationChange(e.target.value)}>
            <option value="">Toutes</option>
            {qualificationTags.map((t) => (
              <option key={t.id} value={t.code}>
                {t.display_label}
              </option>
            ))}
          </select>
        </label>
        <label className="s2g-picker__sort">
          <span className="s2g-picker__sort-label">Tri</span>
          <select value={sort} onChange={(e) => onSortChange(e.target.value as S2gPickerSort)}>
            <option value="name-asc">Nom A → Z</option>
            <option value="name-desc">Nom Z → A</option>
            <option value="count-desc">Nombre ↓</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <p>Chargement du catalogue…</p>
      ) : (
        <div className="catalog-picker-list">
          {sortedArticles.map((article, idx) => {
            const isJalon = article.kind === 'jalon'
            const priceNum = Number(article.prix_unitaire_ht)
            const showPrice = hasPrice(article.prix_unitaire_ht)

            return (
              <button
                key={article.id}
                type="button"
                className="catalog-picker-row catalog-picker-row--rich"
                onClick={() => (isJalon ? onPickJalon(article) : onPickProduct(article))}
              >
                <span className="catalog-picker-row__head">
                  <span className="catalog-picker-row__name">{article.libelle}</span>
                  <span className="catalog-picker-row__badges">
                    {isJalon ? (
                      <span className="s2g-picker__count-badge">
                        {formatProductCount(article.products_count ?? 0, 'article')}
                      </span>
                    ) : showPrice ? (
                      <span className="s2g-picker__price">{formatMoney(priceNum)} HT</span>
                    ) : null}
                  </span>
                </span>
                <span className="catalog-picker-row__meta">
                  <code className="catalog-picker-row__code">{article.code}</code>
                  <span className={`catalogue-prolab-tag ${tagChipTone(idx)}`}>{kindBadge(article.kind)}</span>
                  {article.famille_label ? (
                    <span className={`catalogue-prolab-tag ${tagChipTone(idx + 1)}`}>{article.famille_label}</span>
                  ) : null}
                  {(article.qualification_tags ?? []).slice(0, 2).map((t, i) => (
                    <span key={t.id} className={`catalogue-prolab-tag ${tagChipTone(i + 2)}`}>
                      {t.code}
                    </span>
                  ))}
                </span>
              </button>
            )
          })}
          {sortedArticles.length === 0 && (
            <p className="text-muted">Aucun résultat. Modifiez la recherche ou les filtres.</p>
          )}
        </div>
      )}
    </>
  )
}
