import type { HubIconId } from '../components/OutlineIcons'

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

export type KpiPresentation = { icon: HubIconId; tone: KpiTone }

export const KPI_PRESENTATION: Record<KpiId, KpiPresentation> = {
  clients: { icon: 'users', tone: 'teal' },
  sites: { icon: 'building', tone: 'amber' },
  orders: { icon: 'orders', tone: 'orange' },
  quotes: { icon: 'quote', tone: 'coral' },
  invoices_count: { icon: 'invoice', tone: 'emerald' },
  pipeline_quotes_ttc: { icon: 'wallet', tone: 'orange' },
  ca_ttc: { icon: 'trend', tone: 'emerald' },
  encaisse: { icon: 'check', tone: 'emerald' },
  impayes: { icon: 'clock', tone: 'rose' },
  reports_total: { icon: 'documents', tone: 'teal' },
  reports_pending: { icon: 'audit', tone: 'amber' },
  samples: { icon: 'lab', tone: 'violet' },
  delay_first_report: { icon: 'clock', tone: 'orange' },
  delay_cycle: { icon: 'truck', tone: 'teal' },
}
