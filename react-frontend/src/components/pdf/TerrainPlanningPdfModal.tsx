import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { documentPdfTemplatesApi, pdfApi, planningTerrainApi } from '../../api/client'
import Modal from '../Modal'

type Props = {
  from: string
  to: string
  userId?: number
  technicianLabel: string
  context?: 'terrain' | 'labo' | 'ingenieur'
  onClose: () => void
}

export default function TerrainPlanningPdfModal({ from, to, userId, technicianLabel, context = 'terrain', onClose }: Props) {
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['document-pdf-templates', 'terrain_planning', 'active'],
    queryFn: () => documentPdfTemplatesApi.list('terrain_planning', true),
  })
  const templates = data?.data ?? []
  const selectedId = templateId ?? templates.find((item) => item.is_default)?.id ?? templates[0]?.id ?? null
  const title = from === to ? 'Programme journalier' : 'Programme hebdomadaire'
  const filenameContext = context === 'labo' ? 'laboratoire' : context === 'ingenieur' ? 'ingenierie' : 'terrain'
  const filename = `programme-${filenameContext}-${from === to ? from : `${from}_${to}`}.pdf`

  const clearPreview = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setPreviewBlob(null)
  }, [])

  const loadPreview = useCallback(async () => {
    if (selectedId == null) return
    setLoading(true)
    setError(null)
    clearPreview()
    try {
      const blob = await planningTerrainApi.fetchPdf({
        from,
        to,
        user_id: userId,
        template_id: selectedId,
        context,
      })
      setPreviewBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [clearPreview, context, from, selectedId, to, userId])

  useEffect(() => {
    if (!isLoading && selectedId != null) void loadPreview()
  }, [isLoading, loadPreview, selectedId])

  useEffect(() => () => clearPreview(), [clearPreview])

  const periodLabel = useMemo(() => from === to ? from : `${from} au ${to}`, [from, to])

  return (
    <Modal title={title} onClose={() => !loading && onClose()} size="xl">
      <div className="pdf-preview-modal">
        <p className="pdf-preview-modal__intro"><strong>{technicianLabel}</strong> — {periodLabel}</p>
        <div className="form-group">
          <label htmlFor="terrain-pdf-template">Modèle PDF</label>
          {isLoading ? <p>Chargement des modèles…</p> : (
            <select
              id="terrain-pdf-template"
              value={selectedId ?? ''}
              onChange={(event) => setTemplateId(event.target.value ? Number(event.target.value) : null)}
              disabled={loading}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}{template.is_default ? ' (défaut)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        {templates.length === 0 && !isLoading ? <p className="error">Aucun modèle de planning actif.</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="pdf-preview-modal__viewer">
          {loading ? <p className="pdf-preview-modal__loading text-muted">Génération du PDF en cours…</p> : null}
          {previewUrl ? <iframe title={`Aperçu PDF — ${title}`} src={previewUrl} className="pdf-preview-modal__frame" /> : null}
        </div>
        <div className="crud-actions pdf-preview-modal__actions">
          <button type="button" className="btn btn-primary" onClick={() => void loadPreview()} disabled={loading || selectedId == null}>
            {loading ? 'Génération…' : 'Actualiser l’aperçu'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!previewBlob}
            onClick={() => previewBlob && pdfApi.downloadBlob(previewBlob, filename)}
          >
            Télécharger
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Fermer</button>
        </div>
      </div>
    </Modal>
  )
}
