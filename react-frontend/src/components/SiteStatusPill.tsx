import StatusBadge, { siteStatutBadgeProps, type StatusBadgeSize } from './ds/StatusBadge'

type Props = {
  status?: string | null
  size?: StatusBadgeSize
}

export default function SiteStatusPill({ status, size = 'sm' }: Props) {
  const props = siteStatutBadgeProps(status)
  return (
    <StatusBadge variant={props.variant} size={size} title={props.label}>
      {props.label}
    </StatusBadge>
  )
}
