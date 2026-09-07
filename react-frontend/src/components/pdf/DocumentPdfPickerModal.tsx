import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import { documentPdfTemplatesApi, pdfApi } from '../../api/client'
import { documentPdfTypeLabel, type PdfGenerateType } from '../../lib/documentPdfTypes'

type Props = {
  documentType: PdfGenerateType
  documentId: number
  documentLabel: string
  onClose: () => void
  onEmail?: (templateId: number) => Promise<void>
}

export default function DocumentPdfPickerModal({
  documentType,
  documentId,
  documentLabel,
  onClose,
  onEmail,
}: Props) {
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['document-pdf-templates', documentType, 'active'],
    queryFn: () => documentPdfTemplatesApi.list(documentType, true),
  })

  const templates = data?.data ?? []

  const defaultId = useMemo(() => {
    const def = templates.find((t) => t.is_default)
    return def?.id ?? templates[0]?.id ?? null
  }, [templates])

  const selectedId = templateId ?? defaultId

  async function handleConfirm() {
    if (selectedId == null) {
      setError('Aucun modèle PDF actif disponible.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (onEmail) {
        await onEmail(Number(selectedId))
      } else {
        await pdfApi.generate(documentType, documentId, Number(selectedId))
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const typeLabel = documentPdfTypeLabel(documentType)
  const title = onEmail ? `Envoyer ${typeLabel} par email` : `Imprimer ${typeLabel}`

  return (
    <Modal title={title} onClose={() => !loading && onClose()}>
      <p style={{ marginTop: 0 }}>
        {typeLabel} <strong>{documentLabel}</strong>
      </p>
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
      {error ? <p className="error">{error}</p> : null}
      <div className="crud-actions">
        <button type="button" className="btn btn-primary" disabled={loading || templates.length === 0} onClick={() => void handleConfirm()}>
          {loading ? 'En cours…' : onEmail ? 'Envoyer' : 'Télécharger le PDF'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={loading} onClick={onClose}>
          Annuler
        </button>
      </div>
    </Modal>
  )
}
