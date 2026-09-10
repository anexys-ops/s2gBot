import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import { documentPdfTemplatesApi, invoicesApi, pdfApi } from '../../api/client'
import { documentPdfTypeLabel, type PdfGenerateType } from '../../lib/documentPdfTypes'

type Props = {
  documentType: PdfGenerateType
  documentId: number
  documentLabel: string
  onClose: () => void
  onEmail?: (templateId: number) => Promise<void>
  /** Présélectionne un modèle par slug (ex. bc-recap-dossier). */
  initialTemplateSlug?: string
  titleOverride?: string
  /** Facture portail client : PDF signé sans choix de modèle. */
  signedInvoicePreview?: boolean
}

function defaultDownloadName(documentType: string, documentLabel: string) {
  const safe = documentLabel.replace(/[^\w.-]+/g, '-')
  return `${documentType}-${safe || documentType}.pdf`
}

export default function DocumentPdfPickerModal({
  documentType,
  documentId,
  documentLabel,
  onClose,
  onEmail,
  initialTemplateSlug,
  titleOverride,
  signedInvoicePreview = false,
}: Props) {
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['document-pdf-templates', documentType, 'active'],
    queryFn: () => documentPdfTemplatesApi.list(documentType, true),
    enabled: !signedInvoicePreview,
  })

  const templates = data?.data ?? []

  const defaultId = useMemo(() => {
    if (initialTemplateSlug) {
      const bySlug = templates.find((t) => t.slug === initialTemplateSlug)
      if (bySlug) return bySlug.id
    }
    const def = templates.find((t) => t.is_default)
    return def?.id ?? templates[0]?.id ?? null
  }, [templates, initialTemplateSlug])

  const selectedId = templateId ?? defaultId

  function clearPreview() {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setPreviewBlob(null)
  }

  useEffect(() => {
    clearPreview()
    setError(null)
  }, [selectedId, documentType, documentId, signedInvoicePreview])

  useEffect(() => () => clearPreview(), [])

  useEffect(() => {
    if (signedInvoicePreview && !onEmail) {
      void loadPreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement initial facture signée uniquement
  }, [signedInvoicePreview, documentId, onEmail])

  async function loadPreview() {
    if (!signedInvoicePreview && selectedId == null) {
      setError('Aucun modèle PDF actif disponible.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const blob = signedInvoicePreview
        ? await invoicesApi.fetchInvoicePdf(documentId)
        : await pdfApi.fetchGenerate(documentType, documentId, Number(selectedId))
      clearPreview()
      setPreviewBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (onEmail) {
      if (selectedId == null) {
        setError('Aucun modèle PDF actif disponible.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        await onEmail(Number(selectedId))
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
      return
    }
    await loadPreview()
  }

  function handleDownload() {
    if (!previewBlob) return
    pdfApi.downloadBlob(previewBlob, defaultDownloadName(documentType, documentLabel))
  }

  const typeLabel = documentPdfTypeLabel(documentType)
  const title =
    titleOverride ??
    (onEmail ? `Envoyer ${typeLabel} par email` : `Aperçu ${typeLabel}`)

  return (
    <Modal title={title} onClose={() => !loading && onClose()} size="xl">
      <div className="pdf-preview-modal">
        <p className="pdf-preview-modal__intro">
          {typeLabel} <strong>{documentLabel}</strong>
        </p>

        {!signedInvoicePreview ? (
          <div className="form-group">
            <label htmlFor="pdf-template-pick">Modèle PDF</label>
            {isLoading ? (
              <p>Chargement des modèles…</p>
            ) : templates.length === 0 ? (
              <p className="text-muted">Aucun modèle actif. Configurez-en un dans Back office → Modèles PDF.</p>
            ) : (
              <select
                id="pdf-template-pick"
                className="input"
                value={selectedId == null ? '' : String(selectedId)}
                onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
                disabled={loading}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.is_default ? ' (défaut)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        {previewUrl ? (
          <div className="pdf-preview-modal__viewer">
            <iframe
              title={`Aperçu PDF — ${documentLabel}`}
              src={previewUrl}
              className="pdf-preview-modal__frame"
            />
          </div>
        ) : null}

        <div className="crud-actions pdf-preview-modal__actions">
          {onEmail ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || templates.length === 0}
              onClick={() => void handleConfirm()}
            >
              {loading ? 'En cours…' : 'Envoyer'}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || (!signedInvoicePreview && templates.length === 0)}
                onClick={() => void handleConfirm()}
              >
                {loading ? 'Génération…' : previewUrl ? 'Actualiser l’aperçu' : 'Visualiser'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!previewBlob}
                onClick={handleDownload}
              >
                Télécharger
              </button>
            </>
          )}
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  )
}
