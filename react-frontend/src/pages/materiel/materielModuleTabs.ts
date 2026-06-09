import type { ModuleTab } from '../../components/module/ModuleEntityShell'

export const MATERIEL_MODULE_TABS: ModuleTab[] = [
  { to: '/materiel', label: 'Vue d’ensemble', end: true },
  { to: '/materiel/equipements', label: 'Parc équipements' },
  { to: '/materiel/planning', label: 'Planning' },
  { to: '/materiel/stocks', label: 'Stocks' },
]
