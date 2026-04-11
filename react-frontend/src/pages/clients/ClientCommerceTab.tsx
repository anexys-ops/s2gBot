import { Navigate, useOutletContext } from 'react-router-dom'
import ClientCommercialContent from './ClientCommercialContent'
import type { ClientOutletContext } from './ClientLayout'

export default function ClientCommerceTab() {
  const { clientId, isLab } = useOutletContext<ClientOutletContext>()
  if (!isLab) {
    return <Navigate to={`/clients/${clientId}/fiche`} replace />
  }
  return <ClientCommercialContent clientId={clientId} />
}
