import type { QuoteCreateBody } from '../api/client'
import type { QuoteFormState } from '../components/quotes/QuoteFormFields'
import { normalizeDevisParcoursInMeta } from './devisParcours'
import { syncJalonProductKeysBeforeSave } from './s2gDevisCatalogue'

const MAX_LINE_DESCRIPTION = 500

function finiteNum(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function optionalPositiveId(value: number | undefined | null): number | undefined {
  if (value == null) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function trimLineDescription(value: string | undefined | null): string {
  return (value ?? '').trim().slice(0, MAX_LINE_DESCRIPTION)
}

/** Payload API prêt pour POST/PUT /quotes (valeurs numériques et IDs nettoyés). */
export function buildQuoteApiBody(form: QuoteFormState): QuoteCreateBody {
  const defaultTva = finiteNum(form.tva_rate, 20)
  const lines = form.lines
    .filter((l) => trimLineDescription(l.description).length > 0 && l.quantity > 0)
    .map((l) => {
      const row: QuoteCreateBody['lines'][number] = {
        description: trimLineDescription(l.description),
        quantity: Math.max(1, Math.round(finiteNum(l.quantity, 1))),
        unit_price: Math.max(0, finiteNum(l.unit_price, 0)),
        tva_rate: finiteNum(l.tva_rate, defaultTva),
        discount_percent: Math.min(100, Math.max(0, finiteNum(l.discount_percent, 0))),
      }
      const offeringId = optionalPositiveId(l.commercial_offering_id ?? undefined)
      const articleId = optionalPositiveId(l.ref_article_id ?? undefined)
      const packageId = optionalPositiveId(l.ref_package_id ?? undefined)
      if (offeringId) row.commercial_offering_id = offeringId
      if (articleId) row.ref_article_id = articleId
      if (packageId) row.ref_package_id = packageId
      if (offeringId || articleId || packageId) row.type_ligne = 'catalogue'
      return row
    })

  const meta = { ...form.meta }
  syncJalonProductKeysBeforeSave(form.lines, meta)
  if (meta.devis_jalons && meta.devis_jalons.length === 0) delete meta.devis_jalons
  if (meta.tarif_global_hors_lignes_ht == null) delete meta.tarif_global_hors_lignes_ht
  if (meta.frais_supplementaires && meta.frais_supplementaires.length === 0) delete meta.frais_supplementaires
  if (meta.ligne_masque_prix_pdf && !meta.ligne_masque_prix_pdf.some(Boolean)) delete meta.ligne_masque_prix_pdf
  normalizeDevisParcoursInMeta(form.lines, meta.devis_jalons, meta)
  if (meta.devis_parcours && meta.devis_parcours.length === 0) delete meta.devis_parcours
  const hasMeta = Object.keys(meta).length > 0

  const dossierId = optionalPositiveId(form.dossier_id ?? undefined)

  return {
    client_id: form.client_id,
    contact_id: optionalPositiveId(form.contact_id ?? undefined) ?? null,
    site_id: optionalPositiveId(form.site_id),
    dossier_id: dossierId ?? null,
    quote_date: form.quote_date,
    order_date: form.order_date?.trim() || undefined,
    site_delivery_date: form.site_delivery_date?.trim() || undefined,
    valid_until: form.valid_until?.trim() || undefined,
    tva_rate: defaultTva,
    discount_percent: Math.min(100, Math.max(0, finiteNum(form.discount_percent, 0))),
    discount_amount: Math.max(0, finiteNum(form.discount_amount, 0)),
    shipping_amount_ht: Math.max(0, finiteNum(form.shipping_amount_ht, 0)),
    shipping_tva_rate: finiteNum(form.shipping_tva_rate, 20),
    travel_fee_ht: Math.max(0, finiteNum(form.travel_fee_ht, 0)),
    travel_fee_tva_rate: finiteNum(form.travel_fee_tva_rate, 20),
    apply_site_travel: form.apply_site_travel || undefined,
    billing_address_id: optionalPositiveId(form.billing_address_id),
    delivery_address_id: optionalPositiveId(form.delivery_address_id),
    pdf_template_id: optionalPositiveId(form.pdf_template_id),
    notes: form.notes?.trim() || undefined,
    lines,
    meta: hasMeta ? meta : undefined,
  }
}
