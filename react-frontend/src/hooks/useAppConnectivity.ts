import { useEffect, useState } from 'react'

const PROBE_URL = '/api/version'
const PROBE_INTERVAL_MS = 30_000
const PROBE_TIMEOUT_MS = 8_000

async function probeApiReachable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    const res = await fetch(PROBE_URL, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    window.clearTimeout(timeoutId)
    return res.ok
  } catch {
    return false
  }
}

/**
 * État réseau basé sur un ping API (fiable sur iOS Safari / simulateur),
 * pas uniquement sur navigator.onLine qui déclenche des faux « hors ligne ».
 */
export function useAppConnectivity(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const reachable = await probeApiReachable()
      if (!cancelled) setOnline(reachable)
    }

    void refresh()

    const onConnectivityChange = () => {
      void refresh()
    }

    window.addEventListener('online', onConnectivityChange)
    window.addEventListener('offline', onConnectivityChange)
    const intervalId = window.setInterval(refresh, PROBE_INTERVAL_MS)

    return () => {
      cancelled = true
      window.removeEventListener('online', onConnectivityChange)
      window.removeEventListener('offline', onConnectivityChange)
      window.clearInterval(intervalId)
    }
  }, [])

  return online
}
