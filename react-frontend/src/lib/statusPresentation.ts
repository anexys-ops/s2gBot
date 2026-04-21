/** Pastilles dashboard : emoji + classe sémantique (couleurs dans index.css). */
import type { InvoiceStatus, OrderStatus, QuoteStatus, SampleStatus } from '../types/enums'

export type StatusPillTone =
  | 'slate'
  | 'amber'
  | 'orange'
  | 'coral'
  | 'teal'
  | 'emerald'
  | 'red'
  | 'violet'

export type StatusPresentation = { emoji: string; tone: StatusPillTone }

const pill = (emoji: string, tone: StatusPillTone): StatusPresentation => ({ emoji, tone })

export function presentationOrderStatus(key: string): StatusPresentation {
  const m: Record<OrderStatus, StatusPresentation> = {
    draft: pill('📋', 'amber'),
    submitted: pill('📤', 'teal'),
    in_progress: pill('⚙️', 'orange'),
    completed: pill('✅', 'emerald'),
  }
  return (m as Record<string, StatusPresentation>)[key] ?? pill('📌', 'slate')
}

export function presentationQuoteStatus(key: string): StatusPresentation {
  const m: Record<QuoteStatus, StatusPresentation> = {
    draft: pill('📋', 'amber'),
    validated: pill('✔️', 'teal'),
    signed: pill('📝', 'teal'),
    sent: pill('📨', 'coral'),
    relanced: pill('🔔', 'orange'),
    lost: pill('📉', 'red'),
    invoiced: pill('💶', 'emerald'),
    accepted: pill('🤝', 'emerald'),
    rejected: pill('🚫', 'red'),
  }
  return (m as Record<string, StatusPresentation>)[key] ?? pill('📄', 'slate')
}

export function presentationInvoiceStatus(key: string): StatusPresentation {
  const m: Record<InvoiceStatus, StatusPresentation> = {
    draft: pill('📋', 'amber'),
    validated: pill('✔️', 'teal'),
    signed: pill('📝', 'teal'),
    sent: pill('📨', 'coral'),
    relanced: pill('🔔', 'orange'),
    paid: pill('💚', 'emerald'),
  }
  return (m as Record<string, StatusPresentation>)[key] ?? pill('🧾', 'slate')
}

export function presentationSampleStatus(key: string): StatusPresentation {
  const m: Record<SampleStatus, StatusPresentation> = {
    pending: pill('⏳', 'amber'),
    received: pill('📥', 'teal'),
    in_progress: pill('🔬', 'orange'),
    tested: pill('🧪', 'violet'),
    validated: pill('✅', 'emerald'),
  }
  return (m as Record<string, StatusPresentation>)[key] ?? pill('🧫', 'slate')
}
