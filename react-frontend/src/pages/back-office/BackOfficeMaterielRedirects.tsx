import { Navigate, useParams } from 'react-router-dom'

export function BackOfficeEquipementsListRedirect() {
  return <Navigate to="/materiel/equipements" replace />
}

export function BackOfficeEquipementDetailRedirect() {
  const { id } = useParams()
  if (!id) return <Navigate to="/materiel/equipements" replace />
  return <Navigate to={`/materiel/equipements/${id}`} replace />
}
