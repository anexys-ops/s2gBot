import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { documentPdfTemplatesApi, type DocumentPdfTemplateRow } from '../../api/client'
import { DOCUMENT_PDF_TYPE_LABELS, documentPdfTypeLabel } from '../../lib/documentPdfTypes'

type Props = {
  templates: DocumentPdfTemplateRow[]
  onClose: () => void
  onCreated: (template: DocumentPdfTemplateRow) => void
}

const BLADE_LABELS: Record<string, string> = {
  'pdf.quote': 'Devis classique',
  'pdf.quote_detailed': 'Devis détaillé (TVA par ligne)',
  'pdf.invoice': 'Facture classique',
  'pdf.invoice_detailed': 'Facture détaillée',
  'pdf.purchase_order': 'Bon de commande',
  'pdf.delivery_note': 'Bon de livraison',
  'reports.order': 'Rapport commande',
  'pdf.examples.synthese': 'Rapport — synthèse',
  'pdf.examples.granulometrie': 'Rapport — granulométrie',
  'pdf.examples.compression': 'Rapport — compression',
}

export default function DocumentPdfTemplateCreateModal({ templates, onClose, onCreated }: Props) {
  const [documentType, setDocumentType] = useState('quote')
  const [name, setName] = useState('')
  const [bladeView, setBladeView] = useState('')
  const [cloneFromId, setCloneFromId] = useState<number | ''>('')
  const [isDefault, setIsDefault] = useState(false)

  const { data: options } = useQuery({
    queryKey: ['document-pdf-templates', 'options'],
    queryFn: () => documentPdfTemplatesApi.options(),
  })

  const bladeViews = options?.blade_views?.[documentType] ?? []
  const selectedBlade = bladeView || bladeViews[0] || ''

  const cloneCandidates = useMemo(
    () => templates.filter((t) => t.document_type === documentType),
    [templates, documentType],
  )

  const createMut = useMutation({
    mutationFn: () =>
      documentPdfTemplatesApi.create({
        document_type: documentType,
        name: name.trim(),
        blade_view: selectedBlade || undefined,
        clone_from_id: cloneFromId !== '' ? cloneFromId : undefined,
        is_default: isDefault,
        is_active: true,
      }),
    onSuccess: (template) => onCreated(template),
  })

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal card"
        role="dialog"
        aria-labelledby="pdf-template-create-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '32rem', width: '100%' }}
      >
        <h2 id="pdf-template-create-title" style={{ marginTop: 0 }}>Nouveau modèle PDF</h2>

        <div className="form-group">
          <label htmlFor="pdf-new-type">Type de document</label>
          <select
            id="pdf-new-type"
            value={documentType}
            onChange={(e) => {
              setDocumentType(e.target.value)
              setCloneFromId('')
              setBladeView('')
            }}
          >
            {(options?.document_types ?? Object.keys(DOCUMENT_PDF_TYPE_LABELS)).map((type) => (
              <option key={type} value={type}>{documentPdfTypeLabel(type)}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pdf-new-name">Nom du modèle</label>
          <input
            id="pdf-new-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Ex. ${documentPdfTypeLabel(documentType)} sans prix`}
          />
        </div>

        {bladeViews.length > 1 && (
          <div className="form-group">
            <label htmlFor="pdf-new-blade">Mise en page Blade</label>
            <select
              id="pdf-new-blade"
              value={selectedBlade}
              onChange={(e) => setBladeView(e.target.value)}
            >
              {bladeViews.map((view) => (
                <option key={view} value={view}>{BLADE_LABELS[view] ?? view}</option>
              ))}
            </select>
          </div>
        )}

        {cloneCandidates.length > 0 && (
          <div className="form-group">
            <label htmlFor="pdf-new-clone">Copier les options depuis</label>
            <select
              id="pdf-new-clone"
              value={cloneFromId}
              onChange={(e) => setCloneFromId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— Options par défaut —</option>
              {cloneCandidates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        <label className="pdf-layout-editor__check">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Définir comme modèle par défaut
        </label>

        {createMut.isError && <p className="error">{(createMut.error as Error).message}</p>}

        <div className="crud-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={createMut.isPending || name.trim() === ''}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? 'Création…' : 'Créer'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
