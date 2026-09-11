import { describe, expect, it } from 'vitest'
import {
  buildBcLigneDisplayRows,
  clampQtyToDevis,
  filterForfaitBcLigneIds,
  filterForfaitBcLignes,
  isForfaitBcJalon,
  isForfaitBcLigne,
  qtyExceedsDevis,
  resolveDevisDisplayMeta,
} from './bcLigneDisplay'
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

describe('resolveDevisDisplayMeta', () => {
  const meta = { devis_jalons: [{ id: 'j1', libelle: 'Lot', product_ref_article_ids: [] }] }

  it('prefers devis_display_meta on BL payload', () => {
    expect(resolveDevisDisplayMeta({ devis_display_meta: meta })).toEqual(meta)
  })

  it('falls back to snake_case bon_commande.quote.meta', () => {
    expect(
      resolveDevisDisplayMeta({
        bon_commande: { quote: { meta } },
      }),
    ).toEqual(meta)
  })
})

describe('quantite devis helpers', () => {
  it('detects and clamps quantities above devis max', () => {
    expect(qtyExceedsDevis('3', 2)).toBe(true)
    expect(qtyExceedsDevis('2', 2)).toBe(false)
    expect(clampQtyToDevis('5', 2)).toBe('2')
    expect(clampQtyToDevis('1.5', 2)).toBe('1.5')
  })
})

describe('forfait bc lignes', () => {
  it('treats all lines as forfait when document is forfait', () => {
    const meta = { mode_devis: 'forfait' }
    expect(isForfaitBcLigne(line(1, 10, 0), meta)).toBe(true)
    expect(isForfaitBcLigne(line(2, null, 1), meta)).toBe(true)
    expect(filterForfaitBcLignes([line(1, 10, 0), line(2, null, 1)], meta)).toHaveLength(2)
  })

  it('detects forfait jalons for mass qty', () => {
    const meta = {
      devis_jalons: [
        { id: 'j1', libelle: 'Lot forfait', mode: 'forfait', product_ref_article_ids: [101] },
        { id: 'j2', libelle: 'Lot détaillé', mode: 'detaille', product_ref_article_ids: [200] },
      ],
    }
    expect(isForfaitBcJalon('j1', meta)).toBe(true)
    expect(isForfaitBcJalon('j2', meta)).toBe(false)
    const byId = new Map([
      [1, line(1, 101, 0)],
      [2, line(2, 200, 1)],
    ])
    expect(filterForfaitBcLigneIds([1, 2], byId, meta)).toEqual([1])
  })

  it('filters lines linked to forfait jalons only', () => {
    const meta = {
      devis_jalons: [
        {
          id: 'j1',
          libelle: 'Lot forfait',
          mode: 'forfait',
          product_ref_article_ids: [101],
        },
        {
          id: 'j2',
          libelle: 'Lot détaillé',
          mode: 'detaille',
          product_ref_article_ids: [200],
        },
      ],
    }
    const lignes = [line(1, 101, 0), line(2, 200, 1), line(3, null, 2)]
    expect(filterForfaitBcLignes(lignes, meta).map((l) => l.id)).toEqual([1])
  })
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
    expect(rows[0].type === 'jalon_header' && rows[0].ligneIds).toEqual([1, 2])
    expect(rows[1].type === 'product' && rows[1].nested).toBe(true)
    expect(rows[3].type === 'product' && rows[3].nested).toBe(false)
  })
})
