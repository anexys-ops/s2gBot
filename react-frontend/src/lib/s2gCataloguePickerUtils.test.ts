import { describe, expect, it } from 'vitest'
import {
  buildJalonCountByQualificationCode,
  formatProductCount,
  formatStockBadge,
  groupQualificationTags,
  hasPrice,
} from './s2gCataloguePickerUtils'
import type { RefArticleRow, RefQualificationTagRow } from '../api/client'

describe('s2gCataloguePickerUtils', () => {
  it('compte les jalons par code qualification', () => {
    const jalons = [
      {
        qualification_tags: [{ code: 'ALC', id: 1, label: 'A', display_label: 'A La Carte', groupe: 'G1' }],
      },
      {
        qualification_tags: [{ code: 'ALC', id: 1, label: 'A', display_label: 'A La Carte', groupe: 'G1' }],
      },
    ] as RefArticleRow[]
    const map = buildJalonCountByQualificationCode(jalons)
    expect(map.get('ALC')).toBe(2)
  })

  it('groupe les qualifications par groupe et tri par nom', () => {
    const tags: RefQualificationTagRow[] = [
      { id: 2, code: 'B', label: 'B', display_label: 'Beta', groupe: 'Cat A' },
      { id: 1, code: 'A', label: 'A', display_label: 'Alpha', groupe: 'Cat A' },
    ]
    const groups = groupQualificationTags(tags, new Map([['A', 3], ['B', 1]]), 'name-asc')
    expect(groups).toHaveLength(1)
    expect(groups[0].groupe).toBe('Cat A')
    expect(groups[0].tags.map((t) => t.code)).toEqual(['A', 'B'])
    expect(groups[0].jalonCount).toBe(4)
  })

  it('formate stock et prix', () => {
    expect(formatProductCount(2, 'jalon')).toBe('2 jalons')
    expect(formatProductCount(1, 'qualification')).toBe('1 qualif.')
    expect(hasPrice('12.5')).toBe(true)
    expect(hasPrice('0')).toBe(false)
    expect(
      formatStockBadge({
        id: 1,
        description: '',
        track_stock: true,
        stock_quantity: 3,
        code: 'X',
        name: 'X',
        kind: 'product',
        active: true,
        unit: 'U',
        purchase_price_ht: 0,
        sale_price_ht: 0,
        default_tva_rate: 20,
      }),
    ).toBe('Stock 3')
  })
})
