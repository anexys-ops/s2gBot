import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../../api/client'

function euros(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function ReportComptaPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => statsApi.dashboard(),
  })

  if (isLoading) return <p>Chargement des indicateurs…</p>
  if (error) return <p className="error">{(error as Error).message}</p>
  if (!data) return null

  const { amounts, counts, ca_par_mois } = data
  const maxCa = Math.max(0.01, ...ca_par_mois.map((x) => x.ca_ttc))

  return (
    <div className="report-page">
      <p className="report-page__back">
        <Link to="/">← Accueil</Link>
      </p>
      <header className="report-page__head">
        <p className="hub-kicker">Rapports</p>
        <h1>Rapport comptabilité</h1>
        <p className="report-page__lead">
          Synthèse facturation : encours, encaissé et évolution du chiffre d&apos;affaires facturé par mois.
        </p>
      </header>

      <div className="report-kpi-grid">
        <div className="report-kpi">
          <span className="report-kpi__label">Factures TTC (périmètre)</span>
          <strong className="report-kpi__value">{euros(amounts.invoices_ttc_total)}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Encaissé (statut payée)</span>
          <strong className="report-kpi__value">{euros(amounts.invoices_ttc_paid)}</strong>
        </div>
        <div className="report-kpi report-kpi--accent">
          <span className="report-kpi__label">Reste à encaisser</span>
          <strong className="report-kpi__value">{euros(amounts.invoices_ttc_unpaid)}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Pipeline devis (hors clos)</span>
          <strong className="report-kpi__value">{euros(amounts.quotes_open_ttc)}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Nombre de factures</span>
          <strong className="report-kpi__value">{counts.invoices}</strong>
        </div>
      </div>

      <div className="card report-chart-card">
        <h2>CA facturé par mois (TTC)</h2>
        {ca_par_mois.length === 0 ? (
          <p className="report-muted">Aucune facture sur la période enregistrée.</p>
        ) : (
          <div className="report-bars" role="img" aria-label="Histogramme CA par mois">
            {ca_par_mois.map((row) => (
              <div key={row.mois} className="report-bar-row">
                <span className="report-bar-label">{row.mois}</span>
                <div className="report-bar-track">
                  <div
                    className="report-bar-fill"
                    style={{ width: `${(row.ca_ttc / maxCa) * 100}%` }}
                    title={euros(row.ca_ttc)}
                  />
                </div>
                <span className="report-bar-value">{euros(row.ca_ttc)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Répartition factures par statut</h2>
        <ul className="report-status-list">
          {Object.entries(counts.invoices_by_status).map(([k, v]) => (
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
