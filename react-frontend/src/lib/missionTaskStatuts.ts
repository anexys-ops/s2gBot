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
  todo:        { label: 'À faire',   color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'En cours',  color: '#f59e0b', bg: '#fef3c7' },
  paused:      { label: 'En pause',  color: '#8b5cf6', bg: '#ede9fe' },
  frozen:      { label: 'Gelée',     color: '#0ea5e9', bg: '#e0f2fe' },
  done:        { label: 'Terminé',   color: '#3b82f6', bg: '#dbeafe' },
  validated:   { label: 'Validé',    color: '#10b981', bg: '#d1fae5' },
  rejected:    { label: 'Rejeté',    color: '#ef4444', bg: '#fee2e2' },
}

export const TASK_STATUTS = Object.keys(TASK_STATUT_META) as Array<keyof typeof TASK_STATUT_META>

export function getTaskStatutMeta(statut: string): TaskStatutMeta {
  return TASK_STATUT_META[statut] ?? { label: statut, color: '#6b7280', bg: '#f3f4f6' }
}

export function getTaskStatutLabel(statut: string): string {
  return TASK_STATUT_META[statut]?.label ?? statut
}
