import { useCallback, useMemo, useState } from 'react'
import type { ListQueryParams, ListSortDirection } from '../api/client'

/** Clés de tri standard, identiques sur toutes les vues liste (cf. App\Support\ListQuery). */
export type ListSortKey = 'created_at' | 'date' | 'numero' | 'client' | 'nom' | 'montant' | 'statut'

export const LIST_SORT_LABELS: Record<ListSortKey, string> = {
  created_at: 'Date de création',
  date: 'Date du document',
  numero: 'Numéro / référence',
  client: 'Client',
  nom: 'Nom',
  montant: 'Montant',
  statut: 'Statut',
}

export type ListSortOption = { key: ListSortKey; label?: string }

export type ListControlsState = {
  sort: ListSortKey
  direction: ListSortDirection
  clientId: number | ''
  createdFrom: string
  createdTo: string
}

const DEFAULT_STATE: ListControlsState = {
  sort: 'created_at',
  direction: 'desc',
  clientId: '',
  createdFrom: '',
  createdTo: '',
}

/** Sens naturel d'un tri : dates et montants du plus récent / grand, textes de A à Z. */
export function defaultDirectionFor(sort: ListSortKey): ListSortDirection {
  return sort === 'created_at' || sort === 'date' || sort === 'montant' ? 'desc' : 'asc'
}

export type ListControls = ListControlsState & {
  setSort: (sort: ListSortKey) => void
  toggleDirection: () => void
  setClientId: (id: number | '') => void
  setCreatedFrom: (date: string) => void
  setCreatedTo: (date: string) => void
  reset: () => void
  /** Nombre de filtres actifs (client, période). */
  activeFilterCount: number
  /** Paramètres à passer aux appels API de liste. */
  params: ListQueryParams
}

/**
 * Tri (« Trier par » + sens) et filtres communs (client, période de création) d'une vue liste,
 * mémorisés par liste dans le navigateur. Par défaut : les plus récents d'abord.
 */
export function useListControls(storageKey: string, onChange?: () => void): ListControls {
  const key = `list-controls:${storageKey}`
  const [state, setState] = useState<ListControlsState>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<ListControlsState>) } : DEFAULT_STATE
    } catch {
      return DEFAULT_STATE
    }
  })

  const update = useCallback(
    (patch: Partial<ListControlsState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch }
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* stockage indisponible : l'état reste en mémoire */
        }
        return next
      })
      onChange?.()
    },
    [key, onChange],
  )

  return useMemo(() => ({
    ...state,
    setSort: (sort) => update({ sort, direction: defaultDirectionFor(sort) }),
    toggleDirection: () => update({ direction: state.direction === 'asc' ? 'desc' : 'asc' }),
    setClientId: (clientId) => update({ clientId }),
    setCreatedFrom: (createdFrom) => update({ createdFrom }),
    setCreatedTo: (createdTo) => update({ createdTo }),
    reset: () => update(DEFAULT_STATE),
    activeFilterCount: (state.clientId ? 1 : 0) + (state.createdFrom ? 1 : 0) + (state.createdTo ? 1 : 0),
    params: {
      sort: state.sort,
      direction: state.direction,
      client_id: state.clientId || undefined,
      created_from: state.createdFrom || undefined,
      created_to: state.createdTo || undefined,
    },
  }), [state, update])
}

type SortAccessor<T> = (row: T) => string | number | null | undefined

/**
 * Même tri et mêmes filtres pour les listes chargées en entier (sans pagination serveur).
 * $accessors : valeur de chaque clé de tri ; createdAt / clientId pour les filtres.
 */
export function applyListControlsLocally<T>(
  rows: T[],
  controls: ListControlsState,
  accessors: Partial<Record<ListSortKey, SortAccessor<T>>> & {
    clientId?: (row: T) => number | null | undefined
  },
): T[] {
  const createdAt = accessors.created_at
  const filtered = rows.filter((row) => {
    if (controls.clientId && accessors.clientId && accessors.clientId(row) !== controls.clientId) return false
    if ((controls.createdFrom || controls.createdTo) && createdAt) {
      const day = String(createdAt(row) ?? '').slice(0, 10)
      if (controls.createdFrom && (!day || day < controls.createdFrom)) return false
      if (controls.createdTo && (!day || day > controls.createdTo)) return false
    }
    return true
  })
  const get = accessors[controls.sort] ?? createdAt
  if (!get) return filtered
  const factor = controls.direction === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const va = get(a)
    const vb = get(b)
    if (va == null || va === '') return 1
    if (vb == null || vb === '') return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
    return String(va).localeCompare(String(vb), 'fr', { numeric: true, sensitivity: 'base' }) * factor
  })
}
