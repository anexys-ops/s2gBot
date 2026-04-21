import { presentationSiteStatus } from '../lib/siteStatusPresentation'

export default function SiteStatusPill({ status }: { status?: string | null }) {
  const p = presentationSiteStatus(status)
  return (
    <span className={`status-pill status-pill--${p.tone}`}>
      <span className="status-pill__emoji" aria-hidden>
        {p.emoji}
      </span>
      {p.label}
    </span>
  )
}
