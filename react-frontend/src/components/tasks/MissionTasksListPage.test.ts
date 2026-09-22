import { describe, expect, it } from 'vitest'
import type { MissionTask } from '../../api/client'
import { normalizePvNumbers, taskDelayDays, taskFilterKey, taskQuantityUnit, taskReferenceDate } from './MissionTasksListPage'

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

  it('récupère en priorité l’unité de la tâche puis celle du produit', () => {
    const productTask = { ordreMissionLigne: { article: { unite: 'm²' } } } as MissionTask
    expect(taskQuantityUnit(productTask, 'terrain')).toEqual({ value: 'm²', source: 'Produit' })

    const savedTask = { ...productTask, quantity_unit: 'carotte' } as MissionTask
    expect(taskQuantityUnit(savedTask, 'terrain')).toEqual({ value: 'carotte', source: 'Tâche' })
  })

  it('transforme les numéros de PV en badges uniques', () => {
    expect(normalizePvNumbers(['PV-1, PV-2', 'pv-1', 'PV-3; PV-2'])).toEqual(['PV-1', 'PV-2', 'PV-3'])
  })
})
