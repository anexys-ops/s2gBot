import type { EquipmentRow } from '../../api/client'

export type EquipmentStatus = 'active' | 'maintenance' | 'retired'

export type EquipmentFormState = {
  code: string
  name: string
  type: string
  brand: string
  model: string
  serial_number: string
  location: string
  agency_id: string
  purchase_date: string
  status: EquipmentStatus
  test_type_ids: number[]
}

export const EQUIPMENT_STATUS_OPTIONS: { value: EquipmentStatus; label: string }[] = [
  { value: 'active', label: 'Actif' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retiré' },
]

export function emptyEquipmentForm(): EquipmentFormState {
  return {
    code: '',
    name: '',
    type: '',
    brand: '',
    model: '',
    serial_number: '',
    location: '',
    agency_id: '',
    purchase_date: '',
    status: 'active',
    test_type_ids: [],
  }
}

export function equipmentFormFromRow(eq: EquipmentRow): EquipmentFormState {
  const status = eq.status as EquipmentStatus
  return {
    code: eq.code,
    name: eq.name,
    type: eq.type ?? '',
    brand: eq.brand ?? '',
    model: eq.model ?? '',
    serial_number: eq.serial_number ?? '',
    location: eq.location ?? '',
    agency_id: eq.agency_id != null ? String(eq.agency_id) : '',
    purchase_date: eq.purchase_date ? String(eq.purchase_date).slice(0, 10) : '',
    status: EQUIPMENT_STATUS_OPTIONS.some((o) => o.value === status) ? status : 'active',
    test_type_ids: eq.test_types?.map((t) => t.id) ?? [],
  }
}

export function equipmentFormToPayload(form: EquipmentFormState) {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    type: form.type.trim() || null,
    brand: form.brand.trim() || null,
    model: form.model.trim() || null,
    serial_number: form.serial_number.trim() || null,
    location: form.location.trim() || null,
    agency_id: form.agency_id ? Number(form.agency_id) : null,
    purchase_date: form.purchase_date.trim() || null,
    status: form.status,
    test_type_ids: form.test_type_ids,
  }
}
