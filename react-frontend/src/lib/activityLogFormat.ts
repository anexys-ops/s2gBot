import type { MonitoringActivityRow } from '../api/client'

const FIELD_LABELS: Record<string, string> = {
  status: 'Statut',
  notes: 'Notes',
  number: 'Numéro',
  name: 'Nom',
  email: 'E-mail',
  phone: 'Téléphone',
  amount_ht: 'Montant HT',
  amount_ttc: 'Montant TTC',
  client_id: 'Client',
  contact_id: 'Contact',
  site_id: 'Chantier',
  dossier_id: 'Dossier',
  quote_date: 'Date devis',
  invoice_date: 'Date facture',
  valid_until: 'Validité',
  discount_percent: 'Remise %',
  discount_amount: 'Remise €',
  description: 'Description',
  quantity: 'Quantité',
  unit_price: 'Prix unitaire',
  unite: 'Unité',
  total: 'Total ligne',
  tva_rate: 'TVA',
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

function formatLineChange(row: Record<string, unknown>): string | null {
  const line = row.line
  const action = row.action
  const desc = typeof row.description === 'string' ? row.description.slice(0, 55) : ''

  if (action === 'added') {
    return `Ligne ${line} ajoutée : ${desc}`
  }
  if (action === 'removed') {
    return `Ligne ${line} supprimée : ${desc}`
  }

  const field = typeof row.field === 'string' ? fieldLabel(row.field) : 'Champ'
  return `Ligne ${line} (${desc}) — ${field} : ${String(row.from ?? '—')} → ${String(row.to ?? '—')}`
}

export function formatActivityDetail(log: MonitoringActivityRow): string {
  const props = log.properties
  if (!props) return '—'

  if (typeof props.detail_summary === 'string' && props.detail_summary.trim() !== '') {
    return props.detail_summary
  }

  const parts: string[] = []

  const lineChanges = props.line_changes
  if (Array.isArray(lineChanges)) {
    for (const row of lineChanges.slice(0, 6)) {
      if (row && typeof row === 'object') {
        const formatted = formatLineChange(row as Record<string, unknown>)
        if (formatted) parts.push(formatted)
      }
    }
  }

  const changes = props.changes as Record<string, { from?: unknown; to?: unknown }> | undefined
  if (changes && typeof changes === 'object') {
    const skipAmounts = parts.length > 0
    for (const [field, diff] of Object.entries(changes)) {
      if (skipAmounts && (field === 'amount_ht' || field === 'amount_ttc')) continue
      parts.push(`${fieldLabel(field)} : ${String(diff.from ?? '—')} → ${String(diff.to ?? '—')}`)
      if (parts.length >= 8) break
    }
  }

  return parts.length > 0 ? parts.join(' · ') : '—'
}
