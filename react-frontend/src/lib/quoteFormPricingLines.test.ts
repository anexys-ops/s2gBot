import { describe, expect, it } from 'vitest'
import { quoteFormPricingLines } from './quoteTotals'

describe('quoteFormPricingLines', () => {
  it('uses jalon forfait HT and skips child article prices', () => {
    const lines = quoteFormPricingLines(
      [
        {
          row_key: 'child-1',
          parent_jalon_id: 'j-f',
          quantity: 2,
          unit_price: 400,
          discount_percent: 0,
          tva_rate: 20,
        },
        {
          row_key: 'libre',
          quantity: 1,
          unit_price: 100,
          discount_percent: 0,
          tva_rate: 20,
        },
      ],
      [
        {
          id: 'j-f',
          mode: 'forfait',
          montant_ht: 1500,
          tva_rate: 10,
          product_line_keys: ['child-1'],
        },
      ],
      20,
      false,
      0,
    )

    expect(lines).toEqual([
      { quantity: 1, unit_price: 100, discount_percent: 0, tva_rate: 20 },
      { quantity: 1, unit_price: 1500, discount_percent: 0, tva_rate: 10 },
    ])
  })
})
