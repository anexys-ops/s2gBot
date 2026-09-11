import { requiredFieldMessage } from './messages'

export type FieldRule = {
  key: string
  label: string
  value: unknown
}

/** Retourne la première erreur trouvée ou null. */
export function validateRequiredFields(rules: FieldRule[]): string | null {
  for (const rule of rules) {
    const v = rule.value
    if (v === null || v === undefined) {
      return requiredFieldMessage(rule.label)
    }
    if (typeof v === 'string' && v.trim() === '') {
      return requiredFieldMessage(rule.label)
    }
  }
  return null
}
