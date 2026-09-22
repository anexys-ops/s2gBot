/**
 * Source unique des statuts MissionTask.
 * Importer depuis ici pour garantir la cohérence de labels et couleurs
 * dans toutes les vues (labo, terrain, planning, rapports, OdM…).
 */

export interface TaskStatutMeta {
  label: string
  color: string
  bg: string
}

export const TASK_STATUT_META: Record<string, TaskStatutMeta> = {
  todo:        { label: 'Planifié',   color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'En cours',  color: '#f59e0b', bg: '#fef3c7' },
  paused:      { label: 'En cours',  color: '#f59e0b', bg: '#fef3c7' },
  frozen:      { label: 'Freeze',    color: '#0ea5e9', bg: '#e0f2fe' },
  done:        { label: 'Attente validation', color: '#3b82f6', bg: '#dbeafe' },
  validated:   { label: 'Clôturé',   color: '#10b981', bg: '#d1fae5' },
  rejected:    { label: 'Annulé',    color: '#ef4444', bg: '#fee2e2' },
}

export const TASK_FILTERS = [
  { key: 'in_progress', label: 'En cours', statuts: ['in_progress', 'paused'] },
  { key: 'frozen', label: 'Freeze', statuts: ['frozen'] },
  { key: 'rejected', label: 'Annulé', statuts: ['rejected'] },
  { key: 'todo', label: 'Planifié', statuts: ['todo'] },
  { key: 'validated', label: 'Clôturé', statuts: ['validated'] },
  { key: 'done', label: 'Attente validation', statuts: ['done'] },
] as const

export const TASK_STATUTS = Object.keys(TASK_STATUT_META) as Array<keyof typeof TASK_STATUT_META>

export function getTaskStatutMeta(statut: string): TaskStatutMeta {
  return TASK_STATUT_META[statut] ?? { label: statut, color: '#6b7280', bg: '#f3f4f6' }
}

export function getTaskStatutLabel(statut: string): string {
  return TASK_STATUT_META[statut]?.label ?? statut
}
