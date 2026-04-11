import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { activityLogsApi, type ActivityLogRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

function shortSubject(log: ActivityLogRow): string {
  if (!log.subject_type) return '—'
  const base = log.subject_type.split('\\').pop() ?? log.subject_type
  return log.subject_id != null ? `${base} #${log.subject_id}` : base
}

export default function ActivityLogPage() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  if (!isLab) {
    return <Navigate to="/" replace />
  }

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => activityLogsApi.list({ limit: 120 }),
  })

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Terrain & labo', to: '/terrain' },
        { label: 'Journal d’audit' },
      ]}
      moduleBarLabel="Conformité"
      title="Journal d’activité"
      subtitle="Piste d’audit simplifiée : missions, rapports générés / validés (extensible)."
    >
      <div className="design-card">
        {isLoading && <p className="design-card__muted">Chargement…</p>}
        {error && <p className="error">{(error as Error).message}</p>}
        {!isLoading && !error && (
          <div className="activity-table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>Cible</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="activity-table__date">{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                    <td>{log.user?.name ?? '—'}</td>
                    <td>
                      <code className="activity-code">{log.action}</code>
                    </td>
                    <td>{shortSubject(log)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <p className="design-card__muted">Aucun événement enregistré pour l’instant.</p>}
          </div>
        )}
      </div>
    </ModuleEntityShell>
  )
}
