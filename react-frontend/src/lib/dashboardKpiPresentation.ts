export type KpiId =
  | 'clients'
  | 'sites'
  | 'orders'
  | 'quotes'
  | 'invoices_count'
  | 'pipeline_quotes_ttc'
  | 'ca_ttc'
  | 'encaisse'
  | 'impayes'
  | 'reports_total'
  | 'reports_pending'
  | 'samples'
  | 'delay_first_report'
  | 'delay_cycle'

export type KpiTone = 'orange' | 'emerald' | 'teal' | 'amber' | 'coral' | 'violet' | 'slate' | 'rose'

export type KpiPresentation = { emoji: string; tone: KpiTone }

export const KPI_PRESENTATION: Record<KpiId, KpiPresentation> = {
  clients: { emoji: '👥', tone: 'teal' },
  sites: { emoji: '🏗️', tone: 'amber' },
  orders: { emoji: '📦', tone: 'orange' },
  quotes: { emoji: '📑', tone: 'coral' },
  invoices_count: { emoji: '🧾', tone: 'emerald' },
  pipeline_quotes_ttc: { emoji: '💰', tone: 'orange' },
  ca_ttc: { emoji: '📈', tone: 'emerald' },
  encaisse: { emoji: '✅', tone: 'emerald' },
  impayes: { emoji: '⏱️', tone: 'rose' },
  reports_total: { emoji: '📄', tone: 'teal' },
  reports_pending: { emoji: '👀', tone: 'amber' },
  samples: { emoji: '🧪', tone: 'violet' },
  delay_first_report: { emoji: '⏱️', tone: 'orange' },
  delay_cycle: { emoji: '🚚', tone: 'teal' },
}
