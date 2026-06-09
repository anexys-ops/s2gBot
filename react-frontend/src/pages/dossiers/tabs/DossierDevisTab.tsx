import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dossiersApi } from '../../../api/client'
import type { DossierFicheOutletContext } from '../DossierFichePage'
import StatusBadge, { quoteStatutBadgeProps } from '../../../components/ds/StatusBadge'
import { formatAppDate, formatMoney } from '../../../lib/appLocale'

export default function DossierDevisTab() {
  const { id } = useParams<{ id: string }>()
  const dossierId = Number(id)
  const navigate = useNavigate()
  const { dossier } = useOutletContext<DossierFicheOutletContext>()

  const { data: devis, isLoading, error } = useQuery({
    queryKey: ['dossier-devis', dossierId],
    queryFn: () => dossiersApi.devis(dossierId),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  })

  if (isLoading) {
    return (
      <div className="dossier-tab">
        <p className="text-muted">Chargement des devis…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="dossier-tab">
        <p className="error">{(error as Error).message}</p>
      </div>
    )
  }

  const list = devis ?? []

  return (
    <div className="dossier-tab">
      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <div className="dossier-tab-panel__header">
          <h2 className="ds-form-section__title">Devis du dossier</h2>
          <p className="dossier-tab-panel__intro">
            Devis rattachés au dossier <code>{dossier.reference}</code>. Création et suivi dans le module{' '}
            <Link to="/devis" className="link-inline">
              Devis
            </Link>
            .
          </p>
        </div>
        {list.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Montant TTC</th>
                  <th className="data-table__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((q) => {
                  const st = quoteStatutBadgeProps(q.status)
                  return (
                    <tr
                      key={q.id}
                      className="table-row-link"
                      onClick={(e) => {
                        const t = e.target as HTMLElement
                        if (t.closest('a, button')) return
                        navigate(`/devis/${q.id}/editer`)
                      }}
                    >
                      <td>
                        <Link to={`/devis/${q.id}/editer`} onClick={(e) => e.stopPropagation()}>
                          <code>{q.number}</code>
                        </Link>
                      </td>
                      <td className="data-table__status">
                        <StatusBadge variant={st.variant} size="sm">
                          {st.label}
                        </StatusBadge>
                      </td>
                      <td>{q.quote_date ? formatAppDate(q.quote_date) : '—'}</td>
                      <td>{formatMoney(Number(q.amount_ttc))}</td>
                      <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/devis/${q.id}/editer`} className="btn btn-secondary btn-sm">
                          Ouvrir
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun devis lié pour l’instant.</p>
        )}
      </div>
    </div>
  )
}
