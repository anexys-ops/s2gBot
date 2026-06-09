import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { RefArticleRow } from '../../api/client'
import StatusBadge from '../ds/StatusBadge'
import { formatRefArticlePrice, formatTvaPercent } from '../../lib/catalogueFormat'

type Props = {
  articles: RefArticleRow[]
  isLoading?: boolean
  visibleColumns: Record<string, boolean>
}

function sortArticles(articles: RefArticleRow[]): RefArticleRow[] {
  return [...articles].sort((a, b) => {
    const oa = a.famille?.ordre ?? 999
    const ob = b.famille?.ordre ?? 999
    if (oa !== ob) return oa - ob
    const fc = (a.famille?.code ?? '').localeCompare(b.famille?.code ?? '', 'fr')
    if (fc !== 0) return fc
    return a.code.localeCompare(b.code, 'fr', { sensitivity: 'base' })
  })
}

export default function CatalogueProlabTable({ articles, isLoading, visibleColumns }: Props) {
  const navigate = useNavigate()
  const sorted = useMemo(() => sortArticles(articles), [articles])

  if (isLoading) {
    return <p className="text-muted">Chargement des articles…</p>
  }

  if (sorted.length === 0) {
    return <p className="text-muted catalogue-prolab-table__empty">Aucun article ne correspond aux filtres.</p>
  }

  return (
    <div className="card catalogue-prolab-table" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              {visibleColumns.code !== false && <th>Code</th>}
              {visibleColumns.libelle !== false && <th>Libellé</th>}
              {visibleColumns.famille !== false && <th>Famille</th>}
              {visibleColumns.unite !== false && <th>Unité</th>}
              {visibleColumns.prix !== false && <th>PU HT</th>}
              {visibleColumns.tva !== false && <th>TVA</th>}
              {visibleColumns.statut !== false && <th>Statut</th>}
              {visibleColumns.actions !== false && <th className="data-table__actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr
                key={a.id}
                className="table-row-link"
                onClick={(e) => {
                  const t = e.target as HTMLElement
                  if (t.closest('a, button')) return
                  navigate(`/catalogue/articles/${a.id}`)
                }}
              >
                {visibleColumns.code !== false && (
                  <td>
                    <Link to={`/catalogue/articles/${a.id}`} onClick={(e) => e.stopPropagation()}>
                      <code>{a.code}</code>
                    </Link>
                  </td>
                )}
                {visibleColumns.libelle !== false && <td>{a.libelle}</td>}
                {visibleColumns.famille !== false && (
                  <td>
                    {a.famille ? (
                      <>
                        <code>{a.famille.code}</code>
                        <span className="text-muted"> {a.famille.libelle}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
                {visibleColumns.unite !== false && <td>{a.unite?.trim() ? a.unite : '—'}</td>}
                {visibleColumns.prix !== false && <td>{formatRefArticlePrice(a)}</td>}
                {visibleColumns.tva !== false && (
                  <td className="text-muted">{formatTvaPercent(a.tva_rate)}</td>
                )}
                {visibleColumns.statut !== false && (
                  <td className="data-table__status">
                    <StatusBadge variant={a.actif ? 'success' : 'neutral'} size="sm">
                      {a.actif ? 'Actif' : 'Inactif'}
                    </StatusBadge>
                  </td>
                )}
                {visibleColumns.actions !== false && (
                  <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/catalogue/articles/${a.id}`} className="btn btn-secondary btn-sm">
                      Fiche
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
