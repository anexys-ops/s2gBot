import type { Invoice } from '../api/client'

const UNPAID = ['validated', 'signed', 'sent', 'relanced']

export type InvoiceReminderTone = 'neutral' | 'warning' | 'danger' | null

export function isInvoiceUnpaid(status: string): boolean {
  return UNPAID.includes(status)
}

export function isInvoiceOverdue(inv: Invoice): boolean {
  if (!isInvoiceUnpaid(inv.status) || !inv.due_date) return false
  const due = inv.due_date.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return due < today
}

export function invoiceReminderTone(inv: Invoice): InvoiceReminderTone {
  if (!isInvoiceUnpaid(inv.status)) return null
  const today = new Date().toISOString().slice(0, 10)
  if (inv.due_date && inv.due_date.slice(0, 10) < today) return 'danger'
  if (inv.next_reminder_date && inv.next_reminder_date.slice(0, 10) <= today) return 'warning'
  if (inv.next_reminder_date) {
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    if (inv.next_reminder_date.slice(0, 10) <= in7.toISOString().slice(0, 10)) return 'warning'
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
