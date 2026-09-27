import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ordresMissionApi, type OrdreMission } from '../../api/client'
import { formatAppDate } from '../../lib/appLocale'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

const STATUT_LABELS: Record<string, string> = {
  planifie: 'Planifiée',
  en_cours: 'En cours',
}

function statutLabel(statut: string): string {
  return STATUT_LABELS[statut] ?? statut
}

export default function PortalInterventionsPage() {
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['portal-interventions'],
    queryFn: () => ordresMissionApi.list(),
    staleTime: 30_000,
  })

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Portail', to: '/portal' },
        { label: 'Interventions' },
      ]}
      moduleBarLabel="Portail client — Interventions"
      title="Interventions planifiées ou en cours"
      subtitle="Suivi des ordres de mission sur vos chantiers."
    >
      {isLoading && <p className="text-muted">Chargement…</p>}
      {isError && <p className="error">Impossible de charger les interventions.</p>}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Aucune intervention planifiée ou en cours pour le moment.</p>
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="table-responsive card">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>N° OdM</th>
                <th>Dossier</th>
                <th>Chantier</th>
                <th>Statut</th>
                <th>Date prévue</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((om: OrdreMission) => (
                <tr key={om.id}>
                  <td><code>{om.numero ?? om.unique_number ?? `#${om.id}`}</code></td>
                  <td>
                    {om.dossier_id ? (
                      <Link to={`/portal/dossiers/${om.dossier_id}/infos`}>
                        {om.dossier?.reference ?? `Dossier #${om.dossier_id}`}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{om.site?.name ?? '—'}</td>
                  <td>{statutLabel(om.statut)}</td>
                  <td>{om.date_prevue ? formatAppDate(om.date_prevue) : '—'}</td>
                  <td>{om.type ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModuleEntityShell>
  )
}
