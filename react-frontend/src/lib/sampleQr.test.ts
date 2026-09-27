import { describe, expect, it } from 'vitest'
import { parseSampleQrContent } from './sampleQr'

describe('parseSampleQrContent', () => {
  it('retourne le FOLD tel quel', () => {
    expect(parseSampleQrContent('FOLD-10000042')).toBe('FOLD-10000042')
  })

  it('extrait le FOLD depuis un JSON étiquette réception', () => {
    expect(
      parseSampleQrContent(
        '{"date":"2026-09-08 10:00:00","technicien":"Jean Dupont","fold":"FOLD-10000042","prelevements":4}',
      ),
    ).toBe('FOLD-10000042')
  })

  it('accepte un numéro transco numérique', () => {
    expect(parseSampleQrContent('10000099')).toBe('10000099')
  })
})
