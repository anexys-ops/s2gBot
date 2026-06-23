import { describe, expect, it } from 'vitest'
import { buildBcLigneDisplayRows } from './bcLigneDisplay'
import type { BonCommandeLigne } from '../api/client'

const line = (id: number, ref: number | null, ordre: number): BonCommandeLigne => ({
  id,
  libelle: `Ligne ${id}`,
  quantite: 1,
  prix_unitaire_ht: 100,
  tva_rate: 20,
  montant_ht: 100,
  ref_article_id: ref,
  ordre,
})

describe('buildBcLigneDisplayRows', () => {
  it('returns flat products when no devis structure', () => {
    const rows = buildBcLigneDisplayRows([line(1, 10, 0), line(2, 20, 1)], null)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.type === 'product' && !r.nested)).toBe(true)
  })

  it('groups products under jalon then standalone', () => {
    const rows = buildBcLigneDisplayRows(
      [line(1, 101, 0), line(2, 102, 1), line(3, 200, 2)],
      {
        devis_jalons: [
          {
            id: 'j1',
            libelle: 'Lot essais',
            s2g_code: 'J-01',
            product_ref_article_ids: [101, 102],
          },
        ],
        devis_parcours: [
          { kind: 'jalon', id: 'j1' },
          { kind: 'ligne', id: 'x' },
        ],
      },
    )
    expect(rows.map((r) => r.type)).toEqual(['jalon_header', 'product', 'product', 'product'])
    expect(rows[0].type === 'jalon_header' && rows[0].label).toBe('Lot essais')
    expect(rows[1].type === 'product' && rows[1].nested).toBe(true)
    expect(rows[3].type === 'product' && rows[3].nested).toBe(false)
  })
})
