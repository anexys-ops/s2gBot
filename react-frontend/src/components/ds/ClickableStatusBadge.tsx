import { type StatusBadgeProps } from './StatusBadge'

type ClickableStatusBadgeProps = StatusBadgeProps & {
  onClick: () => void
  ariaLabel: string
}

/** Badge de statut cliquable — stoppe la propagation pour ne pas déclencher le clic ligne. */
export default function ClickableStatusBadge({
  onClick,
  ariaLabel,
  variant = 'neutral',
  size = 'md',
  dot = true,
  className = '',
  children,
  ...rest
}: ClickableStatusBadgeProps) {
  const v = `ds-status-badge--${variant}`
  const s = `ds-status-badge--${size}`
  return (
    <button
      type="button"
      className={`ds-status-badge ds-status-badge--clickable ${v} ${s} ${className}`.trim()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={ariaLabel}
      title={ariaLabel}
      {...rest}
    >
      {dot && <span className="ds-status-badge__dot" aria-hidden />}
      {children}
    </button>
  )
}
