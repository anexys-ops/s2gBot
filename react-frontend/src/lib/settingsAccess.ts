import type { User } from '../api/client'

export function canManageUsers(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'lab_admin') return true
  return (user.effective_permissions ?? []).includes('users.manage')
}

export function canManageGroups(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'lab_admin') return true
  return (user.effective_permissions ?? []).includes('groups.manage')
}

export function canManageAppConfig(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'lab_admin') return true
  return (user.effective_permissions ?? []).includes('config.manage')
}
