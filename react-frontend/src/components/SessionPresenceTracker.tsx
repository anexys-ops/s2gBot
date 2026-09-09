import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { monitoringApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const HEARTBEAT_MS = 45_000

export default function SessionPresenceTracker() {
  const { user } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!user) return

    const page = `${location.pathname}${location.search}${location.hash}`
    const send = () => {
      monitoringApi.presence(page).catch(() => {})
    }

    send()
    const timer = window.setInterval(send, HEARTBEAT_MS)
    return () => window.clearInterval(timer)
  }, [user, location.pathname, location.search, location.hash])

  return null
}
