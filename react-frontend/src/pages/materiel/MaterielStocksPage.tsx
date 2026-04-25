import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { commercialOfferingsApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { formatMoney } from '../../lib/appLocale'

export default function MaterielStocksPage() {
  const [search, setSearch] = useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['commercial-offerings', 'stocks'],
    queryFn: () => commercialOfferingsApi.list({ per_page: 200 }),
  })

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data?.data ?? [])
      .filter((row) => row.track_stock)
      .filter((row) => {
        if (!term) return true
        return [row.code, row.name, row.unit, row.equipment?.name, row.equipment?.code]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [data?.data, search])

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Matériel', to: '/materiel' },
        { label: 'Stocks' },
      ]}
      moduleBarLabel="Matériel"
      title="Stocks"
      subtitle="Tableau des produits et consommables suivis en stock."
    >
      <div className="card" style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', maxWidth: 420 }}>
          Recherche stock
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, libellé, unité, matériel lié…"
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>
      </div>
      {isLoading && <p className="text-muted">Chargement des stocks…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      {!isLoading && !error && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Article / consommable</th>
                  <th>Unité</th>
                  <th>Quantité stock</th>
                  <th>Prix vente HT</th>
                  <th>Matériel lié</th>
                  <th>Actif</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><code>{row.code ?? '—'}</code></td>
                    <td>
                      <strong>{row.name}</strong>
                      {row.description && <div className="text-muted" style={{ fontSize: '0.82rem' }}>{row.description}</div>}
                    </td>
                    <td>{row.unit ?? '—'}</td>
                    <td>{Number(row.stock_quantity).toFixed(Number(row.stock_quantity) % 1 ? 3 : 0)}</td>
                    <td>{formatMoney(Number(row.sale_price_ht))}</td>
                    <td>
                      {row.equipment ? (
                        <Link to={`/materiel/equipements/${row.equipment.id}`} className="link-inline">
                          {row.equipment.code} — {row.equipment.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{row.active ? 'Oui' : 'Non'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <p style={{ padding: '1rem' }}>Aucun stock suivi.</p>}
        </div>
      )}
    </ModuleEntityShell>
  )
}
