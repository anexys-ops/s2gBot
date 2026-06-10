export const MAINTENANCE_INTERVAL_OPTIONS = [
  { value: 1, label: 'Chaque mois' },
  { value: 3, label: 'Tous les 3 mois' },
  { value: 6, label: 'Tous les 6 mois' },
  { value: 12, label: 'Chaque année' },
  { value: 24, label: 'Tous les 2 ans' },
  { value: 36, label: 'Tous les 3 ans' },
] as const

export const MAINTENANCE_KIND_OPTIONS = [
  { value: 'etalonnage' as const, label: 'Étalonnage' },
  { value: 'maintenance' as const, label: 'Maintenance' },
  { value: 'verification' as const, label: 'Vérification' },
]

export function maintenanceKindLabel(kind: string): string {
  return MAINTENANCE_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind
}

export function intervalLabel(months: number): string {
  return MAINTENANCE_INTERVAL_OPTIONS.find((o) => o.value === months)?.label ?? `${months} mois`
}

export function affectationEndDate(row: {
  date_retour_effective?: string | null
  date_retour_prevue?: string | null
  date_debut: string
}): string {
  return row.date_retour_effective ?? row.date_retour_prevue ?? row.date_debut
}

/** Today as YYYY-MM-DD in local timezone (safe for date inputs). */
export function todayDateInput(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Normalize API / form dates to YYYY-MM-DD without UTC day shift. */
export function dateInputValue(value: string): string {
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Format a Date as YYYY-MM-DD in local timezone. */
export function toLocalDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Expand a date range into individual day strings (inclusive, local dates). */
export function daysInRange(from: string, to: string): string[] {
  const out: string[] = []
  const [y1, m1, d1] = dateInputValue(from).split('-').map(Number)
  const [y2, m2, d2] = dateInputValue(to).split('-').map(Number)
  const cur = new Date(y1, m1 - 1, d1)
  const end = new Date(y2, m2 - 1, d2)
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return out
  while (cur <= end) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
    )
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function isAffectationActiveOn(
  row: {
    date_debut: string
    date_retour_prevue?: string | null
    date_retour_effective?: string | null
  },
  day: string,
): boolean {
  const d = dateInputValue(day)
  const start = dateInputValue(row.date_debut)
  const end = dateInputValue(affectationEndDate(row))
  return d >= start && d <= end
}
