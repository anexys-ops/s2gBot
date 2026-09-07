import type { Client, EntityMetaPayload } from '../api/client'
import type { StatusBadgeVariant } from '../components/ds/StatusBadge'
import { normalizeEntityMeta } from './entityMeta'

export type ClientSmartTag = {
  id: string
  label: string
  variant: StatusBadgeVariant
  title?: string
}

export type ClientListSignals = {
  amount_due_ttc?: number
  overdue_invoices_count?: number
  paid_invoices_count?: number
  invoices_count?: number
  open_quotes_count?: number
}

export type ClientTag = { id: number; name: string; color?: string | null }

export type ClientWithListMeta = Client & {
  list_signals?: ClientListSignals
  tags?: ClientTag[]
}

const META_VARIANTS: Record<string, StatusBadgeVariant> = {
  payeur: 'success',
  'bon payeur': 'success',
  bon: 'success',
  actif: 'success',
  prospect: 'info',
  'mauvais payeur': 'danger',
  mauvais: 'danger',
  litige: 'danger',
  impaye: 'warning',
  impayé: 'warning',
  resilié: 'neutral',
  resilie: 'neutral',
  résilié: 'neutral',
  inactif: 'neutral',
  archive: 'neutral',
  archivé: 'neutral',
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function pushUnique(tags: ClientSmartTag[], tag: ClientSmartTag): void {
  if (tags.some((t) => t.id === tag.id)) return
  tags.push(tag)
}

function variantForLabel(label: string): StatusBadgeVariant {
  const key = normalizeKey(label)
  return META_VARIANTS[key] ?? 'primary'
}

function tagsFromMeta(meta: EntityMetaPayload | null | undefined): ClientSmartTag[] {
  const normalized = normalizeEntityMeta(meta)
  const out: ClientSmartTag[] = []

  const priorityKeys = ['type_client', 'relation', 'statut_commercial', 'segment', 'statut']
  for (const key of priorityKeys) {
    const value = normalized.indicateurs?.[key]?.trim()
    if (!value) continue
    pushUnique(out, {
      id: `meta:${key}:${normalizeKey(value)}`,
      label: value,
      variant: variantForLabel(value),
      title: `Indicateur : ${key}`,
    })
  }

  for (const [key, value] of Object.entries(normalized.indicateurs ?? {})) {
    if (priorityKeys.includes(key)) continue
    const v = value.trim()
    if (!v) continue
    pushUnique(out, {
      id: `meta:${key}:${normalizeKey(v)}`,
      label: v,
      variant: variantForLabel(v),
      title: `Indicateur : ${key}`,
    })
  }

  return out
}

function tagsFromManual(clientTags: ClientTag[] | undefined): ClientSmartTag[] {
  return (clientTags ?? []).map((t) => ({
    id: `tag:${t.id}`,
    label: t.name,
    variant: variantForLabel(t.name),
    title: 'Tag manuel',
  }))
}

function tagsFromSignals(signals: ClientListSignals | undefined): ClientSmartTag[] {
  if (!signals) return []
  const out: ClientSmartTag[] = []
  const due = signals.amount_due_ttc ?? 0
  const overdue = signals.overdue_invoices_count ?? 0
  const paid = signals.paid_invoices_count ?? 0
  const invoices = signals.invoices_count ?? 0
  const openQuotes = signals.open_quotes_count ?? 0

  if (overdue > 0) {
    pushUnique(out, {
      id: 'signal:overdue',
      label: overdue === 1 ? 'Retard' : `Retard (${overdue})`,
      variant: 'danger',
      title: 'Facture(s) échue(s) non réglée(s)',
    })
  }

  if (due > 0) {
    pushUnique(out, {
      id: 'signal:due',
      label: 'Impayé',
      variant: 'warning',
      title: `Encours TTC : ${due.toLocaleString('fr-FR')} DH`,
    })
  }

  if (paid > 0 && overdue === 0 && due === 0) {
    pushUnique(out, {
      id: 'signal:good-payer',
      label: paid >= 3 ? 'Bon payeur' : 'Payeur',
      variant: 'success',
      title: `${paid} facture(s) réglée(s)`,
    })
  }

  if (invoices === 0) {
    pushUnique(out, {
      id: 'signal:prospect',
      label: 'Prospect',
      variant: 'info',
      title: 'Aucune facture émise',
    })
  }

  if (openQuotes > 0) {
    pushUnique(out, {
      id: 'signal:open-quotes',
      label: openQuotes === 1 ? 'Devis en cours' : `Devis (${openQuotes})`,
      variant: 'info',
      title: 'Devis ouvert(s)',
    })
  }

  return out
}

function tagsFromProfile(client: Client): ClientSmartTag[] {
  const out: ClientSmartTag[] = []

  if (client.prolab_code?.trim()) {
    pushUnique(out, {
      id: 'profile:prolab',
      label: 'PROLAB',
      variant: 'primary',
      title: `Code tiers ${client.prolab_code}`,
    })
  }

  if (!client.ice?.trim()) {
    pushUnique(out, {
      id: 'profile:missing-ice',
      label: 'Sans ICE',
      variant: 'warning',
      title: 'ICE non renseigné',
    })
  }

  return out
}

/** Tags calculés + meta + tags manuels, ordonnés par priorité visuelle. */
export function getClientSmartTags(client: ClientWithListMeta): ClientSmartTag[] {
  const manual = tagsFromManual(client.tags)
  const meta = tagsFromMeta(client.meta)
  const signals = tagsFromSignals(client.list_signals)
  const profile = tagsFromProfile(client)

  const priority = new Map<string, number>([
    ['signal:overdue', 0],
    ['signal:due', 1],
  ])

  const merged = [...manual, ...meta, ...signals, ...profile]
  const seen = new Set<string>()
  const unique: ClientSmartTag[] = []

  for (const tag of merged) {
    if (seen.has(tag.id)) continue
    seen.add(tag.id)
    unique.push(tag)
  }

  unique.sort((a, b) => {
    const pa = priority.get(a.id) ?? 50
    const pb = priority.get(b.id) ?? 50
    if (pa !== pb) return pa - pb
    return a.label.localeCompare(b.label, 'fr')
  })

  return unique.slice(0, 6)
}

export function clientNameSubtitle(client: Client): string | null {
  const parts: string[] = []
  if (client.legal_form?.trim()) parts.push(client.legal_form.trim())
  if (client.city?.trim()) parts.push(client.city.trim())
  if (client.ice?.trim()) parts.push(`ICE ${client.ice.trim()}`)
  return parts.length ? parts.join(' · ') : null
}
