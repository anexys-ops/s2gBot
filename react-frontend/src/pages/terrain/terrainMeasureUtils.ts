import type { ActionMeasureConfig, MissionTask, TaskMeasure } from '../../api/client'

export type MeasureDisplayStatut =
  | 'todo'
  | 'started'
  | 'in_progress'
  | 'paused'
  | 'frozen'
  | 'done'
  | 'validated'
  | 'rejected'

export const MESURE_STATUT_META: Record<MeasureDisplayStatut, { label: string; color: string; bg: string }> = {
  todo:        { label: 'À faire',    color: '#6b7280', bg: '#f3f4f6' },
  started:     { label: 'Commencé',   color: '#d97706', bg: '#fef3c7' },
  in_progress: { label: 'En cours',   color: '#f59e0b', bg: '#fef3c7' },
  paused:      { label: 'Pause',      color: '#7c3aed', bg: '#ede9fe' },
  frozen:      { label: 'Gelé',       color: '#0891b2', bg: '#cffafe' },
  done:        { label: 'Terminé',    color: '#3b82f6', bg: '#dbeafe' },
  validated:   { label: 'Validé',     color: '#10b981', bg: '#d1fae5' },
  rejected:    { label: 'Annulé',     color: '#ef4444', bg: '#fee2e2' },
}

export function measureConfigs(task: MissionTask): ActionMeasureConfig[] {
  return task.ordreMissionLigne?.articleAction?.measure_configs ?? []
}

export function measureIsFilled(measure: TaskMeasure | undefined): boolean {
  if (!measure) return false
  return Boolean(
    (measure.value != null && measure.value !== '') ||
    measure.value_numeric != null ||
    (measure.attachment_path != null && measure.attachment_path !== ''),
  )
}

export function measureProgress(task: MissionTask): {
  filled: number
  total: number
  required: number
  requiredFilled: number
  pct: number
} {
  const configs = measureConfigs(task)
  const measures = task.measures ?? []
  const byConfig = new Map(measures.map((m) => [m.measure_config_id, m]))
  const filled = configs.filter((c) => measureIsFilled(byConfig.get(c.id))).length
  const required = configs.filter((c) => c.is_required).length
  const requiredFilled = configs.filter((c) => c.is_required && measureIsFilled(byConfig.get(c.id))).length
  const total = configs.length
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0
  return { filled, total, required, requiredFilled, pct }
}

export function displayMeasureStatut(task: MissionTask): MeasureDisplayStatut {
  const { filled } = measureProgress(task)
  if (task.statut === 'rejected') return 'rejected'
  if (task.statut === 'paused') return 'paused'
  if (task.statut === 'frozen') return 'frozen'
  if (task.statut === 'validated') return 'validated'
  if (task.statut === 'done') return 'done'
  if (task.statut === 'in_progress') return 'in_progress'
  if (filled > 0) return 'started'
  return 'todo'
}

export function categorizeMeasureConfigs(configs: ActionMeasureConfig[]) {
  return {
    geotechnique: configs.filter((c) => ['number', 'date', 'boolean'].includes(c.field_type)),
    graphique: configs.filter((c) => c.field_type === 'file'),
    data: configs.filter((c) => ['text', 'select'].includes(c.field_type)),
  }
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  return new Date(value.includes('T') ? value : `${value}T12:00:00`).toLocaleDateString('fr-FR')
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export interface DossierMeasureRecap {
  key: string
  dossierId: number | null
  reference: string
  titre?: string | null
  client?: string | null
  site?: string | null
  dateDebut?: string | null
  dateFin?: string | null
  tasks: MissionTask[]
}

export function groupTasksByDossier(tasks: MissionTask[]): DossierMeasureRecap[] {
  const map = new Map<string, DossierMeasureRecap>()

  for (const task of tasks) {
    const om = task.ordreMissionLigne?.ordreMission
    const dossier = om?.dossier
    const key = dossier?.id != null ? String(dossier.id) : `none-${om?.numero ?? task.id}`

    if (!map.has(key)) {
      map.set(key, {
        key,
        dossierId: dossier?.id ?? null,
        reference: dossier?.reference ?? 'Sans dossier',
        titre: dossier?.titre,
        client: om?.client?.name ?? null,
        site: om?.site?.name ?? null,
        dateDebut: dossier?.date_debut ?? task.planned_date ?? null,
        dateFin: dossier?.date_fin_prevue ?? task.due_date ?? null,
        tasks: [],
      })
    }

    map.get(key)!.tasks.push(task)
  }

  return [...map.values()].sort((a, b) => {
    const da = a.dateDebut ?? ''
    const db = b.dateDebut ?? ''
    if (da !== db) return db.localeCompare(da)
    return a.reference.localeCompare(b.reference, 'fr')
  })
}

export function dossierProgress(recap: DossierMeasureRecap): {
  tasksTotal: number
  tasksDone: number
  measuresFilled: number
  measuresTotal: number
  pct: number
} {
  let measuresFilled = 0
  let measuresTotal = 0
  let tasksDone = 0

  for (const task of recap.tasks) {
    const p = measureProgress(task)
    measuresFilled += p.filled
    measuresTotal += p.total
    const statut = displayMeasureStatut(task)
    if (statut === 'done' || statut === 'validated') tasksDone += 1
  }

  return {
    tasksTotal: recap.tasks.length,
    tasksDone,
    measuresFilled,
    measuresTotal,
    pct: measuresTotal > 0 ? Math.round((measuresFilled / measuresTotal) * 100) : 0,
  }
}
