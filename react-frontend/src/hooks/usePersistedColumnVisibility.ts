import { useCallback, useState } from 'react'

export function usePersistedColumnVisibility(storageKey: string, defaults: Record<string, boolean>) {
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(`table-cols:${storageKey}`)
      if (!raw) return { ...defaults }
      const parsed = JSON.parse(raw) as Record<string, boolean>
      return { ...defaults, ...parsed }
    } catch {
      return { ...defaults }
    }
  })

  const toggle = useCallback(
    (id: string) => {
      setVisible((prev) => {
        const next = { ...prev, [id]: !prev[id] }
        localStorage.setItem(`table-cols:${storageKey}`, JSON.stringify(next))
        return next
      })
    },
    [storageKey],
  )

  return { visible, toggle }
}
