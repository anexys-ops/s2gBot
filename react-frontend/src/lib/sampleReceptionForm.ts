export const SAMPLE_TYPES = ['sol', 'eau', 'beton', 'granulat', 'roche', 'enrobe', 'autre'] as const

export type ConditionState = 'bon' | 'endommage' | 'insuffisant'

export type SampleFormDraft = {
  key: string
  reception_index: number
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

export type CancelledSlot = {
  reception_index: number
  reason?: string
}

export function createEmptyDraft(receptionIndex: number, defaults?: Partial<SampleFormDraft>): SampleFormDraft {
  return {
    key: `draft-${Date.now()}-${receptionIndex}`,
    reception_index: receptionIndex,
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

export function draftToReceiveBody(
  draft: SampleFormDraft,
  batchTotal?: number,
): {
  condition_state: ConditionState
  storage_location?: string
  collected_by?: number
  sample_type?: string
  weight_g?: number
  notes?: string
  description?: string
  reception_index: number
  reception_batch_total?: number
} {
  return {
    condition_state: draft.condition_state,
    storage_location: draft.storage_location || undefined,
    collected_by: draft.collected_by ? Number(draft.collected_by) : undefined,
    sample_type: draft.sample_type,
    weight_g: draft.weight_g ? Number(draft.weight_g) : undefined,
    notes: draft.notes || undefined,
    description: draft.description || undefined,
    reception_index: draft.reception_index,
    reception_batch_total: batchTotal,
  }
}
