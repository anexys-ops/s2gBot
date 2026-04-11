import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { getOfflineQueueLength } from '../lib/offlineQueue'
import AppNavigation from './AppNavigation'

export default function Layout() {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [queueN, setQueueN] = useState(0)

  useEffect(() => {
    const syncQueue = () => setQueueN(getOfflineQueueLength())
    syncQueue()
    const onOnline = () => {
      setOnline(true)
      syncQueue()
    }
    const onOffline = () => {
      setOnline(false)
      syncQueue()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const id = window.setInterval(syncQueue, 8000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(id)
    }
  }, [])

  return (
    <>
      <AppNavigation />
      {!online && (
        <div className="app-offline-banner" role="status">
          <span className="app-offline-banner__dot" aria-hidden />
          Hors ligne — les données affichées peuvent être périmées. Les enregistrements seront retentés au retour du réseau
          (file d’attente expérimentale).
        </div>
      )}
      {online && queueN > 0 && (
        <div className="app-sync-banner" role="status">
          {queueN} requête(s) en attente de synchronisation (stockage local).
        </div>
      )}
      <main className="container main-content">
        <Outlet />
      </main>
    </>
  )
}
