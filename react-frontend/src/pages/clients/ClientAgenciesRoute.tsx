import { useOutletContext } from 'react-router-dom'
import ClientAgenciesTab from './ClientAgenciesTab'
import type { ClientOutletContext } from './ClientLayout'

export default function ClientAgenciesRoute() {
  const { clientId, isAdmin } = useOutletContext<ClientOutletContext>()

  return <ClientAgenciesTab clientId={clientId} canEdit={isAdmin} />
}
