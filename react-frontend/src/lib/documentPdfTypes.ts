export const DOCUMENT_PDF_TYPE_LABELS: Record<string, string> = {
  quote: 'Devis',
  invoice: 'Facture',
  report: "Rapport d'essais",
  purchase_order: 'Bon de commande',
  delivery_note: 'Bon de livraison',
}

export function documentPdfTypeLabel(documentType: string): string {
  return DOCUMENT_PDF_TYPE_LABELS[documentType] ?? documentType
}

/** Type API pour POST /pdf/generate */
export type PdfGenerateType = 'quote' | 'invoice' | 'report' | 'purchase_order' | 'delivery_note'

export function pdfGenerateTypeLabel(type: PdfGenerateType): string {
  return documentPdfTypeLabel(type)
}
