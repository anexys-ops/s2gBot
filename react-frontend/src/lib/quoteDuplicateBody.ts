import type { Quote, QuoteCreateBody } from '../api/client'
import { todayLocalDateInput } from './appLocale'

/** Corps API pour dupliquer un devis en nouveau brouillon (sans id / numéro). */
export function buildQuoteDuplicateBody(quote: Quote): QuoteCreateBody {
  const lines = (quote.quote_lines ?? []).map((l) => ({
    commercial_offering_id: l.commercial_offering_id ?? undefined,
    ref_article_id: l.ref_article_id ?? undefined,
    ref_package_id: l.ref_package_id ?? undefined,
    type_ligne: l.type_ligne ?? undefined,
    line_code: l.line_code ?? undefined,
    description: l.description,
    unite: (l.unite ?? '').trim() || 'U',
    quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
    unit_price: Math.max(0, Number(l.unit_price) || 0),
    tva_rate: Number(l.tva_rate ?? quote.tva_rate ?? 20),
    discount_percent: Math.min(100, Math.max(0, Number(l.discount_percent ?? 0))),
  }))

  const meta = quote.meta ? { ...quote.meta } : undefined

  return {
    client_id: quote.client_id,
    contact_id: quote.contact_id ?? undefined,
    site_id: quote.site_id,
    dossier_id: quote.dossier_id ?? undefined,
    quote_date: todayLocalDateInput(),
    order_date: quote.order_date?.slice(0, 10),
    site_delivery_date: quote.site_delivery_date?.slice(0, 10),
    valid_until: quote.valid_until?.slice(0, 10),
    tva_rate: Number(quote.tva_rate ?? 20),
    discount_percent: Number(quote.discount_percent ?? 0),
    discount_amount: Number(quote.discount_amount ?? 0),
    shipping_amount_ht: Number(quote.shipping_amount_ht ?? 0),
    shipping_tva_rate: Number(quote.shipping_tva_rate ?? 20),
    travel_fee_ht: Number(quote.travel_fee_ht ?? 0),
    travel_fee_tva_rate: Number(quote.travel_fee_tva_rate ?? 20),
    billing_address_id: quote.billing_address_id,
    delivery_address_id: quote.delivery_address_id,
    pdf_template_id: quote.pdf_template_id,
    notes: quote.notes ?? '',
    meta,
    lines,
  }
}
