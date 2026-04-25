import { useOutletContext } from 'react-router-dom'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'
import type { ClientOutletContext } from './ClientLayout'

export default function ClientExtrafieldsTab() {
  const { clientId, isAdmin } = useOutletContext<ClientOutletContext>()

  return <ExtrafieldsForm entityType="client" entityId={clientId} canEdit={isAdmin} title="Champs personnalisés client" />
}
