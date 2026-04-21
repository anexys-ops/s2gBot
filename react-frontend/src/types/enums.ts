/**
 * Généré par `php artisan generate:ts-enums`.
 * Source de vérité : constantes des modèles Laravel.
 */

export const ORDER_STATUSES = ['draft', 'submitted', 'in_progress', 'completed'] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const INVOICE_STATUSES = ['draft', 'validated', 'signed', 'sent', 'relanced', 'paid'] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const QUOTE_STATUSES = [
  'draft',
  'validated',
  'signed',
  'sent',
  'relanced',
  'lost',
  'invoiced',
  'accepted',
  'rejected',
] as const

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const SAMPLE_STATUSES = ['pending', 'received', 'in_progress', 'tested', 'validated'] as const

export type SampleStatus = (typeof SAMPLE_STATUSES)[number]

export const SITE_STATUSES = ['not_started', 'in_progress', 'blocked', 'delivered', 'archived'] as const

export type SiteStatus = (typeof SITE_STATUSES)[number]

export const EQUIPMENT_STATUSES = ['active', 'maintenance', 'retired'] as const

export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]

export const REPORT_REVIEW_STATUSES = ['draft', 'pending_review', 'approved'] as const

export type ReportReviewStatus = (typeof REPORT_REVIEW_STATUSES)[number]

export const CALIBRATION_RESULTS = ['ok', 'ok_with_reserve', 'failed'] as const

export type CalibrationResult = (typeof CALIBRATION_RESULTS)[number]
