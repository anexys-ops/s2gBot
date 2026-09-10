import type { User } from '../api/client'

/** Clés modules.* alignées sur PermissionCatalog (backend). */
export type StaffModuleKey =
  | 'commercial'
  | 'dossiers'
  | 'terrain'
  | 'laboratoire'
  | 'ingenierie'
  | 'catalogue'
  | 'rapports'
  | 'configuration'

export const STAFF_MODULE_PERMISSION: Record<StaffModuleKey, string> = {
  commercial: 'modules.commercial',
  dossiers: 'modules.dossiers',
  terrain: 'modules.terrain',
  laboratoire: 'modules.laboratoire',
  ingenierie: 'modules.ingenierie',
  catalogue: 'modules.catalogue',
  rapports: 'modules.rapports',
  configuration: 'modules.configuration',
}

const ALL_MODULE_KEYS = Object.keys(STAFF_MODULE_PERMISSION) as StaffModuleKey[]

function isLabAdmin(user: User | null | undefined): boolean {
  return user?.role === 'lab_admin'
}

export function effectiveStaffPermissions(user: User | null | undefined): string[] {
  if (!user) return []
  if (isLabAdmin(user)) return ['*']
  return user.effective_permissions ?? []
}

export function hasStaffCapability(user: User | null | undefined, permission: string): boolean {
  const perms = effectiveStaffPermissions(user)
  if (perms.includes('*')) return true
  return perms.includes(permission)
}

export function canAccessStaffModule(user: User | null | undefined, module: StaffModuleKey): boolean {
  return hasStaffCapability(user, STAFF_MODULE_PERMISSION[module])
}

export function canAccessAnyStaffModule(user: User | null | undefined, modules: StaffModuleKey[]): boolean {
  return modules.some((m) => canAccessStaffModule(user, m))
}

export function visibleStaffModules(user: User | null | undefined): StaffModuleKey[] {
  if (isLabAdmin(user)) return ALL_MODULE_KEYS
  return ALL_MODULE_KEYS.filter((m) => canAccessStaffModule(user, m))
}

/** OdM : visible si au moins un pôle opérationnel (terrain / labo / ingénierie). */
export function canAccessOrdresMission(user: User | null | undefined): boolean {
  return canAccessAnyStaffModule(user, ['terrain', 'laboratoire', 'ingenierie'])
}

export function staffHomePath(user: User | null | undefined): string {
  if (canAccessStaffModule(user, 'commercial')) return '/devis'
  if (canAccessStaffModule(user, 'dossiers')) return '/dossiers'
  if (canAccessStaffModule(user, 'laboratoire')) return '/labo/taches'
  if (canAccessStaffModule(user, 'terrain')) return '/terrain/taches'
  if (canAccessStaffModule(user, 'ingenierie')) return '/ingenierie/taches'
  if (canAccessStaffModule(user, 'catalogue')) return '/catalogue'
  if (canAccessStaffModule(user, 'rapports')) return '/rapports'
  return '/'
}

/** Correspondance préfixe URL → module requis. */
export function requiredModuleForPath(pathname: string): StaffModuleKey | StaffModuleKey[] | null {
  if (pathname === '/' || pathname === '/aide' || pathname.startsWith('/settings')) return null
  if (pathname.startsWith('/devis') || pathname.startsWith('/factures') || pathname.startsWith('/invoices')) {
    return 'commercial'
  }
  if (pathname.startsWith('/clients') || pathname.startsWith('/sites')) return 'commercial'
  if (pathname.startsWith('/bons-commande') || pathname.startsWith('/bons-livraison')) return 'commercial'
  if (pathname.startsWith('/dossiers')) return 'dossiers'
  if (pathname.startsWith('/terrain') || pathname.startsWith('/notes-de-frais')) return 'terrain'
  if (pathname.startsWith('/labo')) return 'laboratoire'
  if (pathname.startsWith('/ingenierie')) return 'ingenierie'
  if (pathname.startsWith('/catalogue') || pathname.startsWith('/materiel')) return 'catalogue'
  if (pathname.startsWith('/rapports')) return 'rapports'
  if (pathname.startsWith('/ordres-mission')) {
    return ['terrain', 'laboratoire', 'ingenierie']
  }
  if (
    pathname.startsWith('/config/') ||
    pathname.startsWith('/back-office/modeles-documents-pdf') ||
    pathname.startsWith('/back-office/configuration')
  ) {
    return 'configuration'
  }
  if (pathname.startsWith('/settings/utilisateurs') || pathname.startsWith('/settings/groupes')) {
    return 'configuration'
  }
  if (pathname.startsWith('/back-office')) return 'catalogue'
  return null
}

export function canAccessStaffPath(user: User | null | undefined, pathname: string): boolean {
  const required = requiredModuleForPath(pathname)
  if (required === null) return true
  if (Array.isArray(required)) return canAccessAnyStaffModule(user, required)
  return canAccessStaffModule(user, required)
}
