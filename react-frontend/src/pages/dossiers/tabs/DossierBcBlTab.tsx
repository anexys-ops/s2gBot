import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dossiersApi } from '../../../api/client'
import type { DossierFicheOutletContext } from '../DossierFichePage'
import StatusBadge, {
  bonCommandeStatutBadgeProps,
  bonLivraisonStatutBadgeProps,
} from '../../../components/ds/StatusBadge'
import { formatAppDate, formatMoney } from '../../../lib/appLocale'

export default function DossierBcBlTab() {
  const { id } = useParams<{ id: string }>()
  const dossierId = Number(id)
  const navigate = useNavigate()
  const { dossier } = useOutletContext<DossierFicheOutletContext>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['dossier-bons', dossierId],
    queryFn: () => dossiersApi.bons(dossierId),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  })

  if (isLoading) {
    return (
      <div className="dossier-tab">
        <p className="text-muted">Chargement des bons de commande et bons de livraison…</p>
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

  const bcs = data?.bons_commande ?? []
  const bls = data?.bons_livraison ?? []

  return (
    <div className="dossier-tab">
      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <div className="dossier-tab-panel__header">
          <h2 className="ds-form-section__title">Bons de commande</h2>
          <p className="dossier-tab-panel__intro">
            Bons rattachés au dossier <code>{dossier.reference}</code>. Voir aussi la{' '}
            <Link to="/bons-commande" className="link-inline">
              liste globale des bons de commande
            </Link>
            .
          </p>
        </div>
        {bcs.length > 0 ? (
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
                {bcs.map((bc) => {
                  const st = bonCommandeStatutBadgeProps(bc.statut)
                  return (
                    <tr
                      key={bc.id}
                      className="table-row-link"
                      onClick={(e) => {
                        const t = e.target as HTMLElement
                        if (t.closest('a, button')) return
                        navigate(`/bons-commande/${bc.id}`)
                      }}
                    >
                      <td>
                        <Link to={`/bons-commande/${bc.id}`} onClick={(e) => e.stopPropagation()}>
                          <code>{bc.numero}</code>
                        </Link>
                      </td>
                      <td className="data-table__status">
                        <StatusBadge variant={st.variant} size="sm">
                          {st.label}
                        </StatusBadge>
                      </td>
                      <td>{formatAppDate(bc.date_commande)}</td>
                      <td>{formatMoney(Number(bc.montant_ttc))}</td>
                      <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/bons-commande/${bc.id}`} className="btn btn-secondary btn-sm">
                          Fiche
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun bon de commande pour ce dossier.</p>
        )}
      </div>

      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <div className="dossier-tab-panel__header">
          <h2 className="ds-form-section__title">Bons de livraison</h2>
        </div>
        {bls.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>BC lié</th>
                  <th className="data-table__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bls.map((bl) => {
                  const st = bonLivraisonStatutBadgeProps(bl.statut)
                  return (
                    <tr
                      key={bl.id}
                      className="table-row-link"
                      onClick={(e) => {
                        const t = e.target as HTMLElement
                        if (t.closest('a, button')) return
                        navigate(`/bons-livraison/${bl.id}`)
                      }}
                    >
                      <td>
                        <Link to={`/bons-livraison/${bl.id}`} onClick={(e) => e.stopPropagation()}>
                          <code>{bl.numero}</code>
                        </Link>
                      </td>
                      <td className="data-table__status">
                        <StatusBadge variant={st.variant} size="sm">
                          {st.label}
                        </StatusBadge>
                      </td>
                      <td>{formatAppDate(bl.date_livraison)}</td>
                      <td>
                        {bl.bon_commande_id ? (
                          <Link
                            to={`/bons-commande/${bl.bon_commande_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="link-inline"
                          >
                            #{bl.bon_commande_id}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/bons-livraison/${bl.id}`} className="btn btn-secondary btn-sm">
                          Fiche
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun bon de livraison pour ce dossier.</p>
        )}
      </div>
    </div>
  )
}
