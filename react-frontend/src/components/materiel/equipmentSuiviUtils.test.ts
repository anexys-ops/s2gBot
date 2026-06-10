import { describe, expect, it } from 'vitest'
import { dateInputValue, daysInRange, toLocalDateInput } from './equipmentSuiviUtils'

describe('dateInputValue', () => {
  it('keeps plain Y-m-d values', () => {
    expect(dateInputValue('2026-06-17')).toBe('2026-06-17')
  })

  it('uses local calendar day for ISO datetimes (not UTC prefix)', () => {
    const iso = '2026-06-16T23:00:00.000000Z'
    expect(dateInputValue(iso)).toBe(toLocalDateInput(new Date(iso)))
  })
})

describe('daysInRange', () => {
  it('expands inclusive local ranges from API date strings', () => {
    expect(daysInRange('2026-06-17', '2026-06-20')).toEqual([
      '2026-06-17',
      '2026-06-18',
      '2026-06-19',
      '2026-06-20',
    ])
  })

  it('expands inclusive ranges from ISO datetimes', () => {
    const from = '2026-06-16T23:00:00.000000Z'
    const to = '2026-06-19T23:00:00.000000Z'
    const expectedFrom = dateInputValue(from)
    const expectedTo = dateInputValue(to)
    const days = daysInRange(from, to)
    expect(days[0]).toBe(expectedFrom)
    expect(days[days.length - 1]).toBe(expectedTo)
    expect(days).toHaveLength(
      Math.round((new Date(expectedTo).getTime() - new Date(expectedFrom).getTime()) / 86_400_000) + 1,
    )
  })
})
