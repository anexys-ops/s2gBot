import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { catalogueApi, type RefArticleRow, type RefFamilleArticleRow, type RefPackageRow } from '../../api/client'

type Props = {
  onSelectArticle?: (article: RefArticleRow) => void
  withInactif?: boolean
  /** Filtre par id de famille (client-side). */
  familleIdFilter?: number
  /** Filtre texte code / libellé (client-side). */
  searchQuery?: string
  /** Affiche un lien vers la fiche `/catalogue/articles/:id` au lieu du simple bouton. */
  linkToArticleFiche?: boolean
}

function filterTree(
  familles: RefFamilleArticleRow[],
  familleIdFilter?: number,
  searchQuery?: string,
): RefFamilleArticleRow[] {
  let out = familles
  if (familleIdFilter) {
    out = out.filter((f) => f.id === familleIdFilter)
  }
  const q = searchQuery?.trim().toLowerCase() ?? ''
  if (!q) {
    return out
  }
  return out
    .map((f) => {
      const matchFam = f.code.toLowerCase().includes(q) || f.libelle.toLowerCase().includes(q)
      const articles = (f.articles ?? []).filter(
        (a) => a.code.toLowerCase().includes(q) || a.libelle.toLowerCase().includes(q) || matchFam,
      )
      return { ...f, articles: matchFam ? f.articles : articles }
    })
    .filter((f) => (f.articles?.length ?? 0) > 0)
}

function PackageNode({ p }: { p: RefPackageRow }) {
  return (
    <li className="catalogue-tree__leaf catalogue-tree__leaf--package">
      <span className="catalogue-tree__code">{p.code}</span>
      <span className="catalogue-tree__label">{p.libelle}</span>
      {p.prix_ht && (
        <span className="catalogue-tree__meta">
          {p.prix_ht} € HT — TVA {p.tva_rate} %
        </span>
      )}
    </li>
  )
}

function ArticleNode({
  a,
  onSelectArticle,
  linkToArticleFiche,
}: {
  a: RefArticleRow
  onSelectArticle?: (article: RefArticleRow) => void
  linkToArticleFiche?: boolean
}) {
  const [open, setOpen] = useState(true)
  const packages = a.famille_packages ?? []
  const hasChildren = packages.some((fp) => (fp.packages?.length ?? 0) > 0)

  const label = (
    <>
      <span className="catalogue-tree__code">{a.code}</span>
      <span className="catalogue-tree__label">{a.libelle}</span>
    </>
  )

  return (
    <li className="catalogue-tree__article">
      <div className="catalogue-tree__row">
        {hasChildren ? (
          <button
            type="button"
            className="catalogue-tree__toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Replier' : 'Déplier'}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="catalogue-tree__toggle catalogue-tree__toggle--spacer" />
        )}
        {linkToArticleFiche ? (
          <Link to={`/catalogue/articles/${a.id}`} className="catalogue-tree__select-article catalogue-tree__link-article">
            {label}
          </Link>
        ) : (
          <button type="button" className="catalogue-tree__select-article" onClick={() => onSelectArticle?.(a)}>
            {label}
          </button>
        )}
        {a.normes && <span className="catalogue-tree__meta catalogue-tree__meta--norm">{a.normes}</span>}
      </div>
      {open &&
        hasChildren &&
        packages.map((fp) => (
          <ul key={fp.id} className="catalogue-tree__nested">
            <li className="catalogue-tree__fam-pkg">
              <span className="catalogue-tree__fam-pkg-title">{fp.libelle}</span>
              <ul>
                {(fp.packages ?? []).map((p) => (
                  <PackageNode key={p.id} p={p} />
                ))}
              </ul>
            </li>
          </ul>
        ))}
    </li>
  )
}

function FamilleNode({
  f,
  onSelectArticle,
  linkToArticleFiche,
}: {
  f: RefFamilleArticleRow
  onSelectArticle?: (article: RefArticleRow) => void
  linkToArticleFiche?: boolean
}) {
  const [open, setOpen] = useState(true)
  const articles = f.articles ?? []
  return (
    <li className="catalogue-tree__famille">
      <button
        type="button"
        className="catalogue-tree__famille-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="catalogue-tree__toggle-inline">{open ? '▾' : '▸'}</span>
        <span className="catalogue-tree__code">{f.code}</span>
        <span className="catalogue-tree__label">{f.libelle}</span>
      </button>
      {open && (
        <ul className="catalogue-tree__articles">
          {articles.map((a) => (
            <ArticleNode
              key={a.id}
              a={a}
              onSelectArticle={onSelectArticle}
              linkToArticleFiche={linkToArticleFiche}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function ArbreCatalogue({
  onSelectArticle,
  withInactif = false,
  familleIdFilter,
  searchQuery = '',
  linkToArticleFiche = false,
}: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['catalogue-arbre', withInactif],
    queryFn: () => catalogueApi.arbre({ with_inactif: withInactif }),
  })

  const filtered = useMemo(
    () => filterTree(data ?? [], familleIdFilter, searchQuery),
    [data, familleIdFilter, searchQuery],
  )

  if (isLoading) {
    return <p className="text-muted">Chargement du catalogue…</p>
  }
  if (error) {
    return <p className="error">{(error as Error).message}</p>
  }
  if (!data?.length) {
    return <p className="text-muted">Aucune famille dans le référentiel.</p>
  }
  if (filtered.length === 0) {
    return <p className="text-muted">Aucun résultat pour ces filtres.</p>
  }

  return (
    <ul className="catalogue-tree" aria-label="Arbre du catalogue BTP">
      {filtered.map((f) => (
        <FamilleNode
          key={f.id}
          f={f}
          onSelectArticle={onSelectArticle}
          linkToArticleFiche={linkToArticleFiche}
        />
      ))}
    </ul>
  )
}
