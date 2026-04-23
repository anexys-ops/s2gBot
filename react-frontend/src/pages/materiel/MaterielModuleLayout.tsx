import { Outlet } from 'react-router-dom'

/** Point d’entrée du module Matériel (hors back-office) — contenu seul, sans barre d’outils « Configuration ». */
export default function MaterielModuleLayout() {
  return <Outlet />
}
