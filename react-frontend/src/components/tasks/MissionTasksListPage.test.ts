import { describe, expect, it } from 'vitest'
import type { MissionTask } from '../../api/client'
import { taskDelayDays, taskFilterKey, taskReferenceDate } from './MissionTasksListPage'

describe('MissionTasksListPage helpers', () => {
  it('regroupe une tâche en pause avec les tâches en cours', () => {
    expect(taskFilterKey('paused')).toBe('in_progress')
    expect(taskFilterKey('frozen')).toBe('frozen')
  })

  it('calcule le retard depuis la date programmée', () => {
    const task = { statut: 'todo', planned_date: '2026-09-20' } as MissionTask
    expect(taskReferenceDate(task)).toBe('2026-09-20')
    expect(taskDelayDays(task, new Date(2026, 8, 22))).toBe(2)
  })

  it('ne signale plus de retard pour une tâche clôturée', () => {
    const task = { statut: 'validated', planned_date: '2026-09-01' } as MissionTask
    expect(taskDelayDays(task, new Date(2026, 8, 22))).toBeNull()
  })
})
