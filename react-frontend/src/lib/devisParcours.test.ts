import { describe, expect, it } from 'vitest'
import { lineKeyForRow, reconcileDevisParcoursOnLoad } from './devisParcours'
import type { EntityMetaPayload } from '../api/client'

describe('reconcileDevisParcoursOnLoad', () => {
  it('remaps stale ligne keys and preserves mixed jalon/standalone order', () => {
    const lines = [
      { row_key: 'line-10', ref_article_id: 101, description: 'Standalone' },
      { row_key: 'line-11', ref_article_id: 201, description: 'Child A' },
      { row_key: 'line-12', ref_article_id: 202, description: 'Child B' },
      { row_key: 'line-13', ref_article_id: 301, description: 'Standalone 2' },
    ]
    const meta: EntityMetaPayload = {
      devis_jalons: [
        {
          id: 'j1',
          libelle: 'Jalon 1',
          product_ref_article_ids: [201, 202],
          product_line_keys: ['L-old-a', 'L-old-b'],
        },
      ],
      devis_parcours: [
        { kind: 'ligne', id: 'L-standalone-1' },
        { kind: 'jalon', id: 'j1' },
        { kind: 'ligne', id: 'L-old-a' },
        { kind: 'ligne', id: 'L-old-b' },
        { kind: 'ligne', id: 'L-standalone-2' },
      ],
    }

    const next = reconcileDevisParcoursOnLoad(lines, meta)
    expect(next.devis_parcours).toEqual([
      { kind: 'ligne', id: 'line-10' },
      { kind: 'jalon', id: 'j1' },
      { kind: 'ligne', id: 'line-11' },
      { kind: 'ligne', id: 'line-12' },
      { kind: 'ligne', id: 'line-13' },
    ])
    expect(next.devis_jalons?.[0].product_line_keys).toEqual(['line-11', 'line-12'])
  })

  it('keeps valid parcours unchanged', () => {
    const lines = [{ row_key: 'line-1', ref_article_id: 1 }]
    const meta: EntityMetaPayload = {
      devis_jalons: [{ id: 'j1', libelle: 'J', product_ref_article_ids: [] }],
      devis_parcours: [
        { kind: 'jalon', id: 'j1' },
        { kind: 'ligne', id: 'line-1' },
      ],
    }
    const next = reconcileDevisParcoursOnLoad(lines, meta)
    expect(next.devis_parcours).toEqual(meta.devis_parcours)
  })

  it('builds interleaved parcours when none was stored', () => {
    const lines = [
      { row_key: 'line-1', ref_article_id: 10 },
      { row_key: 'line-2', ref_article_id: 20 },
    ]
    const meta: EntityMetaPayload = {
      devis_jalons: [
        { id: 'j1', libelle: 'J', product_ref_article_ids: [20] },
      ],
    }
    const next = reconcileDevisParcoursOnLoad(lines, meta)
    expect(next.devis_parcours).toEqual([
      { kind: 'ligne', id: 'line-1' },
      { kind: 'jalon', id: 'j1' },
      { kind: 'ligne', id: 'line-2' },
    ])
    expect(lineKeyForRow(lines[0], 0)).toBe('line-1')
  })
})
