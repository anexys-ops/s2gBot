import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { monitoringApi, type MonitoringActivityRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { canViewMonitoringLogs } from '../../lib/settingsAccess'

type LogTab = 'activity' | 'errors' | 'security' | 'sessions'

function actionCategory(action: string): 'created' | 'updated' | 'deleted' | 'print' | 'other' {
  if (action.endsWith('.created') || action.includes('login')) return 'created'
  if (action.endsWith('.updated') || action.endsWith('.update')) return 'updated'
  if (action.endsWith('.deleted') || action.endsWith('.destroy') || action.includes('logout')) return 'deleted'
  if (action.includes('generated') || action.includes('print') || action.includes('pdf')) return 'print'
  return 'other'
}

function categoryLabel(cat: ReturnType<typeof actionCategory>): string {
  switch (cat) {
    case 'created':
      return 'Création'
    case 'updated':
      return 'Modification'
    case 'deleted':
      return 'Suppression'
    case 'print':
      return 'Impression'
    default:
      return 'Autre'
  }
}

function shortMachine(userAgent?: string | null): string {
  if (!userAgent) return '—'
  if (userAgent.length <= 48) return userAgent
  return `${userAgent.slice(0, 45)}…`
}

function shortSubject(log: MonitoringActivityRow): string {
  if (!log.subject_type) return '—'
  const base = log.subject_type.split('\\').pop() ?? log.subject_type
  return log.subject_id != null ? `${base} #${log.subject_id}` : base
}

function statusTone(code: number): string {
  if (code === 404) return 'log-badge--404'
  if (code >= 500) return 'log-badge--5xx'
  if (code >= 400) return 'log-badge--4xx'
  return 'log-badge--other'
}

export default function SettingsLogsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<LogTab>('activity')

  if (!canViewMonitoringLogs(user)) {
    return <Navigate to="/settings/compte" replace />
  }

  const activityQ = useQuery({
    queryKey: ['monitoring-activity'],
    queryFn: () => monitoringApi.activity({ limit: 120 }),
    enabled: tab === 'activity',
    refetchInterval: tab === 'activity' ? 30_000 : false,
  })

  const errorsQ = useQuery({
    queryKey: ['monitoring-errors'],
    queryFn: () => monitoringApi.errors({ limit: 120 }),
    enabled: tab === 'errors',
    refetchInterval: tab === 'errors' ? 30_000 : false,
  })

  const securityQ = useQuery({
    queryKey: ['monitoring-security'],
    queryFn: () => monitoringApi.security({ limit: 120 }),
    enabled: tab === 'security',
    refetchInterval: tab === 'security' ? 30_000 : false,
  })

  const sessionsQ = useQuery({
    queryKey: ['monitoring-sessions'],
    queryFn: () => monitoringApi.sessions(),
    enabled: tab === 'sessions',
    refetchInterval: tab === 'sessions' ? 15_000 : false,
  })

  const tabs: { id: LogTab; label: string }[] = [
    { id: 'activity', label: 'Activité utilisateurs' },
    { id: 'errors', label: 'Erreurs HTTP' },
    { id: 'security', label: 'Sécurité' },
    { id: 'sessions', label: 'Sessions ouvertes' },
  ]

  return (
    <div className="settings-logs">
      <p className="settings-logs__intro">
        Horodatage, machine (navigateur), adresse IP, utilisateur et type d’action. Les mots de passe ne sont jamais
        enregistrés.
      </p>

      <nav className="settings-logs__tabs" aria-label="Types de journaux">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`settings-logs__tab${tab === t.id ? ' settings-logs__tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'activity' && (
        <LogPanel loading={activityQ.isLoading} error={activityQ.error as Error | null}>
          <table className="monitoring-table">
            <thead>
              <tr>
                <th>Horodatage</th>
                <th>Utilisateur</th>
                <th>Tâche</th>
                <th>Type</th>
                <th>Cible</th>
                <th>IP</th>
                <th>Machine</th>
              </tr>
            </thead>
            <tbody>
              {(activityQ.data ?? []).map((log) => {
                const cat = actionCategory(log.action)
                return (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                    <td>{log.user?.name ?? '—'}</td>
                    <td>
                      <code>{log.action}</code>
                    </td>
                    <td>
                      <span className={`log-badge log-badge--${cat}`}>{categoryLabel(cat)}</span>
                    </td>
                    <td>{shortSubject(log)}</td>
                    <td>{log.ip_address ?? '—'}</td>
                    <td title={log.user_agent ?? undefined}>{shortMachine(log.user_agent)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {(activityQ.data ?? []).length === 0 && !activityQ.isLoading && (
            <p className="settings-logs__empty">Aucune activité enregistrée.</p>
          )}
        </LogPanel>
      )}

      {tab === 'errors' && (
        <LogPanel loading={errorsQ.isLoading} error={errorsQ.error as Error | null}>
          <table className="monitoring-table">
            <thead>
              <tr>
                <th>Horodatage</th>
                <th>Code</th>
                <th>Méthode</th>
                <th>URL</th>
                <th>Message</th>
                <th>Utilisateur</th>
                <th>IP</th>
                <th>Machine</th>
              </tr>
            </thead>
            <tbody>
              {(errorsQ.data ?? []).map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                  <td>
                    <span className={`log-badge ${statusTone(log.status_code)}`}>{log.status_code}</span>
                  </td>
                  <td>{log.method}</td>
                  <td className="monitoring-table__url" title={log.url}>
                    {log.url}
                  </td>
                  <td>{log.message ?? '—'}</td>
                  <td>{log.user?.name ?? '—'}</td>
                  <td>{log.ip_address ?? '—'}</td>
                  <td title={log.user_agent ?? undefined}>{shortMachine(log.user_agent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(errorsQ.data ?? []).length === 0 && !errorsQ.isLoading && (
            <p className="settings-logs__empty">Aucune erreur HTTP récente.</p>
          )}
        </LogPanel>
      )}

      {tab === 'security' && (
        <LogPanel loading={securityQ.isLoading} error={securityQ.error as Error | null}>
          <table className="monitoring-table">
            <thead>
              <tr>
                <th>Horodatage</th>
                <th>Événement</th>
                <th>Identifiant tenté</th>
                <th>IP</th>
                <th>Machine</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {(securityQ.data ?? []).map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                  <td>
                    <span className={`log-badge log-badge--${log.event_type === 'login_failed' ? 'deleted' : 'updated'}`}>
                      {log.event_type === 'login_failed' ? 'Connexion échouée' : log.event_type}
                    </span>
                  </td>
                  <td>{log.email_attempted ?? '—'}</td>
                  <td>{log.ip_address ?? '—'}</td>
                  <td title={log.user_agent ?? undefined}>{shortMachine(log.user_agent)}</td>
                  <td>{log.properties?.reason ? String(log.properties.reason) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(securityQ.data ?? []).length === 0 && !securityQ.isLoading && (
            <p className="settings-logs__empty">Aucun événement de sécurité.</p>
          )}
        </LogPanel>
      )}

      {tab === 'sessions' && (
        <LogPanel loading={sessionsQ.isLoading} error={sessionsQ.error as Error | null}>
          <table className="monitoring-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Page actuelle</th>
                <th>Dernière activité</th>
                <th>Session depuis</th>
                <th>IP</th>
                <th>Machine</th>
              </tr>
            </thead>
            <tbody>
              {(sessionsQ.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.user?.name ?? '—'}
                    {s.user?.email ? <span className="settings-logs__email"> ({s.user.email})</span> : null}
                  </td>
                  <td>
                    <code>{s.current_page ?? '/'}</code>
                  </td>
                  <td>{new Date(s.last_seen_at).toLocaleString('fr-FR')}</td>
                  <td>{new Date(s.created_at).toLocaleString('fr-FR')}</td>
                  <td>{s.ip_address ?? '—'}</td>
                  <td title={s.user_agent ?? undefined}>{shortMachine(s.user_agent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(sessionsQ.data ?? []).length === 0 && !sessionsQ.isLoading && (
            <p className="settings-logs__empty">Aucune session active (dernières 30 min).</p>
          )}
        </LogPanel>
      )}
    </div>
  )
}

function LogPanel({
  loading,
  error,
  children,
}: {
  loading: boolean
  error: Error | null
  children: React.ReactNode
}) {
  if (loading) return <p className="settings-logs__empty">Chargement…</p>
  if (error) return <p className="error">{error.message}</p>
  return <div className="settings-logs__panel card">{children}</div>
}
