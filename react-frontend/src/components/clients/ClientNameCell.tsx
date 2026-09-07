import { Link } from 'react-router-dom'
import type { Client } from '../../api/client'
import { clientNameSubtitle } from '../../lib/clientSmartTags'

type Props = {
  client: Client
}

export default function ClientNameCell({ client }: Props) {
  const subtitle = clientNameSubtitle(client)

  return (
    <div className="client-name-cell">
      <Link to={`/clients/${client.id}/fiche`} className="client-name-cell__link" onClick={(e) => e.stopPropagation()}>
        {client.name}
      </Link>
      {subtitle && <div className="client-name-cell__subtitle text-muted">{subtitle}</div>}
      {client.commercial?.name && (
        <div className="client-name-cell__referent text-muted" title="Commercial référent">
          {client.commercial.name}
        </div>
      )}
    </div>
  )
}
