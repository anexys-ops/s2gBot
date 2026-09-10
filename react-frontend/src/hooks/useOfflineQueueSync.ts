import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearOfflineQueue,
  getOfflineQueueLength,
  OFFLINE_QUEUE_CHANGED_EVENT,
  OFFLINE_QUEUE_SYNCED_EVENT,
  replayOfflineQueue,
  type OfflineQueueReplayResult,
} from '../lib/offlineQueue'

type SyncState = {
  queueN: number
  syncing: boolean
  lastResult: OfflineQueueReplayResult | null
  lastError: string | null
}

export function useOfflineQueueSync(online: boolean) {
  const [state, setState] = useState<SyncState>({
    queueN: getOfflineQueueLength(),
    syncing: false,
    lastResult: null,
    lastError: null,
  })
  const wasOnlineRef = useRef(online)
  const autoSyncDoneRef = useRef(false)
  const syncingRef = useRef(false)

  const refreshCount = useCallback(() => {
    setState((s) => ({ ...s, queueN: getOfflineQueueLength() }))
  }, [])

  useEffect(() => {
    refreshCount()
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, refreshCount)
    return () => window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, refreshCount)
  }, [refreshCount])

  const runSync = useCallback(async (source: 'auto' | 'manual') => {
    if (syncingRef.current) return null
    const pending = getOfflineQueueLength()
    if (pending === 0) return null

    syncingRef.current = true
    setState((s) => ({ ...s, syncing: true, lastError: null }))
    try {
      const result = await replayOfflineQueue()
      setState((s) => ({
        ...s,
        syncing: false,
        queueN: getOfflineQueueLength(),
        lastResult: result,
        lastError:
          result.failed > 0
            ? result.errors[0] ?? `${result.failed} requête(s) n’ont pas pu être synchronisées.`
            : null,
      }))
      if (source === 'auto' && result.synced === 0 && result.failed === 0) {
        autoSyncDoneRef.current = false
      }
      return result
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setState((s) => ({
        ...s,
        syncing: false,
        lastError: message,
      }))
      return null
    } finally {
      syncingRef.current = false
    }
  }, [])

  useEffect(() => {
    const onSynced = () => refreshCount()
    window.addEventListener(OFFLINE_QUEUE_SYNCED_EVENT, onSynced)
    return () => window.removeEventListener(OFFLINE_QUEUE_SYNCED_EVENT, onSynced)
  }, [refreshCount])

  useEffect(() => {
    const cameOnline = online && !wasOnlineRef.current
    wasOnlineRef.current = online

    if (!online) {
      autoSyncDoneRef.current = false
      return
    }

    if (getOfflineQueueLength() === 0) return

    if (cameOnline || !autoSyncDoneRef.current) {
      autoSyncDoneRef.current = true
      void runSync('auto')
    }
  }, [online, runSync])

  const retry = useCallback(() => runSync('manual'), [runSync])

  const clear = useCallback(() => {
    if (state.syncing) return
    if (!window.confirm('Vider la file d’attente locale ? Les requêtes non synchronisées seront perdues.')) return
    clearOfflineQueue()
    setState((s) => ({
      ...s,
      queueN: 0,
      lastResult: null,
      lastError: null,
    }))
    autoSyncDoneRef.current = false
  }, [state.syncing])

  return {
    queueN: state.queueN,
    syncing: state.syncing,
    lastResult: state.lastResult,
    lastError: state.lastError,
    retry,
    clear,
  }
}
