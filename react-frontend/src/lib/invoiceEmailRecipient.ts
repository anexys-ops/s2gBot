import type { Invoice } from '../api/client'

export function invoiceEmailRecipient(invoice: Invoice): { email: string; name: string } | null {
  const contact = invoice.client_contact
  if (contact?.email?.trim()) {
    const name = [contact.prenom, contact.nom].filter(Boolean).join(' ').trim()
    return {
      email: contact.email.trim(),
      name: name || invoice.client?.name?.trim() || 'Contact',
    }
  }
  if (invoice.client?.email?.trim()) {
    return {
      email: invoice.client.email.trim(),
      name: invoice.client.name?.trim() || 'Client',
    }
  }
  return null
}

export function invoiceWhatsAppPhone(invoice: Invoice): string | null {
  const raw = invoice.client?.whatsapp?.trim() || invoice.client?.phone?.trim()
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 9 ? digits : null
}
