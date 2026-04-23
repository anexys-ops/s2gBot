import type { HTMLAttributes } from 'react'

export type StatusBadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

export type StatusBadgeSize = 'sm' | 'md' | 'lg'

export type StatusBadgeProps = {
  children: React.ReactNode
  variant?: StatusBadgeVariant
  size?: StatusBadgeSize
  /** Si false, masque le point de couleur (rare). */
  dot?: boolean
} & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>

/**
 * Badge de statut (BDC-156) — point + libellé, tailles sm | md | lg.
 */
export default function StatusBadge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = true,
  className = '',
  ...rest
}: StatusBadgeProps) {
  const v = `ds-status-badge--${variant}`
  const s = `ds-status-badge--${size}`
  return (
    <span className={`ds-status-badge ${v} ${s} ${className}`.trim()} {...rest}>
      {dot && <span className="ds-status-badge__dot" aria-hidden />}
      {children}
    </span>
  )
}

/** Dossier chantier PROLAB : brouillon | en_cours | cloture | archive */
export function dossierStatutBadgeProps(
  statut: string
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    brouillon: { label: 'Brouillon', variant: 'neutral' },
    en_cours: { label: 'En cours', variant: 'info' },
    cloture: { label: 'Clôturé', variant: 'success' },
    archive: { label: 'Archivé', variant: 'neutral' },
  }
  const m = map[statut] ?? { label: statut, variant: 'neutral' as const }
  return { variant: m.variant, children: m.label, label: m.label }
}

export function equipementStatutBadgeProps(status: string): { label: string; variant: StatusBadgeVariant } {
  const k = status.toLowerCase()
  if (k === 'active' || k === 'ok' || k === 'in_service' || k.includes('actif')) {
    return { label: status, variant: 'success' }
  }
  if (k.includes('maintenance') || k.includes('calibrat') || k === 'ok_with_reserve') {
    return { label: status, variant: 'warning' }
  }
  if (k === 'retired' || k === 'failed' || k.includes('hors')) {
    return { label: status, variant: 'danger' }
  }
  return { label: status, variant: 'neutral' }
}
