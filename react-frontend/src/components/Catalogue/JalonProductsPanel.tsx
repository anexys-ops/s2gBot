import { Link } from 'react-router-dom'
import type { RefArticleJalonProductRow } from '../../api/client'
import { formatRefArticlePrice } from '../../lib/catalogueFormat'

type Props = {
  products: RefArticleJalonProductRow[]
}

export default function JalonProductsPanel({ products }: Props) {
  if (products.length === 0) {
    return (
      <section className="card" style={{ padding: '1rem' }}>
        <h3 className="h6" style={{ marginTop: 0 }}>Produits du jalon</h3>
        <p className="text-muted">Aucun produit rattaché à ce jalon.</p>
      </section>
    )
  }

  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1rem 0.5rem' }}>
        <h3 className="h6" style={{ margin: 0 }}>Produits du jalon</h3>
        <p className="text-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
          {products.length} produit{products.length > 1 ? 's' : ''} — ordre d’affichage legacy S2G.
        </p>
      </div>
      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th style={{ width: '3rem' }}>#</th>
              <th>Code</th>
              <th>Libellé</th>
              <th>Tâche</th>
              <th>Unité</th>
              <th>PU HT</th>
            </tr>
          </thead>
          <tbody>
            {products.map((row) => (
              <tr key={row.id}>
                <td className="text-muted">{row.ordre}</td>
                <td>
                  {row.product ? (
                    <Link to={`/catalogue/articles/${row.product.id}`}>
                      <code>{row.product.code}</code>
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{row.product?.libelle ?? '—'}</td>
                <td className="text-muted">
                  {row.tache_code ? (
                    <>
                      <code>{row.tache_code}</code>
                      {row.tache_label ? <span> — {row.tache_label}</span> : null}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{row.product?.unite?.trim() ? row.product.unite : '—'}</td>
                <td>{row.product ? formatRefArticlePrice(row.product) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
