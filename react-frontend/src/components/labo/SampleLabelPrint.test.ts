import { describe, expect, it } from 'vitest'
import { stickerSampleRef } from './SampleLabelPrint'

describe('stickerSampleRef', () => {
  it('formats « transco - nombre d’échantillons »', () => {
    expect(stickerSampleRef({ fold: 'FOLD-1', transco: 'S2GPRODUITSS-10000006', reception_batch_total: 2 })).toBe('S2GPRODUITSS-10000006 - 2')
  })
  it('falls back to the FOLD before reception', () => {
    expect(stickerSampleRef({ fold: 'FOLD-1', transco: null })).toBe('FOLD-1')
  })
})
