import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  bonsCommandeApi,
  invoicesApi,
  quotesApi,
  type Invoice,
  type Quote,
} from '../../api/client'
import ConfirmDialog from '../ConfirmDialog'
import DocumentPdfPickerModal from '../pdf/DocumentPdfPickerModal'
import StatusChangeModal from '../StatusChangeModal'
import {
  commercialDocumentCancelStatus,
  commercialDocumentCapabilities,
  commercialDocumentPdfType,
  commercialDocumentStatusOptions,
  type CommercialDocumentType,
} from '../../lib/commercialDocumentActionConfig'
import { buildQuoteDuplicateBody } from '../../lib/quoteDuplicateBody'
import { invoiceEmailRecipient } from '../../lib/invoiceEmailRecipient'
import { quoteEmailRecipient } from '../../lib/quoteEmailRecipient'

type Props = {
  documentType: CommercialDocumentType
  entityId: number
  entityLabel: string
  status: string
  isLab: boolean
  isAdmin: boolean
  /** Devis complet pour l’email (optionnel si quoteForEmail omis et documentType quote). */
  quoteForEmail?: Quote | null
  /** Facture complète pour l’email (documentType invoice). */
  invoiceForEmail?: Invoice | null
  /** BC : empêche la suppression si un BL existe déjà. */
  hasBonLivraison?: boolean
  /** Afficher la barre de boutons (défaut true). */
  showHeader?: boolean
  onDeleted?: () => void
  onDuplicated?: (newId: number) => void
  onStatusChanged?: () => void
  onCancelled?: () => void
}

export default function CommercialDocumentActions({
  documentType,
  entityId,
  entityLabel,
  status,
  isLab,
  isAdmin,
  quoteForEmail = null,
  invoiceForEmail = null,
  hasBonLivraison = false,
  showHeader = true,
  onDeleted,
  onDuplicated,
  onStatusChanged,
  onCancelled,
}: Props) {
  const queryClient = useQueryClient()
  const [pdfOpen, setPdfOpen] = useState(false)
  const [recapPdfOpen, setRecapPdfOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const emailRecipient =
    documentType === 'quote' && quoteForEmail
      ? quoteEmailRecipient(quoteForEmail)
      : documentType === 'invoice' && invoiceForEmail
        ? invoiceEmailRecipient(invoiceForEmail)
        : null

  const capabilities = commercialDocumentCapabilities({
    documentType,
    status,
    isLab,
    isAdmin,
    hasBonLivraison,
    emailAvailable: emailRecipient != null,
  })

  const statusOptions = commercialDocumentStatusOptions(documentType)
  const pdfType = commercialDocumentPdfType(documentType)
  const cancelStatus = commercialDocumentCancelStatus(documentType)

  const invalidate = () => {
    switch (documentType) {
      case 'quote':
        void queryClient.invalidateQueries({ queryKey: ['quotes'] })
        void queryClient.invalidateQueries({ queryKey: ['quote', entityId] })
        break
      case 'bon_commande':
        void queryClient.invalidateQueries({ queryKey: ['bons-commande'] })
        void queryClient.invalidateQueries({ queryKey: ['bon-commande', entityId] })
        break
      case 'invoice':
        void queryClient.invalidateQueries({ queryKey: ['invoices'] })
        void queryClient.invalidateQueries({ queryKey: ['invoice', entityId] })
        break
      default: {
        const _exhaustive: never = documentType
        return _exhaustive
      }
    }
  }

  const statusMutation = useMutation({
    mutationFn: async (nextStatus: string) => {
      switch (documentType) {
        case 'quote':
          await quotesApi.update(entityId, { status: nextStatus })
          break
        case 'bon_commande':
          await bonsCommandeApi.update(entityId, { statut: nextStatus })
          break
        case 'invoice':
          await invoicesApi.update(entityId, { status: nextStatus })
          break
        default: {
          const _exhaustive: never = documentType
          throw new Error(String(_exhaustive))
        }
      }
    },
    onSuccess: () => {
      invalidate()
      setStatusOpen(false)
      setActionError(null)
      onStatusChanged?.()
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelStatus) throw new Error('Annulation non disponible.')
      switch (documentType) {
        case 'quote':
          await quotesApi.update(entityId, { status: cancelStatus })
          break
        case 'bon_commande':
          await bonsCommandeApi.update(entityId, { statut: cancelStatus })
          break
        default:
          throw new Error('Annulation non disponible.')
      }
    },
    onSuccess: () => {
      invalidate()
      setCancelOpen(false)
      setActionError(null)
      onCancelled?.()
      onStatusChanged?.()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      switch (documentType) {
        case 'quote':
          await quotesApi.delete(entityId)
          break
        case 'bon_commande':
          await bonsCommandeApi.delete(entityId)
          break
        case 'invoice':
          await invoicesApi.delete(entityId)
          break
        default: {
          const _exhaustive: never = documentType
          throw new Error(String(_exhaustive))
        }
      }
    },
    onSuccess: () => {
      invalidate()
      setDeleteOpen(false)
      onDeleted?.()
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const source = await quotesApi.get(entityId)
      const body = buildQuoteDuplicateBody(source)
      return quotesApi.create(body)
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setActionError(null)
      if (created?.id) onDuplicated?.(created.id)
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const sendEmailMutation = useMutation({
    mutationFn: ({
      templateId,
      email,
      name,
    }: {
      templateId: number
      email: string
      name: string
    }) => {
      if (documentType === 'invoice') {
        return invoicesApi.sendEmail(entityId, {
          recipient_email: email,
          recipient_name: name,
          pdf_template_id: templateId,
        })
      }
      return quotesApi.sendEmail(entityId, {
        recipient_email: email,
        recipient_name: name,
        pdf_template_id: templateId,
      })
    },
    onSuccess: () => {
      invalidate()
      setEmailOpen(false)
      setActionError(null)
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const hasAnyAction =
    capabilities.canDuplicate ||
    capabilities.canPrint ||
    capabilities.canEmail ||
    capabilities.canChangeStatus ||
    capabilities.canCancel ||
    capabilities.canDelete

  if (!hasAnyAction && !showHeader) return null

  const cancelLabel =
    documentType === 'quote'
      ? 'Marquer comme perdu'
      : documentType === 'bon_commande'
        ? 'Annuler le bon de commande'
        : 'Annuler'

  return (
    <>
      {showHeader && hasAnyAction ? (
        <div className="commercial-doc-actions" role="toolbar" aria-label="Actions document">
          {capabilities.canDuplicate ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={duplicateMutation.isPending}
              onClick={() => duplicateMutation.mutate()}
            >
              {duplicateMutation.isPending ? 'Duplication…' : 'Dupliquer'}
            </button>
          ) : null}
          {capabilities.canPrint ? (
            documentType === 'invoice' && !isLab ? (
              <InvoicePrintButton entityId={entityId} />
            ) : (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPdfOpen(true)}>
                  Imprimer
                </button>
                {documentType === 'bon_commande' ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setRecapPdfOpen(true)}
                  >
                    Récap dossier
                  </button>
                ) : null}
              </>
            )
          ) : null}
          {capabilities.canEmail ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEmailOpen(true)}>
              Envoyer par mail
            </button>
          ) : null}
          {capabilities.canChangeStatus ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatusOpen(true)}>
              Changer le statut
            </button>
          ) : null}
          {capabilities.canCancel ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCancelOpen(true)}>
              Annuler
            </button>
          ) : null}
          {capabilities.canDelete ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteOpen(true)}>
              Supprimer
            </button>
          ) : null}
        </div>
      ) : null}

      {actionError && !pdfOpen && !emailOpen && !statusOpen && !deleteOpen && !cancelOpen ? (
        <p className="error commercial-doc-actions__error">{actionError}</p>
      ) : null}

      {pdfOpen ? (
        <DocumentPdfPickerModal
          documentType={pdfType}
          documentId={entityId}
          documentLabel={entityLabel}
          onClose={() => setPdfOpen(false)}
        />
      ) : null}

      {recapPdfOpen ? (
        <DocumentPdfPickerModal
          documentType={pdfType}
          documentId={entityId}
          documentLabel={entityLabel}
          initialTemplateSlug="bc-recap-dossier"
          titleOverride="Imprimer récap dossier"
          onClose={() => setRecapPdfOpen(false)}
        />
      ) : null}

      {emailOpen && emailRecipient ? (
        <DocumentPdfPickerModal
          documentType={documentType === 'invoice' ? 'invoice' : 'quote'}
          documentId={entityId}
          documentLabel={entityLabel}
          onClose={() => {
            if (!sendEmailMutation.isPending) setEmailOpen(false)
          }}
          onEmail={async (templateId) => {
            await sendEmailMutation.mutateAsync({
              templateId,
              email: emailRecipient.email,
              name: emailRecipient.name,
            })
          }}
        />
      ) : null}

      {statusOpen ? (
        <StatusChangeModal
          title={`Statut — ${entityLabel}`}
          initialValue={status}
          options={statusOptions}
          isPending={statusMutation.isPending}
          error={statusMutation.isError ? (statusMutation.error as Error).message : null}
          onClose={() => setStatusOpen(false)}
          onSave={(next) => statusMutation.mutate(next)}
        />
      ) : null}

      {cancelOpen && cancelStatus ? (
        <ConfirmDialog
          title={documentType === 'quote' ? 'Annuler le devis' : 'Annuler le bon de commande'}
          message={
            documentType === 'quote' ? (
              <>
                Marquer le devis <strong>{entityLabel}</strong> comme <strong>perdu</strong> ?
              </>
            ) : (
              <>
                Annuler le bon de commande <strong>{entityLabel}</strong> ? Il passera au statut{' '}
                <strong>Annulé</strong>.
              </>
            )
          }
          confirmLabel={cancelLabel}
          variant="danger"
          loading={cancelMutation.isPending}
          error={cancelMutation.isError ? (cancelMutation.error as Error).message : null}
          onConfirm={() => cancelMutation.mutate()}
          onCancel={() => {
            if (!cancelMutation.isPending) setCancelOpen(false)
          }}
        />
      ) : null}

      {deleteOpen ? (
        <ConfirmDialog
          title={
            documentType === 'quote'
              ? 'Supprimer le devis'
              : documentType === 'bon_commande'
                ? 'Supprimer le bon de commande'
                : 'Supprimer la facture'
          }
          message={
            <>
              Supprimer définitivement{' '}
              {documentType === 'invoice' ? 'la facture' : documentType === 'bon_commande' ? 'le bon' : 'le devis'}{' '}
              <strong>{entityLabel}</strong> ? Cette action est irréversible.
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMutation.isPending}
          error={deleteMutation.isError ? (deleteMutation.error as Error).message : null}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => {
            if (!deleteMutation.isPending) setDeleteOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

/** Bouton imprimer facture (client portail, lien PDF direct). */
function InvoicePrintButton({ entityId }: { entityId: number }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      disabled={loading}
      onClick={() => {
        setLoading(true)
        void invoicesApi.openInvoicePdf(entityId).finally(() => setLoading(false))
      }}
    >
      {loading ? 'PDF…' : 'Imprimer'}
    </button>
  )
}

/** Variante pour facture sans modèle PDF unifié (client non lab). */
export function InvoicePrintAction({
  invoice,
  className = 'btn btn-secondary btn-sm',
}: {
  invoice: Pick<Invoice, 'id' | 'number'>
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      type="button"
      className={className}
      disabled={loading}
      onClick={() => {
        setLoading(true)
        void invoicesApi.openInvoicePdf(invoice.id).finally(() => setLoading(false))
      }}
    >
      {loading ? 'PDF…' : 'Imprimer'}
    </button>
  )
}
