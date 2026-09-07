import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { statsApi } from '../../api/client'
import { QUOTE_STATUS_LABELS } from '../../lib/commercialStatusLabels'
import { formatMoney } from '../../lib/appLocale'

function formatDays(value: number | null | undefined): string {
  return value != null ? `${value} j` : '—'
}

function DelayCard({
  title,
  description,
  metric,
}: {
  title: string
  description: string
  metric: { avg: number | null; median: number | null; sample_size: number }
}) {
  return (
    <div className="card report-delay-card">
      <h2>{title}</h2>
      <p className="report-muted">{description}</p>
      <dl className="report-delay-dl">
        <div>
          <dt>Moyenne</dt>
          <dd>{formatDays(metric.avg)}</dd>
        </div>
        <div>
          <dt>Médiane</dt>
          <dd>{formatDays(metric.median)}</dd>
        </div>
        <div>
          <dt>Effectif</dt>
          <dd>{metric.sample_size}</dd>
        </div>
      </dl>
    </div>
  )
}

function TeamList({
  title,
  count,
  people,
}: {
  title: string
  count: number
  people: Array<{
    id: number
    name: string
    poste_label: string
    affectations_count?: number
  }>
}) {
  return (
    <div className="card">
      <h2>
        {title} <span className="report-kpi-inline">({count} actif{count > 1 ? 's' : ''})</span>
      </h2>
      {people.length === 0 ? (
        <p className="report-muted">Aucune affectation planifiée aujourd&apos;hui.</p>
      ) : (
        <ul className="report-team-list">
          {people.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>
              <span>{p.poste_label}</span>
              <span className="report-muted">
                {p.affectations_count ?? 0} affectation{(p.affectations_count ?? 0) > 1 ? 's' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ReportKpiPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats', 'kpi'],
    queryFn: () => statsApi.kpi(),
  })

  if (isLoading) return <p>Chargement des indicateurs…</p>
  if (error) return <p className="error">{(error as Error).message}</p>
  if (!data) return null

  const { devis_ouverts, equipes, volumes, delais_chaine, essais } = data
  const totalAlert7j = essais.depassant_7j + essais.en_cours_depasse_7j
  const totalAlert2j = essais.depassant_2j + essais.en_cours_depasse_2j

  return (
    <div className="report-page">
      <header className="report-page__head">
        <p className="hub-kicker">Rapports</p>
        <h1>Tableau de bord KPI</h1>
        <p className="report-page__lead">
          Synthèse commerciale, équipes en activité, délais entre dossier, devis, BC, BL, facture et rapport, plus suivi
          des essais avec alertes.
        </p>
      </header>

      {(totalAlert7j > 0 || totalAlert2j > 0) && (
        <section className="report-alerts" aria-label="Alertes essais">
          {totalAlert7j > 0 && (
            <div className="report-alert report-alert--critical">
              <strong>{totalAlert7j} essai(s) &gt; 7 jours</strong>
              <span>Dont {essais.en_cours_depasse_7j} encore en cours au labo.</span>
            </div>
          )}
          {totalAlert2j > 0 && (
            <div className="report-alert report-alert--warning">
              <strong>{totalAlert2j} essai(s) &gt; 2 jours</strong>
              <span>Dont {essais.en_cours_depasse_2j} encore en cours au labo.</span>
            </div>
          )}
        </section>
      )}

      <div className="report-kpi-grid">
        <div className="report-kpi report-kpi--accent">
          <span className="report-kpi__label">Devis ouverts</span>
          <strong className="report-kpi__value">{devis_ouverts.count}</strong>
        </div>
        <div className="report-kpi report-kpi--accent">
          <span className="report-kpi__label">Montant TTC devis ouverts</span>
          <strong className="report-kpi__value">{formatMoney(devis_ouverts.montant_ttc)}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Dossiers</span>
          <strong className="report-kpi__value">{volumes.dossiers}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Chantiers</span>
          <strong className="report-kpi__value">{volumes.chantiers}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Bons de commande</span>
          <strong className="report-kpi__value">{volumes.bons_commande}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Bons de livraison</span>
          <strong className="report-kpi__value">{volumes.bons_livraison}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Rapports labo</span>
          <strong className="report-kpi__value">{volumes.rapports_labo}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Durée moyenne essais</span>
          <strong className="report-kpi__value">{formatDays(essais.duree_moyenne_jours)}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Essais &gt; 7 jours</span>
          <strong className="report-kpi__value report-kpi__value--alert">
            {essais.depassant_7j + essais.en_cours_depasse_7j}
          </strong>
        </div>
      </div>

      <div className="card">
        <h2>Devis ouverts — récapitulatif</h2>
        <ul className="report-status-list">
          {Object.entries(devis_ouverts.par_statut).map(([k, v]) => (
            <li key={k}>
              <span>{QUOTE_STATUS_LABELS[k] ?? k}</span>
              <strong>{v}</strong>
            </li>
          ))}
        </ul>
        {devis_ouverts.liste.length > 0 && (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Client</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>TTC</th>
                </tr>
              </thead>
              <tbody>
                {devis_ouverts.liste.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link to={`/crm/documents?tab=quotes`}>{q.number ?? `#${q.id}`}</Link>
                    </td>
                    <td>{q.client_name ?? '—'}</td>
                    <td>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</td>
                    <td>{q.quote_date ?? '—'}</td>
                    <td>{formatMoney(q.amount_ttc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="report-kpi-grid report-kpi-grid--2">
        <TeamList title="Techniciens terrain" count={equipes.terrain.actifs} people={equipes.terrain.personnes} />
        <TeamList title="Équipe laboratoire" count={equipes.labo.actifs} people={equipes.labo.personnes} />
        <TeamList title="Ingénieurs & responsables" count={equipes.ingenieurs.actifs} people={equipes.ingenieurs.personnes} />
      </div>

      <header className="report-section-head">
        <h2>Délais entre étapes du cycle dossier</h2>
        <p className="report-muted">Moyennes calculées sur les dossiers ayant les deux dates renseignées.</p>
      </header>

      <div className="report-kpi-grid report-kpi-grid--2">
        <DelayCard
          title="Dossier → BC"
          description="Jours entre l'ouverture du dossier et la date de commande du bon de commande."
          metric={delais_chaine.dossier_bc}
        />
        <DelayCard
          title="Devis → BC"
          description="Jours entre la date du devis et la transformation en bon de commande."
          metric={delais_chaine.devis_bc}
        />
        <DelayCard
          title="BC → BL"
          description="Jours entre la commande et la première livraison enregistrée."
          metric={delais_chaine.bc_bl}
        />
        <DelayCard
          title="BL → Facture"
          description="Jours entre la livraison et la première facture liée au BC."
          metric={delais_chaine.bl_facture}
        />
        <DelayCard
          title="Facture → Paiement"
          description="Jours entre la date de facture et le premier règlement enregistré."
          metric={delais_chaine.facture_paiement}
        />
        <DelayCard
          title="BC → Rapport labo"
          description="Jours entre la commande et l'émission (ou signature) du rapport d'essais."
          metric={delais_chaine.bc_rapport}
        />
        <DelayCard
          title="Devis → livraison chantier"
          description="Jours entre la date du devis et la livraison chantier prévue sur le devis."
          metric={delais_chaine.devis_livraison_chantier}
        />
      </div>

      <div className="card">
        <h2>Essais — délais et alertes</h2>
        <dl className="report-delay-dl report-delay-dl--inline">
          <div>
            <dt>Durée moyenne</dt>
            <dd>{formatDays(essais.duree_moyenne_jours)}</dd>
          </div>
          <div>
            <dt>Médiane</dt>
            <dd>{formatDays(essais.duree_mediane_jours)}</dd>
          </div>
          <div>
            <dt>Effectif terminés</dt>
            <dd>{essais.sample_size}</dd>
          </div>
          <div>
            <dt>&gt; 2 jours (terminés)</dt>
            <dd className="report-text-warning">{essais.depassant_2j}</dd>
          </div>
          <div>
            <dt>&gt; 7 jours (terminés)</dt>
            <dd className="report-text-critical">{essais.depassant_7j}</dd>
          </div>
          <div>
            <dt>En cours &gt; 2 j</dt>
            <dd className="report-text-warning">{essais.en_cours_depasse_2j}</dd>
          </div>
          <div>
            <dt>En cours &gt; 7 j</dt>
            <dd className="report-text-critical">{essais.en_cours_depasse_7j}</dd>
          </div>
        </dl>

        {essais.alertes.length > 0 && (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Échantillon</th>
                  <th>Dossier</th>
                  <th>Statut</th>
                  <th>Durée</th>
                  <th>Alerte</th>
                </tr>
              </thead>
              <tbody>
                {essais.alertes.map((a) => (
                  <tr key={a.sample_id} className={`report-row--${a.niveau}`}>
                    <td>{a.fold_number ?? a.transco_number ?? a.reference ?? `#${a.sample_id}`}</td>
                    <td>{a.dossier_reference ?? '—'}</td>
                    <td>{a.en_cours ? 'En essai' : a.status}</td>
                    <td>{a.jours} j</td>
                    <td>
                      <span className={`report-badge report-badge--${a.niveau}`}>
                        {a.niveau === 'critical' ? '> 7 j' : '> 2 j'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
