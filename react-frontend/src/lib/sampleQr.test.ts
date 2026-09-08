import { describe, expect, it } from 'vitest'
import { parseSampleQrContent } from './sampleQr'

describe('parseSampleQrContent', () => {
  it('retourne le FOLD tel quel', () => {
    expect(parseSampleQrContent('FOLD-10000042')).toBe('FOLD-10000042')
  })

  it('extrait le FOLD depuis un ancien JSON', () => {
    expect(parseSampleQrContent('{"fold":"FOLD-10000042","transco":"10000099"}')).toBe('FOLD-10000042')
  })

  it('accepte un numéro transco numérique', () => {
    expect(parseSampleQrContent('10000099')).toBe('10000099')
  })
})
