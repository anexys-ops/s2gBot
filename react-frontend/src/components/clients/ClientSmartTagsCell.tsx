import StatusBadge from '../ds/StatusBadge'
import { getClientSmartTags, type ClientWithListMeta } from '../../lib/clientSmartTags'

type Props = {
  client: ClientWithListMeta
}

export default function ClientSmartTagsCell({ client }: Props) {
  const tags = getClientSmartTags(client)

  if (!tags.length) {
    return <span className="text-muted">—</span>
  }

  return (
    <div className="client-smart-tags">
      {tags.map((tag) => (
        <StatusBadge key={tag.id} variant={tag.variant} size="sm" title={tag.title}>
          {tag.label}
        </StatusBadge>
      ))}
    </div>
  )
}
