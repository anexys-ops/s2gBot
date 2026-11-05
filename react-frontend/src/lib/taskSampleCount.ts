import type { TaskTestFormSummary } from '../api/client'

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Champ « Nombre d'échantillons » (clé ou libellé, accents et pluriel tolérés). */
export function isSampleCountField(field: { key?: string | null; label?: string | null }): boolean {
  return [field.key, field.label].some((raw) => {
    if (!raw) return false
    const n = normalize(raw)
    return /^(nombre|nb|nbre)_(d_)?(de_)?echantillons?$/.test(n)
  })
}

/**
 * Nombre d'échantillons saisi par le technicien dans un formulaire d'essai de la tâche,
 * utilisé pour préremplir le « Nombre d'étiquettes » (une étiquette par échantillon).
 * Premier formulaire renseigné qui porte ce champ ; null si aucun.
 */
export function sampleCountFromTaskForms(
  forms: TaskTestFormSummary[] | undefined,
): { count: number; formName: string } | null {
  for (const form of forms ?? []) {
    const answers = form.submission?.answers
    if (!answers) continue
    const fields = form.form_fields ?? []
    const keys = [
      ...fields.filter((f) => isSampleCountField(f)).map((f) => f.key),
      ...Object.keys(answers).filter((k) => isSampleCountField({ key: k })),
    ]
    for (const key of keys) {
      const value = Number(String(answers[key] ?? '').replace(',', '.'))
      if (Number.isFinite(value) && value >= 1) {
        return { count: Math.floor(value), formName: form.test_type.name }
      }
    }
  }
  return null
}
