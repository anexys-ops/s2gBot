import { useMemo } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dossiersApi } from '../../../api/client'
import type { DossierFicheOutletContext } from '../DossierFichePage'
import { ListTableFootRow, ListTablePanelHeader } from '../../../components/ListTablePanel'
import StatusBadge, {
  bonCommandeStatutBadgeProps,
  bonLivraisonStatutBadgeProps,
} from '../../../components/ds/StatusBadge'
import { formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../../../lib/appLocale'
import { sumNumeric } from '../../../lib/listTableTotals'
import { shouldIgnoreTableRowClick } from '../../../lib/tableRowInteraction'

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

  const bcs = data?.bons_commande ?? []
  const bls = data?.bons_livraison ?? []
  const bcTotals = useMemo(
    () => ({
      ht: sumNumeric(bcs, (bc) => bc.montant_ht),
      ttc: sumNumeric(bcs, (bc) => bc.montant_ttc),
    }),
    [bcs],
  )

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

  return (
    <div className="dossier-tab">
      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <ListTablePanelHeader title="Bons de commande" count={bcs.length} />
        <p className="dossier-tab-panel__intro" style={{ padding: '0 1.5rem', marginTop: '-0.25rem' }}>
          Bons rattachés au dossier <code>{dossier.reference}</code>. Voir aussi la{' '}
          <Link to="/bons-commande" className="link-inline">
            liste globale des bons de commande
          </Link>
          .
        </p>
        {bcs.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th className="data-table__code">N°</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Montant HT ({MONEY_UNIT_LABEL})</th>
                  <th>Montant TTC ({MONEY_UNIT_LABEL})</th>
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
                        if (shouldIgnoreTableRowClick(e.target)) return
                        navigate(`/bons-commande/${bc.id}`)
                      }}
                    >
                      <td className="data-table__code">
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
                      <td className="data-table__num">{formatMoney(Number(bc.montant_ht))}</td>
                      <td className="data-table__num">{formatMoney(Number(bc.montant_ttc))}</td>
                    </tr>
                  )
                })}
              </tbody>
              <ListTableFootRow
                columns={[
                  { id: 'number', kind: 'text' },
                  { id: 'status', kind: 'text' },
                  { id: 'date', kind: 'text' },
                  { id: 'ht', kind: 'money' },
                  { id: 'ttc', kind: 'money' },
                ]}
                visible={{ number: true, status: true, date: true, ht: true, ttc: true }}
                totals={bcTotals}
              />
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun bon de commande pour ce dossier.</p>
        )}
      </div>

      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <ListTablePanelHeader title="Bons de livraison" count={bls.length} />
        {bls.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th className="data-table__code">N°</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th className="data-table__code">BC lié</th>
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
                        if (shouldIgnoreTableRowClick(e.target)) return
                        navigate(`/bons-livraison/${bl.id}`)
                      }}
                    >
                      <td className="data-table__code">
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
                      <td className="data-table__code">
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
