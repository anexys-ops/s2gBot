import type { Quote } from '../api/client'

export function quoteEmailRecipient(quote: Quote): { email: string; name: string } | null {
  const contact = quote.client_contact
  if (contact?.email?.trim()) {
    const name = [contact.prenom, contact.nom].filter(Boolean).join(' ').trim()
    return {
      email: contact.email.trim(),
      name: name || quote.client?.name?.trim() || 'Contact',
    }
  }
  if (quote.client?.email?.trim()) {
    return {
      email: quote.client.email.trim(),
      name: quote.client.name?.trim() || 'Client',
    }
  }
  return null
}
