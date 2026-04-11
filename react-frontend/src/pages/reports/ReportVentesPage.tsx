import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../../api/client'

function euros(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function ReportVentesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => statsApi.dashboard(),
  })

  if (isLoading) return <p>Chargement des indicateurs…</p>
  if (error) return <p className="error">{(error as Error).message}</p>
  if (!data) return null

  const { counts, amounts } = data

  return (
    <div className="report-page">
      <header className="report-page__head">
        <p className="hub-kicker">Rapports</p>
        <h1>Statistiques de ventes & rapports</h1>
        <p className="report-page__lead">
          Volume commercial (devis, commandes), funnel laboratoire (échantillons, rapports PDF) et potentiel attaché aux devis ouverts.
        </p>
      </header>

      <div className="report-kpi-grid">
        <div className="report-kpi">
          <span className="report-kpi__label">Devis (nombre)</span>
          <strong className="report-kpi__value">{counts.quotes}</strong>
        </div>
        <div className="report-kpi report-kpi--accent">
          <span className="report-kpi__label">Montant TTC devis ouverts</span>
          <strong className="report-kpi__value">{euros(amounts.quotes_open_ttc)}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Commandes</span>
          <strong className="report-kpi__value">{counts.orders}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Clients</span>
          <strong className="report-kpi__value">{counts.clients}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Chantiers</span>
          <strong className="report-kpi__value">{counts.sites}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Rapports PDF générés</span>
          <strong className="report-kpi__value">{counts.reports_total}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">En attente validation</span>
          <strong className="report-kpi__value">{counts.reports_pending_review}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Rapports validés</span>
          <strong className="report-kpi__value">{counts.reports_approved}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Échantillons</span>
          <strong className="report-kpi__value">{counts.samples_total}</strong>
        </div>
      </div>

      <div className="card">
        <h2>Commandes par statut</h2>
        <ul className="report-status-list">
          {Object.entries(counts.orders_by_status).map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Devis par statut</h2>
        <ul className="report-status-list">
          {Object.entries(counts.quotes_by_status).map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Échantillons par statut</h2>
        <ul className="report-status-list">
          {Object.entries(counts.samples_by_status).map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
