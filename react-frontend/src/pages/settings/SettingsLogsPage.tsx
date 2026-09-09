import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { monitoringApi, type MonitoringActivityRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { canViewMonitoringLogs } from '../../lib/settingsAccess'

type LogTab = 'activity' | 'errors' | 'security' | 'sessions'

function actionCategory(action: string): 'created' | 'updated' | 'deleted' | 'print' | 'other' {
  if (action.endsWith('.created') || action.includes('login')) return 'created'
  if (action.endsWith('.updated') || action.endsWith('.update') || action.endsWith('.emailed')) return 'updated'
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

function entityId(log: MonitoringActivityRow): string {
  if (log.subject_id != null) return String(log.subject_id)
  const props = log.properties
  if (!props) return '—'
  if (typeof props.quote_id === 'number') return String(props.quote_id)
  if (typeof props.invoice_id === 'number') return String(props.invoice_id)
  if (typeof props.client_id === 'number') return String(props.client_id)
  return '—'
}

function formatChanges(log: MonitoringActivityRow): string {
  const props = log.properties
  if (!props) return '—'

  const tasks = Array.isArray(props.tasks) ? (props.tasks as string[]).join(', ') : null
  const changes = props.changes as Record<string, { from?: unknown; to?: unknown }> | undefined

  const parts: string[] = []
  if (tasks) parts.push(`Tâches: ${tasks}`)

  if (changes && typeof changes === 'object') {
    const entries = Object.entries(changes).slice(0, 4)
    for (const [field, diff] of entries) {
      parts.push(`${field}: ${String(diff.from ?? '—')} → ${String(diff.to ?? '—')}`)
    }
    const extra = Object.keys(changes).length - entries.length
    if (extra > 0) parts.push(`+${extra} champ(s)`)
  }

  return parts.length > 0 ? parts.join(' · ') : '—'
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
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  if (!canViewMonitoringLogs(user)) {
    return <Navigate to="/settings/compte" replace />
  }

  const activityQ = useQuery({
    queryKey: ['monitoring-activity', search, entityFilter],
    queryFn: () =>
      monitoringApi.activity({
        limit: 150,
        search: search || undefined,
        entity: entityFilter || undefined,
      }),
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
        Traçabilité devis, factures et clients : ID, tâche effectuée, auteur, IP et détail des champs modifiés.
        Rétention automatique <strong>7 jours</strong> (purge planifiée tous les 3 jours). Les mots de passe ne sont
        jamais enregistrés.
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
        <>
          <div className="settings-logs__filters card">
            <label className="settings-logs__search-label">
              Recherche (description, n° devis/facture, ID, client…)
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ex. DEV-2026, 42, ACME, lignes devis…"
              />
            </label>
            <label className="settings-logs__search-label">
              Type
              <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
                <option value="">Tous</option>
                <option value="devis">Devis</option>
                <option value="facture">Factures</option>
                <option value="client">Clients</option>
              </select>
            </label>
          </div>
          <LogPanel loading={activityQ.isLoading} error={activityQ.error as Error | null}>
            <table className="monitoring-table">
              <thead>
                <tr>
                  <th>Horodatage</th>
                  <th>Utilisateur</th>
                  <th>ID</th>
                  <th>Tâche</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Détail modifications</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {(activityQ.data ?? []).map((log) => {
                  const cat = actionCategory(log.action)
                  return (
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                      <td>
                        {log.user?.name ?? '—'}
                        {log.user?.email ? (
                          <span className="settings-logs__email">
                            <br />
                            {log.user.email}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <code>{entityId(log)}</code>
                      </td>
                      <td>
                        <code>{log.action}</code>
                      </td>
                      <td>
                        <span className={`log-badge log-badge--${cat}`}>{categoryLabel(cat)}</span>
                      </td>
                      <td className="monitoring-table__desc">{log.description ?? '—'}</td>
                      <td className="monitoring-table__changes">{formatChanges(log)}</td>
                      <td title={log.user_agent ?? undefined}>
                        {log.ip_address ?? '—'}
                        <span className="settings-logs__email">
                          <br />
                          {shortMachine(log.user_agent)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(activityQ.data ?? []).length === 0 && !activityQ.isLoading && (
              <p className="settings-logs__empty">Aucune activité trouvée pour cette recherche.</p>
            )}
          </LogPanel>
        </>
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
