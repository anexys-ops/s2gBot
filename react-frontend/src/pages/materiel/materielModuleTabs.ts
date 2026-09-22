import type { ModuleTab } from '../../components/module/ModuleEntityShell'

export const MATERIEL_MODULE_TABS: ModuleTab[] = [
  { to: '/materiel/equipements', label: 'Équipements' },
  { to: '/materiel/planning', label: 'Planning matériel' },
  { to: '/materiel/stocks', label: 'Stocks' },
]

/** Page d’accueil du module Matériel (navbar, fil d’Ariane). */
export const MATERIEL_HOME = '/materiel/equipements'
