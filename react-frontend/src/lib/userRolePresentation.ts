export const USER_ROLE_LABELS: Record<string, string> = {
  lab_admin: 'Administrateur laboratoire',
  lab_technician: 'Technicien laboratoire',
  commercial: 'Commercial',
  ingenieur: 'Ingénieur',
  laborantin: 'Laborantin',
  responsable: 'Responsable',
  receptionnaire: 'Réceptionnaire',
  client: 'Client',
  site_contact: 'Contact chantier',
}

export type TechnicienOption = {
  id: number
  name: string
  email?: string
  role?: string
  poste?: string | null
  poste_label?: string
}

export function userRoleLabel(role?: string | null): string {
  if (!role) return '—'
  return USER_ROLE_LABELS[role] ?? role
}

export function userPosteLabel(user: { poste?: string | null; poste_label?: string; role?: string | null }): string {
  const explicit = user.poste_label?.trim() || user.poste?.trim()
  if (explicit) return explicit
  return userRoleLabel(user.role)
}

export function formatTechnicienOption(user: TechnicienOption): string {
  const poste = userPosteLabel(user)
  return poste && poste !== '—' ? `${user.name} — ${poste}` : user.name
}
