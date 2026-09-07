import type { PdfGenerateType } from './documentPdfTypes'

export type CommercialDocumentType = 'quote' | 'bon_commande' | 'invoice'

export type CommercialDocumentCapabilities = {
  canDuplicate: boolean
  canPrint: boolean
  canEmail: boolean
  canChangeStatus: boolean
  canCancel: boolean
  canDelete: boolean
}

export const QUOTE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'validated', label: 'Validé' },
  { value: 'signed', label: 'Signé' },
  { value: 'sent', label: 'Envoyé' },
  { value: 'relanced', label: 'Relancé' },
  { value: 'lost', label: 'Perdu' },
  { value: 'invoiced', label: 'Facturé' },
  { value: 'accepted', label: 'Accepté' },
  { value: 'rejected', label: 'Refusé' },
] as const

export const BC_STATUS_OPTIONS = [
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'confirme', label: 'Confirmé' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'livre', label: 'Livré' },
  { value: 'annule', label: 'Annulé' },
] as const

export const INVOICE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'validated', label: 'Validée' },
  { value: 'signed', label: 'Signée' },
  { value: 'sent', label: 'Envoyée' },
  { value: 'relanced', label: 'Relancée' },
  { value: 'paid', label: 'Encaissée' },
] as const

export function commercialDocumentPdfType(documentType: CommercialDocumentType): PdfGenerateType {
  switch (documentType) {
    case 'quote':
      return 'quote'
    case 'bon_commande':
      return 'purchase_order'
    case 'invoice':
      return 'invoice'
    default: {
      const _exhaustive: never = documentType
      return _exhaustive
    }
  }
}

export function commercialDocumentStatusOptions(documentType: CommercialDocumentType) {
  switch (documentType) {
    case 'quote':
      return [...QUOTE_STATUS_OPTIONS]
    case 'bon_commande':
      return [...BC_STATUS_OPTIONS]
    case 'invoice':
      return [...INVOICE_STATUS_OPTIONS]
    default: {
      const _exhaustive: never = documentType
      return _exhaustive
    }
  }
}

type CapabilityInput = {
  documentType: CommercialDocumentType
  status: string
  isLab: boolean
  isAdmin: boolean
  hasBonLivraison?: boolean
  emailAvailable?: boolean
}

export function commercialDocumentCapabilities(input: CapabilityInput): CommercialDocumentCapabilities {
  const { documentType, status, isLab, isAdmin, hasBonLivraison = false, emailAvailable = false } = input

  switch (documentType) {
    case 'quote':
      return {
        canDuplicate: isLab,
        canPrint: isLab,
        canEmail: isLab && status === 'draft' && emailAvailable,
        canChangeStatus: isLab,
        canCancel: isLab && !['lost', 'rejected', 'invoiced'].includes(status),
        canDelete: isAdmin,
      }
    case 'bon_commande':
      return {
        canDuplicate: false,
        canPrint: isLab,
        canEmail: false,
        canChangeStatus: isLab && status !== 'annule',
        canCancel: isLab && status !== 'annule',
        canDelete: isLab && !hasBonLivraison,
      }
    case 'invoice':
      return {
        canDuplicate: false,
        canPrint: true,
        canEmail: false,
        canChangeStatus: isAdmin,
        canCancel: false,
        canDelete: isAdmin,
      }
    default: {
      const _exhaustive: never = documentType
      return _exhaustive
    }
  }
}

export function commercialDocumentCancelStatus(documentType: CommercialDocumentType): string | null {
  switch (documentType) {
    case 'quote':
      return 'lost'
    case 'bon_commande':
      return 'annule'
    case 'invoice':
      return null
    default: {
      const _exhaustive: never = documentType
      return _exhaustive
    }
  }
}
