import type { User } from '../api/client'

export const PORTAL_ROLES = ['client', 'site_contact'] as const

export type PortalModuleKey =
  | 'dossiers'
  | 'interventions'
  | 'rapports'
  | 'devis'
  | 'factures'
  | 'documents'

export const PORTAL_MODULE_LABELS: Record<PortalModuleKey, string> = {
  dossiers: 'Mes dossiers',
  interventions: 'Interventions (planifiées / en cours)',
  rapports: 'Rapports d\'essais livrés',
  devis: 'Devis',
  factures: 'Factures',
  documents: 'Documents partagés',
}

export const PORTAL_MODULE_DEFAULTS: PortalModuleKey[] = ['dossiers', 'interventions', 'rapports']

export function isPortalUser(user: User | null | undefined): boolean {
  if (!user) return false
  return user.is_portal_user === true || PORTAL_ROLES.includes(user.role as (typeof PORTAL_ROLES)[number])
}

export function effectivePortalModules(user: User | null | undefined): PortalModuleKey[] {
  if (!user || !isPortalUser(user)) return []
  const mods = user.effective_portal_modules
  if (Array.isArray(mods) && mods.length > 0) {
    return mods.filter((m): m is PortalModuleKey => m in PORTAL_MODULE_LABELS)
  }
  return PORTAL_MODULE_DEFAULTS
}

export function hasPortalModule(user: User | null | undefined, module: PortalModuleKey): boolean {
  return effectivePortalModules(user).includes(module)
}

export function portalHomePath(user: User | null | undefined): string {
  return isPortalUser(user) ? '/portal' : '/'
}
