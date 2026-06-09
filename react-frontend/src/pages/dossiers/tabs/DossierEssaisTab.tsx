import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { missionsApi, ordresMissionApi, type Mission } from '../../../api/client'
import type { DossierFicheOutletContext } from '../DossierFichePage'
import StatusBadge, { ordreMissionStatutBadgeProps } from '../../../components/ds/StatusBadge'
import { formatAppDate } from '../../../lib/appLocale'

export default function DossierEssaisTab() {
  const { id } = useParams<{ id: string }>()
  const dossierId = Number(id)
  const navigate = useNavigate()
  const { dossier } = useOutletContext<DossierFicheOutletContext>()

  const { data: missions, isLoading: missionsLoading, error: missionsError } = useQuery({
    queryKey: ['dossier-missions', dossierId],
    queryFn: () => missionsApi.listAll({ dossier_id: dossierId }),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  })

  const { data: ordresMission, isLoading: omLoading, error: omError } = useQuery({
    queryKey: ['dossier-ordres-mission', dossierId],
    queryFn: async () => {
      const rows = await ordresMissionApi.list({ type: 'labo' })
      return rows.filter((om) => om.dossier_id === dossierId)
    },
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  })

  if (missionsLoading || omLoading) {
    return (
      <div className="dossier-tab">
        <p className="text-muted">Chargement des essais et missions…</p>
      </div>
    )
  }

  const err = missionsError ?? omError
  if (err) {
    return (
      <div className="dossier-tab">
        <p className="error">{(err as Error).message}</p>
      </div>
    )
  }

  const missionList: Mission[] = missions ?? []
  const omList = ordresMission ?? []

  return (
    <div className="dossier-tab">
      <div className="card dossier-tab-panel">
        <h2 className="ds-form-section__title">Essais & analyses</h2>
        <p className="dossier-tab-panel__intro">
          Missions terrain et ordres de mission laboratoire liés au dossier <code>{dossier.reference}</code>.
        </p>
        <div className="dossier-tab-links">
          <Link to="/labo/essais" className="link-inline">
            Espace essais laboratoire
          </Link>
          <Link to="/graphiques-essais" className="link-inline">
            Graphiques d&apos;essais
          </Link>
          {dossier.site_id ? (
            <Link to={`/sites/${dossier.site_id}/missions`} className="link-inline">
              Missions du chantier
            </Link>
          ) : null}
        </div>
      </div>

      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <div className="dossier-tab-panel__header">
          <h2 className="ds-form-section__title">Missions géotechniques</h2>
        </div>
        {missionList.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Titre</th>
                  <th>Statut</th>
                  <th className="data-table__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {missionList.map((m) => (
                  <tr
                    key={m.id}
                    className="table-row-link"
                    onClick={() => {
                      if (dossier.site_id) navigate(`/sites/${dossier.site_id}/missions`)
                    }}
                  >
                    <td>
                      <code>{m.reference ?? `#${m.id}`}</code>
                    </td>
                    <td>{m.title?.trim() ? m.title : '—'}</td>
                    <td>{m.mission_status?.trim() ? m.mission_status : '—'}</td>
                    <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                      {dossier.site_id ? (
                        <Link to={`/sites/${dossier.site_id}/missions`} className="btn btn-secondary btn-sm">
                          Chantier
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucune mission liée à ce dossier.</p>
        )}
      </div>

      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <div className="dossier-tab-panel__header">
          <h2 className="ds-form-section__title">Ordres de mission laboratoire</h2>
        </div>
        {omList.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Statut</th>
                  <th>Date prévue</th>
                  <th>BC lié</th>
                  <th className="data-table__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {omList.map((om) => {
                  const st = ordreMissionStatutBadgeProps(om.statut)
                  return (
                    <tr
                      key={om.id}
                      className="table-row-link"
                      onClick={(e) => {
                        const t = e.target as HTMLElement
                        if (t.closest('a, button')) return
                        navigate(`/ordres-mission/${om.id}`)
                      }}
                    >
                      <td>
                        <Link to={`/ordres-mission/${om.id}`} onClick={(e) => e.stopPropagation()}>
                          <code>{om.numero}</code>
                        </Link>
                      </td>
                      <td className="data-table__status">
                        <StatusBadge variant={st.variant} size="sm">
                          {st.label}
                        </StatusBadge>
                      </td>
                      <td>{om.date_prevue ? formatAppDate(om.date_prevue) : '—'}</td>
                      <td>
                        {om.bon_commande_id ? (
                          <Link
                            to={`/bons-commande/${om.bon_commande_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="link-inline"
                          >
                            {om.bonCommande?.numero ?? `#${om.bon_commande_id}`}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/ordres-mission/${om.id}`} className="btn btn-secondary btn-sm">
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
          <p className="dossier-tab-empty">Aucun ordre de mission laboratoire pour ce dossier.</p>
        )}
      </div>
    </div>
  )
}
