import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { OutlineIcon } from '../components/OutlineIcons'
import { useAuth } from '../contexts/AuthContext'
import { statsApi, type DashboardStatsPayload } from '../api/client'
import { INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS } from '../lib/commercialStatusLabels'
import { formatMoney } from '../lib/appLocale'

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Envoyée',
  in_progress: 'En cours',
  completed: 'Terminée',
}

const SAMPLE_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  received: 'Reçu',
  in_progress: 'En cours',
  tested: 'Testé',
  validated: 'Validé',
}

type MetierTab = 'commerce' | 'compta' | 'labo'

type KpiId =
  | 'clients'
  | 'sites'
  | 'orders'
  | 'quotes'
  | 'invoices_count'
  | 'pipeline_quotes_ttc'
  | 'ca_ttc'
  | 'encaisse'
  | 'impayes'
  | 'reports_total'
  | 'reports_pending'
  | 'samples'
  | 'delay_first_report'
  | 'delay_cycle'

function statusRows(record: Record<string, number>, labels: Record<string, string>) {
  return Object.entries(record)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({ key: k, label: labels[k] ?? k, count: n }))
}

function KpiTile({
  id,
  label,
  value,
  accent,
  selected,
  onToggle,
}: {
  id: KpiId
  label: string
  value: string
  accent?: boolean
  selected: boolean
  onToggle: (id: KpiId) => void
}) {
  return (
    <button
      type="button"
      className={`dashboard-kpi dashboard-kpi--tile${accent ? ' dashboard-kpi--accent' : ''}${selected ? ' dashboard-kpi--tile-open' : ''}`}
      aria-expanded={selected}
      onClick={() => onToggle(id)}
    >
      <span className="dashboard-kpi__label">{label}</span>
      <strong>{value}</strong>
      <span className="dashboard-kpi__hint">{selected ? 'Masquer le détail' : 'Voir le détail'}</span>
    </button>
  )
}

function KpiDetail({ children }: { children: React.ReactNode }) {
  return <div className="dashboard-kpi-detail card">{children}</div>
}

function renderKpiDetail(id: KpiId, dash: DashboardStatsPayload) {
  switch (id) {
    case 'clients':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Clients</h3>
          <p className="dashboard-kpi-detail__text">
            Nombre de fiches clients enregistrées (tiers). Utilisez la liste pour rechercher, filtrer et ouvrir une fiche
            (onglets Commerce, Documents…).
          </p>
          <Link to="/clients" className="btn btn-secondary btn-sm">
            Ouvrir la liste des clients
          </Link>
        </KpiDetail>
      )
    case 'sites':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Chantiers</h3>
          <p className="dashboard-kpi-detail__text">
            Chantiers liés aux clients (missions, carte, forages selon votre paramétrage).
          </p>
          <Link to="/sites" className="btn btn-secondary btn-sm">
            Ouvrir les chantiers
          </Link>
        </KpiDetail>
      )
    case 'orders':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Commandes par statut</h3>
          {statusRows(dash.counts.orders_by_status, ORDER_STATUS_LABELS).length === 0 ? (
            <p className="report-muted">Aucune commande.</p>
          ) : (
            <table className="dashboard-kpi-detail__table">
              <tbody>
                {statusRows(dash.counts.orders_by_status, ORDER_STATUS_LABELS).map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td className="dashboard-kpi-detail__num">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link to="/orders" className="btn btn-secondary btn-sm dashboard-kpi-detail__action">
            Liste des commandes
          </Link>
        </KpiDetail>
      )
    case 'quotes':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Devis par statut</h3>
          {statusRows(dash.counts.quotes_by_status, QUOTE_STATUS_LABELS).length === 0 ? (
            <p className="report-muted">Aucun devis.</p>
          ) : (
            <table className="dashboard-kpi-detail__table">
              <tbody>
                {statusRows(dash.counts.quotes_by_status, QUOTE_STATUS_LABELS).map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td className="dashboard-kpi-detail__num">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="dashboard-kpi-detail__meta">
            Montant TTC des devis encore ouverts (hors facturés / perdus / refusés) :{' '}
            <strong>{formatMoney(dash.amounts.quotes_open_ttc)}</strong>
          </p>
          <Link to="/devis" className="btn btn-secondary btn-sm dashboard-kpi-detail__action">
            Liste des devis
          </Link>
        </KpiDetail>
      )
    case 'invoices_count':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Factures par statut (volume)</h3>
          {statusRows(dash.counts.invoices_by_status, INVOICE_STATUS_LABELS).length === 0 ? (
            <p className="report-muted">Aucune facture.</p>
          ) : (
            <table className="dashboard-kpi-detail__table">
              <tbody>
                {statusRows(dash.counts.invoices_by_status, INVOICE_STATUS_LABELS).map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td className="dashboard-kpi-detail__num">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="dashboard-kpi-detail__meta">
            Les montants TTC (CA, encaissement, impayés) sont dans l’onglet <strong>Compta</strong>.
          </p>
          <Link to="/invoices" className="btn btn-secondary btn-sm dashboard-kpi-detail__action">
            Liste des factures
          </Link>
        </KpiDetail>
      )
    case 'pipeline_quotes_ttc':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Pipeline devis (TTC)</h3>
          <p className="dashboard-kpi-detail__text">
            Somme TTC des devis considérés comme encore « ouverts » côté métier (non facturés, non perdus, non refusés).
            Détail des statuts dans la tuile <strong>Devis</strong>.
          </p>
          <p className="dashboard-kpi-detail__meta">
            Montant : <strong>{formatMoney(dash.amounts.quotes_open_ttc)}</strong>
          </p>
          <Link to="/devis" className="btn btn-secondary btn-sm">
            Voir les devis
          </Link>
        </KpiDetail>
      )
    case 'ca_ttc':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Chiffre d’affaires facturé</h3>
          <ul className="dashboard-kpi-detail__list">
            <li>
              Total facturé TTC (toutes factures) : <strong>{formatMoney(dash.amounts.invoices_ttc_total)}</strong>
            </li>
            <li>
              Déjà encaissé (statut payé) : <strong>{formatMoney(dash.amounts.invoices_ttc_paid)}</strong>
            </li>
            <li>
              Reste à encaisser : <strong>{formatMoney(dash.amounts.invoices_ttc_unpaid)}</strong>
            </li>
            <li>
              Devis ouverts (TTC) : <strong>{formatMoney(dash.amounts.quotes_open_ttc)}</strong>
            </li>
          </ul>
          <p className="dashboard-kpi-detail__text">
            L’histogramme « CA par mois » se trouve sous les tuiles dans cet onglet.
          </p>
          <Link to="/rapports/compta" className="btn btn-secondary btn-sm">
            Rapport compta détaillé
          </Link>
        </KpiDetail>
      )
    case 'encaisse':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Encaissements</h3>
          <p className="dashboard-kpi-detail__text">
            Montant TTC des factures au statut <strong>Encaissée</strong> (payé). À rapprocher du total facturé et du
            reste dû.
          </p>
          <ul className="dashboard-kpi-detail__list">
            <li>
              Encaissé : <strong>{formatMoney(dash.amounts.invoices_ttc_paid)}</strong>
            </li>
            <li>
              Total facturé TTC : <strong>{formatMoney(dash.amounts.invoices_ttc_total)}</strong>
            </li>
            <li>
              Reste à encaisser : <strong>{formatMoney(dash.amounts.invoices_ttc_unpaid)}</strong>
            </li>
          </ul>
          <Link to="/invoices" className="btn btn-secondary btn-sm">
            Factures
          </Link>
        </KpiDetail>
      )
    case 'impayes':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Reste à encaisser</h3>
          <p className="dashboard-kpi-detail__text">
            Somme TTC des factures non soldées (hors brouillon), telle que calculée côté serveur pour le tableau de bord.
          </p>
          <ul className="dashboard-kpi-detail__list">
            <li>
              Impayé / à encaisser : <strong>{formatMoney(dash.amounts.invoices_ttc_unpaid)}</strong>
            </li>
            <li>
              Détail par statut (nombre de factures) : voir tuile <strong>Volume factures</strong> dans l’onglet Commerce.
            </li>
          </ul>
          <Link to="/crm/documents" className="btn btn-secondary btn-sm">
            Documents commerciaux
          </Link>
        </KpiDetail>
      )
    case 'reports_total':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Rapports PDF</h3>
          <ul className="dashboard-kpi-detail__list">
            <li>
              Total rapports : <strong>{dash.counts.reports_total}</strong>
            </li>
            <li>
              En attente de validation : <strong>{dash.counts.reports_pending_review}</strong>
            </li>
            <li>
              Approuvés : <strong>{dash.counts.reports_approved}</strong>
            </li>
          </ul>
          <p className="dashboard-kpi-detail__text">
            Les rapports sont générés depuis les commandes ; le circuit de relecture dépend de votre processus.
          </p>
          <Link to="/orders" className="btn btn-secondary btn-sm">
            Commandes & rapports
          </Link>
        </KpiDetail>
      )
    case 'reports_pending':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Rapports en attente de validation</h3>
          <p className="dashboard-kpi-detail__text">
            Nombre de rapports PDF en file d’attente de validation avant envoi / signature selon votre flux.
          </p>
          <p className="dashboard-kpi-detail__meta">
            <strong>{dash.counts.reports_pending_review}</strong> en attente sur{' '}
            <strong>{dash.counts.reports_total}</strong> rapports au total.
          </p>
          <Link to="/orders" className="btn btn-secondary btn-sm">
            Parcourir les commandes
          </Link>
        </KpiDetail>
      )
    case 'samples':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Échantillons par statut</h3>
          {statusRows(dash.counts.samples_by_status, SAMPLE_STATUS_LABELS).length === 0 ? (
            <p className="report-muted">Aucun échantillon.</p>
          ) : (
            <table className="dashboard-kpi-detail__table">
              <tbody>
                {statusRows(dash.counts.samples_by_status, SAMPLE_STATUS_LABELS).map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td className="dashboard-kpi-detail__num">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="dashboard-kpi-detail__meta">
            Total échantillons : <strong>{dash.counts.samples_total}</strong>
          </p>
        </KpiDetail>
      )
    case 'delay_first_report':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Délai commande → 1er rapport</h3>
          <ul className="dashboard-kpi-detail__list">
            <li>
              Moyenne :{' '}
              <strong>
                {dash.delays.order_to_first_report_days_avg != null
                  ? `${dash.delays.order_to_first_report_days_avg} j`
                  : '—'}
              </strong>
            </li>
            <li>
              Médiane :{' '}
              <strong>
                {dash.delays.order_to_first_report_days_median != null
                  ? `${dash.delays.order_to_first_report_days_median} j`
                  : '—'}
              </strong>
            </li>
            <li>
              Effectif (commandes prises en compte) : <strong>{dash.delays.order_to_first_report_sample_size}</strong>
            </li>
          </ul>
          <Link to="/rapports/delai-traitement" className="btn btn-secondary btn-sm dashboard-kpi-detail__action">
            Rapport délais de traitement
          </Link>
        </KpiDetail>
      )
    case 'delay_cycle':
      return (
        <KpiDetail>
          <h3 className="dashboard-kpi-detail__title">Cycle commande → livraison chantier</h3>
          <ul className="dashboard-kpi-detail__list">
            <li>
              Moyenne :{' '}
              <strong>
                {dash.delays.order_delivery_cycle_days_avg != null
                  ? `${dash.delays.order_delivery_cycle_days_avg} j`
                  : '—'}
              </strong>
            </li>
            <li>
              Médiane :{' '}
              <strong>
                {dash.delays.order_delivery_cycle_days_median != null
                  ? `${dash.delays.order_delivery_cycle_days_median} j`
                  : '—'}
              </strong>
            </li>
            <li>
              Effectif : <strong>{dash.delays.order_delivery_cycle_sample_size}</strong>
            </li>
          </ul>
          <p className="dashboard-kpi-detail__meta">
            Autres délais disponibles côté API : devis → livraison chantier (
            {dash.delays.quote_to_site_delivery_days_avg != null
              ? `${dash.delays.quote_to_site_delivery_days_avg} j (moy.)`
              : '—'}
            ), réception échantillon (
            {dash.delays.sample_reception_days_avg != null
              ? `${dash.delays.sample_reception_days_avg} j (moy.)`
              : '—'}
            ).
          </p>
          <Link to="/rapports/delai-chantier" className="btn btn-secondary btn-sm">
            Délais chantier & planning
          </Link>
        </KpiDetail>
      )
    default:
      return null
  }
}

const METIER_TABS: { id: MetierTab; label: string; hint: string }[] = [
  { id: 'commerce', label: 'Commerce', hint: 'Clients, chantiers, commandes, devis, volume factures' },
  { id: 'compta', label: 'Compta', hint: 'CA, encaissements, impayés, CA mensuel' },
  { id: 'labo', label: 'Labo', hint: 'Rapports, échantillons, délais, volume essais' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [metier, setMetier] = useState<MetierTab>('commerce')
  const [openKpi, setOpenKpi] = useState<KpiId | null>(null)

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

  useEffect(() => {
    setOpenKpi(null)
  }, [metier])

  function toggleKpi(id: KpiId) {
    setOpenKpi((prev) => (prev === id ? null : id))
  }

  return (
    <div className="dashboard-home dashboard-home--v2">
      <header className="dashboard-card dashboard-card--hero dashboard-hero">
        <p className="hub-kicker">Lab BTP</p>
        <h1>Bienvenue, {user?.name}</h1>
        <p className="dashboard-tagline">
          Indicateurs par métier (commerce, compta, labo) : cliquez une tuile pour afficher le détail, les répartitions et
          les liens utiles.
        </p>
      </header>

      {dashLoading && (
        <div className="dashboard-card dashboard-card--muted" aria-busy="true">
          <p className="dashboard-loading">Chargement des statistiques…</p>
        </div>
      )}
      {dashError && (
        <div className="dashboard-card dashboard-card--error">
          <p className="error dashboard-card__error-msg">{(dashError as Error).message}</p>
        </div>
      )}

      {dash && (
        <section className="dashboard-card dashboard-card--metrics dashboard-section dashboard-section--metier">
          <div className="dashboard-card__head">
            <h2 className="dashboard-section__title">Indicateurs clés par métier</h2>
          </div>
          <div className="dashboard-metier-tabs" role="tablist" aria-label="Métier">
            {METIER_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={metier === t.id}
                className={`dashboard-metier-tab${metier === t.id ? ' dashboard-metier-tab--active' : ''}`}
                onClick={() => setMetier(t.id)}
                title={t.hint}
              >
                {t.label}
              </button>
            ))}
          </div>

          {metier === 'commerce' && (
            <div role="tabpanel" className="dashboard-metier-panel" aria-label="Commerce">
              <div className="dashboard-kpi-grid">
                <KpiTile
                  id="clients"
                  label="Clients"
                  value={String(dash.counts.clients)}
                  selected={openKpi === 'clients'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="sites"
                  label="Chantiers"
                  value={String(dash.counts.sites)}
                  selected={openKpi === 'sites'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="orders"
                  label="Commandes"
                  value={String(dash.counts.orders)}
                  selected={openKpi === 'orders'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="quotes"
                  label="Devis"
                  value={String(dash.counts.quotes)}
                  selected={openKpi === 'quotes'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="invoices_count"
                  label="Volume factures"
                  value={String(dash.counts.invoices)}
                  selected={openKpi === 'invoices_count'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="pipeline_quotes_ttc"
                  label="Pipeline devis TTC"
                  value={formatMoney(dash.amounts.quotes_open_ttc)}
                  accent
                  selected={openKpi === 'pipeline_quotes_ttc'}
                  onToggle={toggleKpi}
                />
              </div>
              {openKpi && metier === 'commerce' ? renderKpiDetail(openKpi, dash) : null}
              <div className="dashboard-report-links dashboard-metier-links">
                <Link to="/rapports/ventes" className="dashboard-report-link">
                  Stats ventes & rapports
                </Link>
                <Link to="/crm" className="dashboard-report-link">
                  Espace CRM
                </Link>
                <Link to="/devis" className="dashboard-report-link">
                  Devis
                </Link>
              </div>
            </div>
          )}

          {metier === 'compta' && (
            <div role="tabpanel" className="dashboard-metier-panel" aria-label="Comptabilité">
              <div className="dashboard-kpi-grid">
                <KpiTile
                  id="ca_ttc"
                  label="CA facturé TTC"
                  value={formatMoney(dash.amounts.invoices_ttc_total)}
                  accent
                  selected={openKpi === 'ca_ttc'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="encaisse"
                  label="Encaissé"
                  value={formatMoney(dash.amounts.invoices_ttc_paid)}
                  selected={openKpi === 'encaisse'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="impayes"
                  label="Reste à encaisser"
                  value={formatMoney(dash.amounts.invoices_ttc_unpaid)}
                  selected={openKpi === 'impayes'}
                  onToggle={toggleKpi}
                />
              </div>
              {openKpi && metier === 'compta' ? renderKpiDetail(openKpi, dash) : null}

              <h3 className="dashboard-metier-subtitle">CA facturé par mois</h3>
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
                            <div
                              className="report-bar-fill report-bar-fill--soft"
                              style={{ width: `${(row.ca_ttc / maxCa) * 100}%` }}
                            />
                          </div>
                          <span className="report-bar-value">{formatMoney(row.ca_ttc)}</span>
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>

              <div className="dashboard-report-links dashboard-metier-links">
                <Link to="/rapports/compta" className="dashboard-report-link">
                  Rapport compta
                </Link>
                <Link to="/invoices" className="dashboard-report-link">
                  Factures
                </Link>
              </div>
            </div>
          )}

          {metier === 'labo' && (
            <div role="tabpanel" className="dashboard-metier-panel" aria-label="Laboratoire">
              <div className="dashboard-kpi-grid">
                <KpiTile
                  id="reports_total"
                  label="Rapports PDF"
                  value={String(dash.counts.reports_total)}
                  selected={openKpi === 'reports_total'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="reports_pending"
                  label="Attente validation"
                  value={String(dash.counts.reports_pending_review)}
                  selected={openKpi === 'reports_pending'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="samples"
                  label="Échantillons"
                  value={String(dash.counts.samples_total)}
                  selected={openKpi === 'samples'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="delay_first_report"
                  label="Délai moy. → 1er rapport"
                  value={
                    dash.delays.order_to_first_report_days_avg != null
                      ? `${dash.delays.order_to_first_report_days_avg} j`
                      : '—'
                  }
                  selected={openKpi === 'delay_first_report'}
                  onToggle={toggleKpi}
                />
                <KpiTile
                  id="delay_cycle"
                  label="Cycle moy. commande → livraison"
                  value={
                    dash.delays.order_delivery_cycle_days_avg != null
                      ? `${dash.delays.order_delivery_cycle_days_avg} j`
                      : '—'
                  }
                  selected={openKpi === 'delay_cycle'}
                  onToggle={toggleKpi}
                />
              </div>
              {openKpi && metier === 'labo' ? renderKpiDetail(openKpi, dash) : null}

              <h3 className="dashboard-metier-subtitle">Activité essais (volume)</h3>
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

              <div className="dashboard-report-links dashboard-metier-links">
                <Link to="/rapports/delai-traitement" className="dashboard-report-link">
                  Délais de traitement labo
                </Link>
                <Link to="/rapports/delai-chantier" className="dashboard-report-link">
                  Délais chantier
                </Link>
                <Link to="/graphiques-essais" className="dashboard-report-link">
                  Graphiques essais
                </Link>
                <Link to="/back-office" className="dashboard-report-link">
                  Back office
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="dashboard-card dashboard-card--hubs">
        <p className="dashboard-card__eyebrow">Espaces métier</p>
        <div className="dashboard-split">
          <Link to="/crm" className="dashboard-panel dashboard-panel--crm dashboard-panel--v2">
            <span className="dashboard-panel-icon" aria-hidden>
              <OutlineIcon id="handshake" />
            </span>
            <span className="dashboard-panel-label">CRM</span>
            <strong>Commercial & clients</strong>
            <span className="dashboard-panel-hint">
              Clients, chantiers, devis, factures, mails et PDF — avec champs et indicateurs personnalisables sur les
              fiches.
            </span>
          </Link>
          <Link to="/terrain" className="dashboard-panel dashboard-panel--terrain dashboard-panel--v2">
            <span className="dashboard-panel-icon" aria-hidden>
              <OutlineIcon id="lab" />
            </span>
            <span className="dashboard-panel-label">Terrain & labo</span>
            <strong>Prise de mesure & dossiers</strong>
            <span className="dashboard-panel-hint">
              Commandes, missions, forages, granulométrie et rapports — métadonnées disponibles sur commandes et
              missions.
            </span>
          </Link>
        </div>
      </div>

      <section className="dashboard-card dashboard-card--shortcuts">
        <p className="dashboard-shortcuts-title">Accès rapides</p>
        <div className="dashboard-shortcuts">
          <Link to="/orders" className="btn btn-secondary">
            Commandes
          </Link>
          <Link to="/back-office" className="btn btn-secondary">
            Back office
          </Link>
          <Link to="/invoices" className="btn btn-secondary">
            Factures
          </Link>
          <Link to="/graphiques-essais" className="btn btn-secondary">
            Graphiques essais
          </Link>
        </div>
      </section>
    </div>
  )
}
