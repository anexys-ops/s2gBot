import { SITE_STATUSES, type SiteStatus } from '../types/enums'

/** Statuts chantier (alignés sur `App\Models\Site::STATUSES`). */
export const SITE_STATUS_KEYS = SITE_STATUSES

export type SiteStatusKey = SiteStatus

export const SITE_STATUS_LABELS: Record<SiteStatusKey, string> = {
  not_started: 'Pas commencé',
  in_progress: 'En cours',
  blocked: 'Bloqué',
  delivered: 'Livré',
  archived: 'Archivé',
}

const SITE_STATUS_TONES: Record<SiteStatusKey, 'slate' | 'teal' | 'red' | 'emerald' | 'violet'> = {
  not_started: 'slate',
  in_progress: 'teal',
  blocked: 'red',
  delivered: 'emerald',
  archived: 'violet',
}

export function presentationSiteStatus(status: string | null | undefined): {
  key: SiteStatusKey
  label: string
  tone: (typeof SITE_STATUS_TONES)[SiteStatusKey]
  emoji: string
} {
  const key = (SITE_STATUS_KEYS as readonly string[]).includes(String(status))
    ? (status as SiteStatusKey)
    : 'not_started'
  const emoji: Record<SiteStatusKey, string> = {
    not_started: '○',
    in_progress: '▶',
    blocked: '⛔',
    delivered: '✓',
    archived: '📦',
  }
  return {
    key,
    label: SITE_STATUS_LABELS[key],
    tone: SITE_STATUS_TONES[key],
    emoji: emoji[key],
  }
}
