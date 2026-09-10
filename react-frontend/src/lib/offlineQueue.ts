const KEY = 's2g_offline_queue_v1'
export const OFFLINE_QUEUE_CHANGED_EVENT = 's2g:offline-queue-changed'
export const OFFLINE_QUEUE_SYNCED_EVENT = 's2g:offline-queue-synced'

export type QueuedRequest = {
  id: string
  path: string
  method: string
  body: string | null
  createdAt: string
}

function readQueue(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueuedRequest[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(q: QueuedRequest[]) {
  localStorage.setItem(KEY, JSON.stringify(q))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT))
  }
}

export function getOfflineQueue(): QueuedRequest[] {
  return readQueue()
}

export function enqueueOfflineRequest(path: string, method: string, body: string | null) {
  const q = readQueue()
  q.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    path,
    method,
    body,
    createdAt: new Date().toISOString(),
  })
  writeQueue(q)
}

export function getOfflineQueueLength(): number {
  return readQueue().length
}

export function clearOfflineQueue() {
  localStorage.removeItem(KEY)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT))
  }
}

export type OfflineQueueReplayResult = {
  attempted: number
  synced: number
  failed: number
  errors: string[]
}

async function replayOne(item: QueuedRequest, token: string | null): Promise<{ ok: boolean; error?: string }> {
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(item.body ? { 'Content-Type': 'application/json' } : {}),
  }
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(item.path, {
      method: item.method,
      headers,
      body: item.body,
    })
    if (res.status === 401) {
      return { ok: false, error: 'Session expirée — reconnectez-vous avant de synchroniser.' }
    }
    if (!res.ok) {
      let detail = res.statusText
      try {
        const data = (await res.json()) as { message?: string }
        if (data.message) detail = data.message
      } catch {
        /* ignore */
      }
      return { ok: false, error: `${item.method} ${item.path} : ${detail}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Rejoue la file locale vers l’API (ordre chronologique). */
export async function replayOfflineQueue(): Promise<OfflineQueueReplayResult> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
  const queue = readQueue()
  const result: OfflineQueueReplayResult = {
    attempted: queue.length,
    synced: 0,
    failed: 0,
    errors: [],
  }

  if (queue.length === 0) {
    return result
  }

  const remaining: QueuedRequest[] = []

  for (const item of queue) {
    const outcome = await replayOne(item, token)
    if (outcome.ok) {
      result.synced += 1
    } else {
      result.failed += 1
      if (outcome.error) result.errors.push(outcome.error)
      remaining.push(item)
      if (outcome.error?.includes('Session expirée')) {
        remaining.push(...queue.slice(queue.indexOf(item) + 1))
        break
      }
    }
  }

  writeQueue(remaining)

  if (result.synced > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_SYNCED_EVENT))
  }

  return result
}
