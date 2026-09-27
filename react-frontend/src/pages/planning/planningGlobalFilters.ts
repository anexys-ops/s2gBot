import type { PlanningEvent } from '../../api/client'

export type PlanningStatus = 'todo' | 'in_progress' | 'paused' | 'frozen' | 'rescheduled' | 'done' | 'validated' | 'rejected' | 'confirmed'

export const statusLabels: Record<PlanningStatus, string> = {
  todo: 'Planifié',
  in_progress: 'En cours',
  paused: 'En pause',
  frozen: 'Freeze',
  rescheduled: 'Replanifié',
  done: 'Attente validation',
  validated: 'Clôturé',
  rejected: 'Annulé',
  confirmed: 'Confirmé',
}

export function ymdLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function weekRange(day: Date): { from: string; to: string } {
  const monday = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return { from: ymdLocal(monday), to: ymdLocal(sunday) }
}

export function eventStatus(event: PlanningEvent): PlanningStatus {
  const status = event.mission_task?.statut
  if (status && status in statusLabels) return status as PlanningStatus
  return event.is_validated ? 'confirmed' : 'todo'
}

export function matchesText(value: string | null | undefined, search: string): boolean {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
  return normalize(value ?? '').includes(normalize(search.trim()))
}
