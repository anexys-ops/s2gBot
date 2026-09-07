import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentPdfTemplatesApi, type DocumentPdfTemplateRow, type PdfLayoutConfig } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PageBackNav from '../components/PageBackNav'
import PdfLayoutConfigEditor from '../components/PdfLayoutConfigEditor'
import DocumentPdfTemplateOptionsEditor from '../components/pdf/DocumentPdfTemplateOptionsEditor'
import { documentPdfTypeLabel } from '../lib/documentPdfTypes'
import { formToLayoutConfigPayload, layoutConfigToForm, type PdfLayoutConfigForm } from '../lib/pdfLayoutConfig'

export default function DocumentPdfTemplateDetail() {
  const { id } = useParams<{ id: string }>()
  const templateId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()

  const { data: listData, isLoading, error } = useQuery({
    queryKey: ['document-pdf-templates'],
    queryFn: () => documentPdfTemplatesApi.list(),
    enabled: isLab && Number.isFinite(templateId),
  })

  const template: DocumentPdfTemplateRow | undefined = listData?.data.find((t) => t.id === templateId)

  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [form, setForm] = useState<PdfLayoutConfigForm>(() => layoutConfigToForm({}))

  useEffect(() => {
    if (!template) return
    setName(template.name)
    setIsActive(template.is_active !== false)
    setIsDefault(template.is_default)
    setForm(layoutConfigToForm(template.layout_config))
  }, [template])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!template) return
      const layout_config: PdfLayoutConfig =
        template.document_type === 'report'
          ? (template.layout_config ?? {})
          : {
              ...(template.layout_config ?? {}),
              totals: formToLayoutConfigPayload(form).totals,
              lines: formToLayoutConfigPayload(form).lines,
            }
      return documentPdfTemplatesApi.update(template.id, {
        name: name.trim() || template.name,
        is_active: isActive,
        is_default: isDefault,
        layout_config,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['document-pdf-templates'] })
      navigate('/back-office/modeles-documents-pdf')
    },
  })

  const saveReportLayoutMut = useMutation({
    mutationFn: (layout_config: PdfLayoutConfig) => documentPdfTemplatesApi.update(templateId, { layout_config }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['document-pdf-templates'] }),
  })

  if (!isLab) {
    return (
      <div>
        <PageBackNav back={{ to: '/labo', label: 'Laboratoire' }} />
        <p>Accès réservé au laboratoire.</p>
      </div>
    )
  }

  if (isLoading) return <p>Chargement…</p>
  if (error) return <p className="error">{String(error)}</p>
  if (!template) {
    return (
      <div>
        <PageBackNav back={{ to: '/back-office/modeles-documents-pdf', label: 'Modèles PDF' }} />
        <p>Modèle introuvable.</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div>
        <PageBackNav back={{ to: '/back-office/modeles-documents-pdf', label: 'Modèles PDF' }} />
        <p>Modification réservée aux administrateurs labo.</p>
      </div>
    )
  }

  return (
    <div>
      <PageBackNav back={{ to: '/back-office/modeles-documents-pdf', label: 'Modèles PDF' }} />
      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {documentPdfTypeLabel(template.document_type)} — {template.name}
        </h2>
        <p className="text-muted" style={{ fontSize: '0.9rem' }}>
          Cochez les options du modèle, définissez-le par défaut ou désactivez-le. À l&apos;impression ou à l&apos;envoi
          par email, l&apos;utilisateur choisira parmi les modèles <strong>actifs</strong>.
        </p>

        <div className="form-group">
          <label htmlFor="tpl-name">Nom du modèle</label>
          <input id="tpl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <label className="pdf-layout-editor__check">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Modèle actif (proposé à l&apos;impression / envoi)
        </label>
        <label className="pdf-layout-editor__check" style={{ display: 'block', marginTop: '0.5rem' }}>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            disabled={!isActive}
          />
          Modèle par défaut pour {documentPdfTypeLabel(template.document_type)}
        </label>

        <DocumentPdfTemplateOptionsEditor
          form={form}
          setForm={setForm}
          disabled={saveMut.isPending}
          documentType={template.document_type}
        />

        {template.document_type === 'report' ? (
          <details className="card" style={{ marginTop: '1rem' }} open>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Mise en page rapport (champs, logo, signature)</summary>
            <PdfLayoutConfigEditor
              layoutConfig={(template.layout_config ?? {}) as PdfLayoutConfig}
              disabled={saveReportLayoutMut.isPending}
              onSave={async (parsed) => {
                await saveReportLayoutMut.mutateAsync(parsed)
              }}
            />
          </details>
        ) : null}

        {saveMut.isError ? <p className="error">{(saveMut.error as Error).message}</p> : null}

        <div className="crud-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <Link to="/back-office/modeles-documents-pdf" className="btn btn-secondary">
            Annuler
          </Link>
        </div>
      </div>
    </div>
  )
}
