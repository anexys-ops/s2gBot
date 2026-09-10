import { describe, expect, it } from 'vitest'
import {
  addLocalDays,
  dateInputFromApi,
  formatAppDate,
  todayLocalDateInput,
  toLocalDateInput,
} from './appLocale'

describe('appLocale calendar dates', () => {
  it('formatAppDate keeps YYYY-MM-DD as the same calendar day (no UTC shift)', () => {
    expect(formatAppDate('2026-09-10')).toMatch(/10\/09\/2026/)
  })

  it('dateInputFromApi preserves plain API dates', () => {
    expect(dateInputFromApi('2026-09-10')).toBe('2026-09-10')
    expect(dateInputFromApi('2026-09-10T00:00:00.000000Z')).toBe('2026-09-10')
  })

  it('toLocalDateInput uses local calendar components', () => {
    const d = new Date(2026, 8, 10, 23, 30)
    expect(toLocalDateInput(d)).toBe('2026-09-10')
  })

  it('addLocalDays adds calendar days locally', () => {
    expect(addLocalDays('2026-09-10', 7)).toBe('2026-09-17')
  })

  it('todayLocalDateInput matches toLocalDateInput(new Date())', () => {
    expect(todayLocalDateInput()).toBe(toLocalDateInput(new Date()))
  })
})
