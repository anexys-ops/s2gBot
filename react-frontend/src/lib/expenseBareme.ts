import type { User } from '../api/client'

export const DEFAULT_EXPENSE_TAUX_KM = 0.401

export type UserExpenseBareme = {
  taux_km: number
  plafond_repas: number | null
  forfait_repas: number | null
}

export function userExpenseBareme(user?: Pick<User, 'expense_taux_km' | 'expense_plafond_repas' | 'expense_forfait_repas'> | null): UserExpenseBareme {
  return {
    taux_km: user?.expense_taux_km ?? DEFAULT_EXPENSE_TAUX_KM,
    plafond_repas: user?.expense_plafond_repas ?? null,
    forfait_repas: user?.expense_forfait_repas ?? null,
  }
}

export type FraisType = 'repas' | 'deplacement' | 'autres'

export const FRAIS_TYPE_LABELS: Record<FraisType, string> = {
  repas: 'Repas',
  deplacement: 'Déplacement',
  autres: 'Autres frais',
}

export const FRAIS_TYPE_OPTIONS: { value: FraisType; label: string; icon: string }[] = [
  { value: 'repas', label: 'Repas', icon: '🍽' },
  { value: 'deplacement', label: 'Déplacement', icon: '🚗' },
  { value: 'autres', label: 'Autres', icon: '📋' },
]
