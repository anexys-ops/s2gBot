import { describe, expect, it } from 'vitest'
import type { PlanningEvent } from '../../api/client'
import { eventStatus, matchesText, weekRange } from './planningGlobalFilters'

describe('filtres du planning global', () => {
  it('affiche la semaine du lundi au dimanche, même au changement d’année', () => {
    expect(weekRange(new Date(2026, 8, 24, 12))).toEqual({ from: '2026-09-21', to: '2026-09-27' })
    expect(weekRange(new Date(2027, 0, 1, 12))).toEqual({ from: '2026-12-28', to: '2027-01-03' })
  })

  it('reprend le statut de la tâche, puis celui de l’événement isolé', () => {
    expect(eventStatus({ mission_task: { id: 1, statut: 'in_progress' }, is_validated: true } as PlanningEvent)).toBe('in_progress')
    expect(eventStatus({ is_validated: true } as PlanningEvent)).toBe('confirmed')
    expect(eventStatus({ is_validated: false } as PlanningEvent)).toBe('todo')
  })

  it('recherche sans tenir compte des accents et de la casse', () => {
    expect(matchesText('Étalonnage du matériel', 'etalonnage')).toBe(true)
    expect(matchesText('Étalonnage du matériel', 'CHANTIER')).toBe(false)
  })
})
