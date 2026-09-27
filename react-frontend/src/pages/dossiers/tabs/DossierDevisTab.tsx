import { useMemo } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dossiersApi } from '../../../api/client'
import type { DossierFicheOutletContext } from '../DossierFichePage'
import { ListTableFootRow, ListTablePanelHeader } from '../../../components/ListTablePanel'
import StatusBadge, { quoteStatutBadgeProps } from '../../../components/ds/StatusBadge'
import { formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../../../lib/appLocale'
import { sumNumeric } from '../../../lib/listTableTotals'

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

  const list = devis ?? []
  const totals = useMemo(
    () => ({
      ht: sumNumeric(list, (q) => q.amount_ht),
      ttc: sumNumeric(list, (q) => q.amount_ttc),
      travel: sumNumeric(list, (q) => q.travel_fee_ht ?? 0),
    }),
    [list],
  )

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

  return (
    <div className="dossier-tab">
      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <ListTablePanelHeader title="Devis du dossier" count={list.length} />
        <p className="dossier-tab-panel__intro" style={{ padding: '0 1.5rem', marginTop: '-0.25rem' }}>
          Devis rattachés au dossier <code>{dossier.reference}</code>. Création et suivi dans le module{' '}
          <Link to="/devis" className="link-inline">
            Devis
          </Link>
          .
        </p>
        {list.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th className="data-table__code">N°</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Montant HT ({MONEY_UNIT_LABEL})</th>
                  <th>Montant TTC ({MONEY_UNIT_LABEL})</th>
                  <th>Dépl. HT ({MONEY_UNIT_LABEL})</th>
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
                      <td className="data-table__code">
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
                      <td className="data-table__num">{formatMoney(Number(q.amount_ht))}</td>
                      <td className="data-table__num">{formatMoney(Number(q.amount_ttc))}</td>
                      <td className="data-table__num">{formatMoney(Number(q.travel_fee_ht ?? 0))}</td>
                      <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/devis/${q.id}/editer`} className="btn btn-secondary btn-sm">
                          Ouvrir
                        </Link>
                      </td>
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
                  { id: 'travel', kind: 'money' },
                  { id: 'actions', kind: 'text' },
                ]}
                visible={{
                  number: true,
                  status: true,
                  date: true,
                  ht: true,
                  ttc: true,
                  travel: true,
                  actions: true,
                }}
                totals={totals}
              />
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun devis lié pour l’instant.</p>
        )}
      </div>
    </div>
  )
}
