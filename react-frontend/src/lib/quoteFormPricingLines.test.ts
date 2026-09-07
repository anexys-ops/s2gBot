import { describe, expect, it } from 'vitest'
import {
  clearedForfaitJalonPricing,
  effectiveForfaitDocumentHt,
  forfaitJalonTotalHt,
  forfaitJalonUnitPrice,
  htFromTtc,
  ttcFromHt,
} from './quoteForfaitJalon'
import { quoteFormPricingLines } from './quoteTotals'

describe('quoteForfaitJalon', () => {
  it('computes total HT from quantity and unit price', () => {
    expect(forfaitJalonTotalHt({ quantity: 3, prix_unitaire_ht: 250 })).toBe(750)
  })

  it('falls back to montant_ht when unit price is absent', () => {
    expect(forfaitJalonUnitPrice({ montant_ht: 900 })).toBe(900)
    expect(forfaitJalonTotalHt({ montant_ht: 900 })).toBe(900)
  })

  it('prefers jalon sum over global tarif', () => {
    expect(
      effectiveForfaitDocumentHt([{ prix_unitaire_ht: 500, quantity: 2 }], 999),
    ).toBe(1000)
  })

  it('uses global tarif when jalons have no prices', () => {
    expect(effectiveForfaitDocumentHt([{ id: 'j1' }], 2500)).toBe(2500)
    expect(effectiveForfaitDocumentHt([], 1800)).toBe(1800)
  })

  it('converts HT and TTC both ways', () => {
    expect(ttcFromHt(100, 20)).toBe(120)
    expect(htFromTtc(120, 20)).toBe(100)
  })

  it('clears jalon pricing fields', () => {
    expect(
      clearedForfaitJalonPricing({
        id: 'j1',
        libelle: 'Lot',
        quantity: 2,
        prix_unitaire_ht: 500,
        montant_ht: 1000,
      }),
    ).toEqual({ id: 'j1', libelle: 'Lot', quantity: 2 })
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
