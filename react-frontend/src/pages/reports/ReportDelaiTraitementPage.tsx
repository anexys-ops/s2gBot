import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../../api/client'

export default function ReportDelaiTraitementPage() {
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
        <h1>Délais de traitement laboratoire</h1>
        <p className="report-page__lead">
          Délais entre la commande et le premier rapport PDF, et entre la commande et la réception des échantillons au labo.
        </p>
      </header>

      <div className="report-kpi-grid report-kpi-grid--2">
        <div className="card report-delay-card">
          <h2>Commande → 1er rapport PDF</h2>
          <p className="report-muted">Jours entre la date de commande et la première génération de rapport.</p>
          <dl className="report-delay-dl">
            <div>
              <dt>Moyenne</dt>
              <dd>{d.order_to_first_report_days_avg != null ? `${d.order_to_first_report_days_avg} j` : '—'}</dd>
            </div>
            <div>
              <dt>Médiane</dt>
              <dd>{d.order_to_first_report_days_median != null ? `${d.order_to_first_report_days_median} j` : '—'}</dd>
            </div>
            <div>
              <dt>Effectif</dt>
              <dd>{d.order_to_first_report_sample_size} dossiers</dd>
            </div>
          </dl>
        </div>
        <div className="card report-delay-card">
          <h2>Réception des échantillons</h2>
          <p className="report-muted">Jours entre la date de commande et la date de réception (`received_at`).</p>
          <dl className="report-delay-dl">
            <div>
              <dt>Moyenne</dt>
              <dd>{d.sample_reception_days_avg != null ? `${d.sample_reception_days_avg} j` : '—'}</dd>
            </div>
            <div>
              <dt>Médiane</dt>
              <dd>{d.sample_reception_days_median != null ? `${d.sample_reception_days_median} j` : '—'}</dd>
            </div>
            <div>
              <dt>Effectif</dt>
              <dd>{d.sample_reception_sample_size} échantillons</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card">
        <h2>File d&apos;attente validation des rapports</h2>
        <p>
          <strong>{data.counts.reports_pending_review}</strong> rapport(s) en attente de validation,{' '}
          <strong>{data.counts.reports_approved}</strong> déjà validé(s).
        </p>
      </div>
    </div>
  )
}
