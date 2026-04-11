import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../../api/client'

export default function ReportDelaiChantierPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => statsApi.dashboard(),
  })

  if (isLoading) return <p>Chargement des indicateurs…</p>
  if (error) return <p className="error">{(error as Error).message}</p>
  if (!data) return null

  const d = data.delays

  return (
    <div className="report-page">
      <p className="report-page__back">
        <Link to="/">← Accueil</Link>
      </p>
      <header className="report-page__head">
        <p className="hub-kicker">Rapports</p>
        <h1>Délais chantier & planning</h1>
        <p className="report-page__lead">
          Cycles sur les commandes (date de livraison prévisionnelle) et sur les devis (livraison chantier prévue vs date de devis).
        </p>
      </header>

      <div className="report-kpi-grid report-kpi-grid--2">
        <div className="card report-delay-card">
          <h2>Cycle commande (livraison)</h2>
          <p className="report-muted">Jours entre la date de commande et la date de livraison renseignée sur la commande.</p>
          <dl className="report-delay-dl">
            <div>
              <dt>Moyenne</dt>
              <dd>{d.order_delivery_cycle_days_avg != null ? `${d.order_delivery_cycle_days_avg} j` : '—'}</dd>
            </div>
            <div>
              <dt>Médiane</dt>
              <dd>{d.order_delivery_cycle_days_median != null ? `${d.order_delivery_cycle_days_median} j` : '—'}</dd>
            </div>
            <div>
              <dt>Effectif</dt>
              <dd>{d.order_delivery_cycle_sample_size} commandes</dd>
            </div>
          </dl>
        </div>
        <div className="card report-delay-card">
          <h2>Planning devis → livraison chantier</h2>
          <p className="report-muted">Jours entre la date du devis et la date de livraison chantier indiquée sur le devis.</p>
          <dl className="report-delay-dl">
            <div>
              <dt>Moyenne</dt>
              <dd>{d.quote_to_site_delivery_days_avg != null ? `${d.quote_to_site_delivery_days_avg} j` : '—'}</dd>
            </div>
            <div>
              <dt>Médiane</dt>
              <dd>{d.quote_to_site_delivery_days_median != null ? `${d.quote_to_site_delivery_days_median} j` : '—'}</dd>
            </div>
            <div>
              <dt>Effectif</dt>
              <dd>{d.quote_planning_sample_size} devis</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card">
        <h2>Chantiers suivis</h2>
        <p>
          <strong>{data.counts.sites}</strong> fiche(s) chantier dans le périmètre,{' '}
          <strong>{data.counts.orders}</strong> commande(s) associée(s).
        </p>
      </div>
    </div>
  )
}
