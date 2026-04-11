const KEY = 's2g_offline_queue_v1'

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
}
