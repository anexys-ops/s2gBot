import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { statsApi } from '../api/client'

function euros(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data: dash, isLoading: dashLoading, error: dashError } = useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => statsApi.dashboard(),
  })
  const { data: essais, isLoading: essaisLoading } = useQuery({
    queryKey: ['stats', 'essais'],
    queryFn: () => statsApi.essais(),
  })

  const ev = essais?.evolution ?? []
  const maxEv = Math.max(1, ...ev.map((x) => x.count))

  return (
    <div className="dashboard-home dashboard-home--v2">
      <header className="dashboard-hero">
        <p className="hub-kicker">Lab BTP</p>
        <h1>Bienvenue, {user?.name}</h1>
        <p className="dashboard-tagline">
          Tableau de bord : indicateurs commerciaux, laboratoire et délais — accès rapides CRM, terrain et rapports
          détaillés.
        </p>
      </header>

      {dashLoading && <p className="dashboard-loading">Chargement des statistiques…</p>}
      {dashError && <p className="error">{(dashError as Error).message}</p>}

      {dash && (
        <>
          <section className="dashboard-section">
            <h2 className="dashboard-section__title">Indicateurs clés</h2>
            <div className="dashboard-kpi-grid">
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Clients</span>
                <strong>{dash.counts.clients}</strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Chantiers</span>
                <strong>{dash.counts.sites}</strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Commandes</span>
                <strong>{dash.counts.orders}</strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Devis</span>
                <strong>{dash.counts.quotes}</strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Factures</span>
                <strong>{dash.counts.invoices}</strong>
              </div>
              <div className="dashboard-kpi dashboard-kpi--accent">
                <span className="dashboard-kpi__label">CA facturé TTC</span>
                <strong>{euros(dash.amounts.invoices_ttc_total)}</strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Encaissé</span>
                <strong>{euros(dash.amounts.invoices_ttc_paid)}</strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Reste à encaisser</span>
                <strong>{euros(dash.amounts.invoices_ttc_unpaid)}</strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Rapports PDF</span>
                <strong>{dash.counts.reports_total}</strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Attente validation</span>
                <strong>{dash.counts.reports_pending_review}</strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Échantillons</span>
                <strong>{dash.counts.samples_total}</strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Délai moy. → 1er rapport</span>
                <strong>
                  {dash.delays.order_to_first_report_days_avg != null
                    ? `${dash.delays.order_to_first_report_days_avg} j`
                    : '—'}
                </strong>
              </div>
              <div className="dashboard-kpi">
                <span className="dashboard-kpi__label">Cycle moy. commande → livraison</span>
                <strong>
                  {dash.delays.order_delivery_cycle_days_avg != null
                    ? `${dash.delays.order_delivery_cycle_days_avg} j`
                    : '—'}
                </strong>
              </div>
            </div>
          </section>

          <section className="dashboard-section">
            <h2 className="dashboard-section__title">Rapports & analyses</h2>
            <div className="dashboard-report-links">
              <Link to="/rapports/compta" className="dashboard-report-link">
                Rapport compta
              </Link>
              <Link to="/rapports/ventes" className="dashboard-report-link">
                Stats ventes & rapports
              </Link>
              <Link to="/rapports/delai-traitement" className="dashboard-report-link">
                Délais de traitement labo
              </Link>
              <Link to="/rapports/delai-chantier" className="dashboard-report-link">
                Délais chantier & planning
              </Link>
            </div>
          </section>

          <section className="dashboard-section">
            <h2 className="dashboard-section__title">CA facturé par mois</h2>
            <div className="card dashboard-mini-chart">
              {dash.ca_par_mois.length === 0 ? (
                <p className="report-muted">Aucune donnée.</p>
              ) : (
                <div className="report-bars">
                  {(() => {
                    const maxCa = Math.max(0.01, ...dash.ca_par_mois.map((x) => x.ca_ttc))
                    return dash.ca_par_mois.map((row) => (
                      <div key={row.mois} className="report-bar-row">
                        <span className="report-bar-label">{row.mois}</span>
                        <div className="report-bar-track">
                          <div className="report-bar-fill report-bar-fill--soft" style={{ width: `${(row.ca_ttc / maxCa) * 100}%` }} />
                        </div>
                        <span className="report-bar-value">{euros(row.ca_ttc)}</span>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className="dashboard-section">
        <h2 className="dashboard-section__title">Activité essais (volume)</h2>
        <div className="card dashboard-mini-chart">
          {essaisLoading ? (
            <p className="report-muted">Chargement…</p>
          ) : ev.length === 0 ? (
            <p className="report-muted">Pas encore d&apos;historique d&apos;essais.</p>
          ) : (
            <div className="report-bars">
              {ev.map((row) => (
                <div key={row.mois} className="report-bar-row">
                  <span className="report-bar-label">{row.mois}</span>
                  <div className="report-bar-track">
                    <div
                      className="report-bar-fill report-bar-fill--teal"
                      style={{ width: `${(row.count / maxEv) * 100}%` }}
                    />
                  </div>
                  <span className="report-bar-value">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="dashboard-split">
        <Link to="/crm" className="dashboard-panel dashboard-panel--crm dashboard-panel--v2">
          <span className="dashboard-panel-emoji" aria-hidden>
            🤝
          </span>
          <span className="dashboard-panel-label">CRM</span>
          <strong>Commercial & clients</strong>
          <span className="dashboard-panel-hint">
            Clients, chantiers, devis, factures, mails et PDF — avec champs et indicateurs personnalisables sur les
            fiches.
          </span>
        </Link>
        <Link to="/terrain" className="dashboard-panel dashboard-panel--terrain dashboard-panel--v2">
          <span className="dashboard-panel-emoji" aria-hidden>
            🔬
          </span>
          <span className="dashboard-panel-label">Terrain & labo</span>
          <strong>Prise de mesure & dossiers</strong>
          <span className="dashboard-panel-hint">
            Commandes, missions, forages, granulométrie et rapports — métadonnées disponibles sur commandes et missions.
          </span>
        </Link>
      </div>

      <p className="dashboard-shortcuts-title">Accès rapides</p>
      <div className="dashboard-shortcuts">
        <Link to="/orders" className="btn btn-secondary">
          Commandes
        </Link>
        <Link to="/back-office/catalogue-essais" className="btn btn-secondary">
          Catalogue essais
        </Link>
        <Link to="/invoices" className="btn btn-secondary">
          Factures
        </Link>
        <Link to="/graphiques-essais" className="btn btn-secondary">
          Graphiques essais
        </Link>
      </div>
    </div>
  )
}
