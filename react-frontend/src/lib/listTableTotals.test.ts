import { describe, expect, it } from 'vitest'
import { sumNumeric } from './listTableTotals'

describe('sumNumeric', () => {
  it('adds finite numeric values', () => {
    expect(
      sumNumeric(
        [{ ht: 10 }, { ht: '20.5' }, { ht: null }],
        (row) => row.ht,
      ),
    ).toBe(30.5)
  })

  it('ignores non-finite values', () => {
    expect(sumNumeric([{ v: NaN }, { v: 'x' }, { v: 5 }], (row) => row.v)).toBe(5)
  })
})
