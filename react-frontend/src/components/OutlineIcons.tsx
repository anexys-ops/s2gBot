/** Icônes contour minimalistes (24×24), couleur via `currentColor`. */

export type HubIconId =
  | 'documents'
  | 'users'
  | 'building'
  | 'quote'
  | 'invoice'
  | 'mail'
  | 'printer'
  | 'orders'
  | 'plus'
  | 'catalog'
  | 'granulo'
  | 'trend'
  | 'map'
  | 'check'
  | 'calculator'
  | 'audit'
  | 'template'
  | 'handshake'
  | 'lab'

type Props = { id: HubIconId; className?: string; title?: string }

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function OutlineIcon({ id, className, title }: Props) {
  const inner = (() => {
    switch (id) {
      case 'documents':
        return (
          <>
            <path d="M8 6h8M8 10h8M8 14h5" {...stroke} />
            <rect x="5" y="3" width="14" height="18" rx="2" {...stroke} />
          </>
        )
      case 'users':
        return (
          <>
            <circle cx="9" cy="8" r="2.5" {...stroke} />
            <path d="M4 19v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1" {...stroke} />
            <circle cx="17" cy="9" r="2" {...stroke} />
            <path d="M20 19v-.5a3 3 0 0 0-3-3h-.5" {...stroke} />
          </>
        )
      case 'building':
        return (
          <>
            <path d="M4 21V5a1 1 0 0 1 1-1h6v17H4z" {...stroke} />
            <path d="M11 4h8a1 1 0 0 1 1 1v16H11V4z" {...stroke} />
            <path d="M7 8h1M7 12h1M7 16h1M14 8h2M14 12h2M14 16h2" {...stroke} />
          </>
        )
      case 'quote':
        return (
          <>
            <path d="M8 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" {...stroke} />
            <path d="M8 9h8M8 13h6" {...stroke} />
          </>
        )
      case 'invoice':
        return (
          <>
            <path d="M7 3h10l1 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" {...stroke} />
            <path d="M7 8h12M9 12h4M9 16h6" {...stroke} />
          </>
        )
      case 'mail':
        return (
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" {...stroke} />
            <path d="m3 7 9 6 9-6" {...stroke} />
          </>
        )
      case 'printer':
        return (
          <>
            <path d="M6 9V3h12v6" {...stroke} />
            <rect x="6" y="13" width="12" height="8" rx="1" {...stroke} />
            <path d="M6 17H4a2 2 0 0 1-2-2v-3h20v3a2 2 0 0 1-2 2h-2" {...stroke} />
          </>
        )
      case 'orders':
        return (
          <>
            <path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" {...stroke} />
            <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v0z" {...stroke} />
            <path d="M9 12h6M9 16h4" {...stroke} />
          </>
        )
      case 'plus':
        return (
          <>
            <circle cx="12" cy="12" r="9" {...stroke} />
            <path d="M12 8v8M8 12h8" {...stroke} />
          </>
        )
      case 'catalog':
        return (
          <>
            <path d="M9 3h6l1 3v15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V6l1-3z" {...stroke} />
            <path d="M9 10h6M9 14h4" {...stroke} />
          </>
        )
      case 'granulo':
        return (
          <>
            <path d="M4 19V5M4 19h16" {...stroke} />
            <path d="M8 15V9M12 15V7M16 15v-5" {...stroke} />
          </>
        )
      case 'trend':
        return (
          <>
            <path d="M4 19V5M4 19h16" {...stroke} />
            <path d="m7 14 4-4 3 3 5-6" {...stroke} />
          </>
        )
      case 'map':
        return (
          <>
            <path d="M9 20l-4-2V4l4 2 6-2 4 2v14l-4-2-6 2z" {...stroke} />
            <circle cx="12" cy="10" r="2.5" {...stroke} />
          </>
        )
      case 'check':
        return (
          <>
            <circle cx="12" cy="12" r="9" {...stroke} />
            <path d="m8 12 2.5 2.5L16 9" {...stroke} />
          </>
        )
      case 'calculator':
        return (
          <>
            <rect x="6" y="3" width="12" height="18" rx="2" {...stroke} />
            <path d="M9 8h6M9 12h6M9 16h4" {...stroke} />
          </>
        )
      case 'audit':
        return (
          <>
            <path d="M8 4h10a2 2 0 0 1 2 2v12H6V6a2 2 0 0 1 2-2z" {...stroke} />
            <path d="M8 9h8M8 13h6M8 17h4" {...stroke} />
          </>
        )
      case 'template':
        return (
          <>
            <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" {...stroke} />
            <path d="M8 8h8M8 12h6" {...stroke} />
          </>
        )
      case 'handshake':
        return (
          <>
            <path d="M11 14h-2a2 2 0 0 1-2-2v-2l3-3 2 2" {...stroke} />
            <path d="m13 9 3 3v2a2 2 0 0 1-2 2h-2" {...stroke} />
            <path d="M8 8 6 6M16 8l2-2M12 12l-1-1" {...stroke} />
          </>
        )
      case 'lab':
        return (
          <>
            <path d="M9 3h6l2 8v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8l2-8z" {...stroke} />
            <path d="M7 15h10" {...stroke} />
          </>
        )
      default: {
        const _exhaustive: never = id
        return _exhaustive
      }
    }
  })()

  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {inner}
    </svg>
  )
}
