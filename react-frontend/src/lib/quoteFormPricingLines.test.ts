import { describe, expect, it } from 'vitest'
import { forfaitJalonTotalHt, forfaitJalonUnitPrice } from './quoteForfaitJalon'
import { quoteFormPricingLines } from './quoteTotals'

describe('quoteForfaitJalon', () => {
  it('computes total HT from quantity and unit price', () => {
    expect(forfaitJalonTotalHt({ quantity: 3, prix_unitaire_ht: 250 })).toBe(750)
  })

  it('falls back to montant_ht when unit price is absent', () => {
    expect(forfaitJalonUnitPrice({ montant_ht: 900 })).toBe(900)
    expect(forfaitJalonTotalHt({ montant_ht: 900 })).toBe(900)
  })
})

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
          quantity: 2,
          prix_unitaire_ht: 750,
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

  it('sums jalon forfait amounts in document forfait mode', () => {
    const lines = quoteFormPricingLines(
      [],
      [
        { id: 'j1', quantity: 2, prix_unitaire_ht: 500, montant_ht: 1000 },
        { id: 'j2', quantity: 1, prix_unitaire_ht: 300, montant_ht: 300 },
      ],
      20,
      true,
      0,
    )

    expect(lines).toEqual([{ quantity: 1, unit_price: 1300, discount_percent: 0, tva_rate: 20 }])
  })
})
