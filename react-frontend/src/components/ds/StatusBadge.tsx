import type { HTMLAttributes } from 'react'
import type { SiteStatusKey } from '../../lib/siteStatusPresentation'
import { SITE_STATUS_LABELS, presentationSiteStatus } from '../../lib/siteStatusPresentation'
import { getTaskStatutLabel } from '../../lib/missionTaskStatuts'

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

/** Dossier chantier PROLAB : brouillon | en_cours | planifie | terrain | expertise | cloture | archive */
export function dossierStatutBadgeProps(
  statut: string
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    brouillon:  { label: 'Brouillon',  variant: 'neutral' },
    en_cours:   { label: 'En cours',   variant: 'warning' },
    planifie:   { label: 'Planifié',   variant: 'info' },
    terrain:    { label: 'Terrain',    variant: 'primary' },
    expertise:  { label: 'Expertise',  variant: 'warning' },
    cloture:    { label: 'Clôturé',   variant: 'success' },
    archive:    { label: 'Archivé',   variant: 'neutral' },
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

export function invoiceStatutBadgeProps(
  status: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    draft: { label: 'Brouillon', variant: 'neutral' },
    validated: { label: 'Validée', variant: 'info' },
    signed: { label: 'Signée', variant: 'info' },
    sent: { label: 'Envoyée', variant: 'warning' },
    relanced: { label: 'Relancée', variant: 'warning' },
    paid: { label: 'Encaissée', variant: 'success' },
  }
  const m = map[status] ?? { label: status, variant: 'neutral' as const }
  return { variant: m.variant, children: m.label, label: m.label }
}

export function bonLivraisonStatutBadgeProps(
  statut: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    brouillon: { label: 'Brouillon', variant: 'neutral' },
    livre: { label: 'Livré', variant: 'success' },
    signe: { label: 'Signé', variant: 'info' },
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

/** Statut de ligne d'OM : planifie | replanifie | en_cours | freeze | annule | attente_validation | cloture | a_faire | realise */
export function ligneStatutBadgeProps(
  statut: string
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    a_faire: { label: 'À faire', variant: 'neutral' },
    planifie: { label: 'Planifié', variant: 'info' },
    replanifie: { label: 'Replanifié', variant: 'info' },
    en_cours: { label: 'En cours', variant: 'warning' },
    attente_validation: { label: 'Attente validation', variant: 'warning' },
    freeze: { label: 'Freeze', variant: 'neutral' },
    annule: { label: 'Annulé', variant: 'danger' },
    cloture: { label: 'Clôturé', variant: 'success' },
    realise: { label: 'Réalisé', variant: 'success' },
  }
  const m = map[statut] ?? { label: statut, variant: 'neutral' as const }
  return { variant: m.variant, children: m.label, label: m.label }
}

/** Statut de formulaire d'essai (task_test_forms) : not_started | draft | submitted | correction_requested | validated */
export function essayFormStatutBadgeProps(
  statut: string
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    not_started: { label: 'Non commencé', variant: 'neutral' },
    draft: { label: 'Brouillon', variant: 'info' },
    submitted: { label: 'Soumis', variant: 'warning' },
    correction_requested: { label: 'Correction demandée', variant: 'danger' },
    validated: { label: 'Validé', variant: 'success' },
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

/** Statut de tâche (MissionTask) : todo | in_progress | paused | frozen | rescheduled | done | validated | rejected */
export function taskStatutBadgeProps(
  statut: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const variants: Record<string, StatusBadgeVariant> = {
    todo: 'info',
    in_progress: 'warning',
    paused: 'warning',
    frozen: 'neutral',
    rescheduled: 'info',
    done: 'warning',
    validated: 'success',
    rejected: 'danger',
  }
  const label = getTaskStatutLabel(statut)
  return { variant: variants[statut] ?? 'neutral', children: label, label }
}

/** Rapport de mission (rapport_bc) : brouillon | preliminaire | valide | archive */
export function rapportBcStatutBadgeProps(
  statut: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    brouillon: { label: 'Brouillon', variant: 'neutral' },
    preliminaire: { label: 'Préliminaire', variant: 'warning' },
    valide: { label: 'Validé', variant: 'success' },
    archive: { label: 'Archivé', variant: 'neutral' },
  }
  const m = map[statut] ?? { label: statut, variant: 'neutral' as const }
  return { variant: m.variant, children: m.label, label: m.label }
}

/** Rapport d'essais (lab_report) : brouillon | en_validation | valide | signe | emis */
export function labReportStatutBadgeProps(
  statut: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    brouillon: { label: 'Brouillon', variant: 'neutral' },
    en_validation: { label: 'En validation', variant: 'warning' },
    valide: { label: 'Validé', variant: 'info' },
    signe: { label: 'Signé', variant: 'info' },
    emis: { label: 'Émis', variant: 'success' },
  }
  const m = map[statut] ?? { label: statut, variant: 'neutral' as const }
  return { variant: m.variant, children: m.label, label: m.label }
}

/** Note de frais : brouillon | soumis | valide | rembourse | rejete */
export function expenseReportStatutBadgeProps(
  statut: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    brouillon: { label: 'Brouillon', variant: 'neutral' },
    soumis: { label: 'Soumis', variant: 'warning' },
    valide: { label: 'Validé', variant: 'info' },
    rembourse: { label: 'Remboursé', variant: 'success' },
    rejete: { label: 'Rejeté', variant: 'danger' },
  }
  const m = map[statut] ?? { label: statut, variant: 'neutral' as const }
  return { variant: m.variant, children: m.label, label: m.label }
}

/** Échantillon labo : en_transit | receptionne | imprime | stocke | en_essai | termine | rejete | perdu | archive | annule */
export function sampleStatutBadgeProps(
  statut: string,
  labelOverride?: string,
): Pick<StatusBadgeProps, 'variant' | 'children'> & { label: string } {
  const map: Record<string, StatusBadgeVariant> = {
    en_transit: 'warning',
    receptionne: 'info',
    imprime: 'info',
    stocke: 'success',
    en_essai: 'primary',
    termine: 'success',
    rejete: 'danger',
    perdu: 'danger',
    archive: 'neutral',
    annule: 'danger',
  }
  const label = labelOverride ?? statut
  return { variant: map[statut] ?? 'neutral', children: label, label }
}

/** Libellés dérivés des fonctions ci-dessus : source unique pour filtres, listes déroulantes et modales. */
const labelsOf = (
  fn: (k: string) => { label: string },
  keys: readonly string[],
): Record<string, string> => Object.fromEntries(keys.map((k) => [k, fn(k).label]))

export const BON_COMMANDE_STATUT_LABELS = labelsOf(bonCommandeStatutBadgeProps, ['brouillon', 'confirme', 'en_cours', 'livre', 'annule'])
export const BON_LIVRAISON_STATUT_LABELS = labelsOf(bonLivraisonStatutBadgeProps, ['brouillon', 'livre', 'signe'])
export const ORDRE_MISSION_STATUT_LABELS = labelsOf(ordreMissionStatutBadgeProps, ['brouillon', 'planifie', 'en_cours', 'termine', 'annule'])
export const QUOTE_STATUT_LABELS = labelsOf(quoteStatutBadgeProps, ['draft', 'validated', 'signed', 'sent', 'relanced', 'lost', 'invoiced', 'accepted', 'rejected'])
export const INVOICE_STATUT_LABELS = labelsOf(invoiceStatutBadgeProps, ['draft', 'validated', 'signed', 'sent', 'relanced', 'paid'])
export const DOSSIER_STATUT_LABELS = labelsOf(dossierStatutBadgeProps, ['brouillon', 'en_cours', 'planifie', 'terrain', 'expertise', 'cloture', 'archive'])
export const ESSAY_FORM_STATUT_LABELS = labelsOf(essayFormStatutBadgeProps, ['not_started', 'draft', 'submitted', 'correction_requested', 'validated'])
