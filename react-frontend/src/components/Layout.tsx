import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppConnectivity } from '../hooks/useAppConnectivity'
import { useOfflineQueueSync } from '../hooks/useOfflineQueueSync'
import { OFFLINE_QUEUE_SYNCED_EVENT } from '../lib/offlineQueue'
import AppNavigation from './AppNavigation'
import AppContextBar from './AppContextBar'
import AppVersionFooter from './AppVersionFooter'
import SessionPresenceTracker from './SessionPresenceTracker'

export default function Layout() {
  const online = useAppConnectivity()
  const queryClient = useQueryClient()
  const { queueN, syncing, lastResult, lastError, retry, clear } = useOfflineQueueSync(online)

  useEffect(() => {
    const onSynced = () => {
      void queryClient.invalidateQueries()
    }
    window.addEventListener(OFFLINE_QUEUE_SYNCED_EVENT, onSynced)
    return () => window.removeEventListener(OFFLINE_QUEUE_SYNCED_EVENT, onSynced)
  }, [queryClient])

  const showSyncBanner = online && (queueN > 0 || syncing || (lastResult != null && lastResult.failed > 0))

  return (
    <div className="app-shell">
      <SessionPresenceTracker />
      <AppNavigation />
      <AppContextBar />
      {!online && (
        <div className="app-offline-banner" role="status">
          <span className="app-offline-banner__dot" aria-hidden />
          Hors ligne — les données affichées peuvent être périmées. Les enregistrements seront retentés au retour du réseau
          (file d’attente locale).
        </div>
      )}
      {showSyncBanner && (
        <div className="app-sync-banner" role="status">
          <div className="app-sync-banner__content">
            {syncing ? (
              <span>Synchronisation de la file locale en cours…</span>
            ) : queueN > 0 ? (
              <span>
                {queueN} requête(s) en attente de synchronisation (stockage local).
                {lastResult && lastResult.synced > 0 ? ` ${lastResult.synced} envoyée(s) lors de la dernière tentative.` : null}
              </span>
            ) : lastResult && lastResult.failed > 0 ? (
              <span>Dernière synchronisation incomplète — certaines requêtes n’ont pas abouti.</span>
            ) : null}
            {lastError ? <span className="app-sync-banner__error">{lastError}</span> : null}
          </div>
          <div className="app-sync-banner__actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={syncing || queueN === 0}
              onClick={() => void retry()}
            >
              Réessayer
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={syncing || queueN === 0}
              onClick={clear}
            >
              Vider la file
            </button>
          </div>
        </div>
      )}
      <main className="container main-content app-shell__main app-shell__main--footer-dock">
        <Outlet />
      </main>
      <AppVersionFooter variant="app" dock />
    </div>
  )
}
