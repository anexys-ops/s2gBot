export const SAMPLE_TYPES = ['sol', 'eau', 'beton', 'granulat', 'roche', 'enrobe', 'autre'] as const

export type ConditionState = 'bon' | 'endommage' | 'insuffisant'

export type SampleFormDraft = {
  key: string
  condition_state: ConditionState
  storage_location: string
  collected_by: number | ''
  sample_type: string
  weight_g: string
  notes: string
  description: string
  photoFile: File | null
  photoPreview: string | null
}

export function createEmptyDraft(index: number, defaults?: Partial<SampleFormDraft>): SampleFormDraft {
  return {
    key: `draft-${Date.now()}-${index}`,
    condition_state: 'bon',
    storage_location: '',
    collected_by: '',
    sample_type: 'sol',
    weight_g: '',
    notes: '',
    description: '',
    photoFile: null,
    photoPreview: null,
    ...defaults,
  }
}

export function draftToReceiveBody(draft: SampleFormDraft): {
  condition_state: ConditionState
  storage_location?: string
  collected_by?: number
  sample_type?: string
  weight_g?: number
  notes?: string
  description?: string
} {
  return {
    condition_state: draft.condition_state,
    storage_location: draft.storage_location || undefined,
    collected_by: draft.collected_by ? Number(draft.collected_by) : undefined,
    sample_type: draft.sample_type,
    weight_g: draft.weight_g ? Number(draft.weight_g) : undefined,
    notes: draft.notes || undefined,
    description: draft.description || undefined,
  }
}
