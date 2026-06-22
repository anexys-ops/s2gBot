import { Link } from 'react-router-dom'
import type { RefArticleProductJalonRow } from '../../api/client'

type Props = {
  jalons: RefArticleProductJalonRow[]
}

export default function ProductJalonsPanel({ jalons }: Props) {
  if (jalons.length === 0) {
    return (
      <section className="card" style={{ padding: '1rem' }}>
        <h3 className="h6" style={{ marginTop: 0 }}>Jalons liés</h3>
        <p className="text-muted">Aucun jalon ne référence ce produit.</p>
      </section>
    )
  }

  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1rem 0.5rem' }}>
        <h3 className="h6" style={{ margin: 0 }}>Jalons liés</h3>
        <p className="text-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
          {jalons.length} jalon{jalons.length > 1 ? 's' : ''} référencent ce produit.
        </p>
      </div>
      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th>Code</th>
              <th>Libellé</th>
              <th>Famille S2G</th>
            </tr>
          </thead>
          <tbody>
            {jalons.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.jalon ? (
                    <Link to={`/catalogue/articles/${row.jalon.id}`}>
                      <code>{row.jalon.code}</code>
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{row.jalon?.libelle ?? '—'}</td>
                <td className="text-muted">{row.jalon?.famille_label?.trim() || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
