import { describe, expect, it } from 'vitest'
import type { TaskTestFormSummary } from '../api/client'
import { isSampleCountField, sampleCountFromTaskForms } from './taskSampleCount'

const form = (name: string, answers: Record<string, unknown> | null, fields: Array<{ key: string; label: string }> = []) =>
  ({
    test_type: { id: 1, name },
    form_fields: fields,
    submission: answers ? { id: 1, status: 'submitted', answers } : null,
  }) as unknown as TaskTestFormSummary

describe('isSampleCountField', () => {
  it('matches the client field key and label variants', () => {
    expect(isSampleCountField({ key: 'nombre_d_echantillons' })).toBe(true)
    expect(isSampleCountField({ label: "Nombre d'échantillons" })).toBe(true)
    expect(isSampleCountField({ label: 'Nombre de échantillon' })).toBe(true)
    expect(isSampleCountField({ key: 'nature_d_echantillons' })).toBe(false)
  })
})

describe('sampleCountFromTaskForms', () => {
  it('returns the first filled sample count', () => {
    const res = sampleCountFromTaskForms([
      form('Déplacement', null),
      form('Prélèvement béton', { nombre_d_echantillons: '6' }, [{ key: 'nombre_d_echantillons', label: "Nombre d'échantillons" }]),
    ])
    expect(res).toEqual({ count: 6, formName: 'Prélèvement béton' })
  })

  it('ignores empty or invalid values', () => {
    expect(sampleCountFromTaskForms([form('X', { nombre_d_echantillons: '' })])).toBeNull()
    expect(sampleCountFromTaskForms(undefined)).toBeNull()
  })
})
