import type { Invoice } from '../api/client'
import { addLocalDays, dateInputFromApi, todayLocalDateInput } from './appLocale'

const UNPAID = ['validated', 'signed', 'sent', 'relanced']

export type InvoiceReminderTone = 'neutral' | 'warning' | 'danger' | null

export function isInvoiceUnpaid(status: string): boolean {
  return UNPAID.includes(status)
}

export function isInvoiceOverdue(inv: Invoice): boolean {
  if (!isInvoiceUnpaid(inv.status) || !inv.due_date) return false
  const due = dateInputFromApi(inv.due_date)
  const today = todayLocalDateInput()
  return due < today
}

export function invoiceReminderTone(inv: Invoice): InvoiceReminderTone {
  if (!isInvoiceUnpaid(inv.status)) return null
  const today = todayLocalDateInput()
  if (inv.due_date && dateInputFromApi(inv.due_date) < today) return 'danger'
  if (inv.next_reminder_date && dateInputFromApi(inv.next_reminder_date) <= today) return 'warning'
  if (inv.next_reminder_date) {
    const in7 = addLocalDays(today, 7)
    if (dateInputFromApi(inv.next_reminder_date) <= in7) return 'warning'
  }
  return 'neutral'
}

export function invoiceReminderLabel(inv: Invoice): string | null {
  const tone = invoiceReminderTone(inv)
  if (tone === 'danger') return 'En retard'
  if (tone === 'warning' && inv.next_reminder_date) return 'Relance prévue'
  if (isInvoiceOverdue(inv)) return 'Échue'
  return null
}

export type InvoiceQuickFilter = '' | 'unpaid' | 'overdue' | 'relance'

export const INVOICE_QUICK_FILTERS: Array<{ id: InvoiceQuickFilter; label: string }> = [
  { id: '', label: 'Toutes' },
  { id: 'unpaid', label: 'Impayées' },
  { id: 'overdue', label: 'En retard' },
  { id: 'relance', label: 'À relancer' },
]
