import type { HTMLAttributes } from 'react'
import type { SiteStatusKey } from '../../lib/siteStatusPresentation'
import { SITE_STATUS_LABELS, presentationSiteStatus } from '../../lib/siteStatusPresentation'

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

export function siteStatutBadgeProps(
  status: string | null | undefined,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const { key } = presentationSiteStatus(status)
  const variantMap: Record<SiteStatusKey, StatusBadgeVariant> = {
    not_started: 'neutral',
    in_progress: 'info',
    blocked: 'danger',
    delivered: 'success',
    archived: 'neutral',
  }
  const label = SITE_STATUS_LABELS[key]
  return { variant: variantMap[key], children: label, label }
}

export function quoteStatutBadgeProps(
  status: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    draft: { label: 'Brouillon', variant: 'neutral' },
    validated: { label: 'Validé', variant: 'info' },
    signed: { label: 'Signé', variant: 'info' },
    sent: { label: 'Envoyé', variant: 'warning' },
    relanced: { label: 'Relancé', variant: 'warning' },
    lost: { label: 'Perdu', variant: 'danger' },
    invoiced: { label: 'Facturé', variant: 'success' },
    accepted: { label: 'Accepté', variant: 'success' },
    rejected: { label: 'Refusé', variant: 'danger' },
  }
  const m = map[status] ?? { label: status, variant: 'neutral' as const }
  return { variant: m.variant, children: m.label, label: m.label }
}

export function bonCommandeStatutBadgeProps(
  statut: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    brouillon: { label: 'Brouillon', variant: 'neutral' },
    confirme: { label: 'Confirmé', variant: 'info' },
    en_cours: { label: 'En cours', variant: 'warning' },
    livre: { label: 'Livré', variant: 'success' },
    annule: { label: 'Annulé', variant: 'danger' },
  }
  const m = map[statut] ?? { label: statut, variant: 'neutral' as const }
  return { variant: m.variant, children: m.label, label: m.label }
}

export function bonLivraisonStatutBadgeProps(
  statut: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    brouillon: { label: 'Brouillon', variant: 'neutral' },
    livre: { label: 'Livré', variant: 'success' },
    signe: { label: 'Signé', variant: 'success' },
  }
  const m = map[statut] ?? { label: statut, variant: 'neutral' as const }
  return { variant: m.variant, children: m.label, label: m.label }
}

export function ordreMissionStatutBadgeProps(
  statut: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    brouillon: { label: 'Brouillon', variant: 'neutral' },
    planifie: { label: 'Planifié', variant: 'info' },
    en_cours: { label: 'En cours', variant: 'warning' },
    termine: { label: 'Terminé', variant: 'success' },
    annule: { label: 'Annulé', variant: 'danger' },
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
