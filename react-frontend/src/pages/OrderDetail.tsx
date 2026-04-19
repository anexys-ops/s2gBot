import { useParams, useNavigate, Link } from 'react-router-dom'
import PageBackNav from '../components/PageBackNav'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  boreholesApi,
  missionsApi,
  ordersApi,
  reportsApi,
  samplesApi,
  reportPdfTemplatesApi,
  reportFormDefinitionsApi,
  type Borehole,
  type EntityMetaPayload,
} from '../api/client'
import EntityMetaCard from '../components/module/EntityMetaCard'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect, useMemo } from 'react'
import Modal from '../components/Modal'
import type { Order, Report, Sample, SampleWriteBody } from '../api/client'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Envoyée',
  in_progress: 'En cours',
  completed: 'Terminée',
}

const SAMPLE_STATUS = ['pending', 'received', 'in_progress', 'tested', 'validated'] as const

type BoreholeOption = Borehole & { mission_label: string }

function numOrEmpty(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

function parseOptNumber(s: string): number | undefined {
  const t = s.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function reviewStatusLabel(code: string | null | undefined): string {
  switch (code) {
    case 'draft':
      return 'Brouillon'
    case 'pending_review':
      return 'Attente validation'
    case 'approved':
      return 'Validé'
    default:
      return code?.trim() ? code : '—'
  }
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const [selectedSample, setSelectedSample] = useState<number | null>(null)
  const [resultValues, setResultValues] = useState<Record<number, string>>({})
  const [sampleModal, setSampleModal] = useState<Sample | 'new' | null>(null)
  const [sampleForm, setSampleForm] = useState({
    reference: '',
    status: 'pending',
    notes: '',
    order_item_id: 0,
    borehole_id: '' as number | '',
    depth_top_m: '',
    depth_bottom_m: '',
  })
  const [orderEdit, setOrderEdit] = useState({ order_date: '', notes: '', status: '' })
  const [pdfTemplateId, setPdfTemplateId] = useState<number | ''>('')
  const [formDefId, setFormDefId] = useState<number | ''>('')
  const [formFieldValues, setFormFieldValues] = useState<Record<string, string>>({})
  const [signModal, setSignModal] = useState<Report | null>(null)
  const [signerName, setSignerName] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(undefined)

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(Number(id)),
    enabled: !!id && id !== 'new',
  })

  const orderSiteId = order?.site_id
  const { data: siteBoreholes = [] } = useQuery({
    queryKey: ['site-boreholes-flat', orderSiteId],
    queryFn: async () => {
      const missions = await missionsApi.list(orderSiteId!)
      const out: BoreholeOption[] = []
      for (const m of missions) {
        const missionLabel = m.reference?.trim() || m.title?.trim() || `Mission #${m.id}`
        const bhs = await boreholesApi.list(m.id)
        for (const b of bhs) {
          out.push({ ...b, mission_label: missionLabel })
        }
      }
      return out
    },
    enabled: !!orderSiteId,
  })

  const { data: tplRes } = useQuery({
    queryKey: ['report-pdf-templates'],
    queryFn: () => reportPdfTemplatesApi.list(),
    enabled: !!id && id !== 'new' && isLab,
  })

  const { data: formDefsRes } = useQuery({
    queryKey: ['report-form-definitions'],
    queryFn: () => reportFormDefinitionsApi.list(),
    enabled: !!id && id !== 'new' && isLab,
  })

  const pdfTemplates = tplRes?.data ?? []
  const formDefs = formDefsRes?.data ?? []

  const selectedFormDef = useMemo(() => formDefs.find((d) => d.id === formDefId), [formDefs, formDefId])

  useEffect(() => {
    if (pdfTemplateId !== '' || !pdfTemplates.length) return
    const def = pdfTemplates.find((t) => t.is_default) ?? pdfTemplates[0]
    setPdfTemplateId(def.id)
  }, [pdfTemplates, pdfTemplateId])

  useEffect(() => {
    if (formDefId !== '' || !formDefs.length) return
    setFormDefId(formDefs[0].id)
  }, [formDefs, formDefId])

  useEffect(() => {
    if (!selectedFormDef) {
      setFormFieldValues({})
      return
    }
    setFormFieldValues((prev) => {
      const next: Record<string, string> = {}
      for (const f of selectedFormDef.fields) {
        next[f.key] = prev[f.key] ?? ''
      }
      return next
    })
  }, [selectedFormDef])

  const reportMutation = useMutation({
    mutationFn: () => {
      const tid = pdfTemplateId === '' ? undefined : Number(pdfTemplateId)
      const form_data: Record<string, unknown> = {}
      selectedFormDef?.fields.forEach((f) => {
        const raw = formFieldValues[f.key]?.trim() ?? ''
        if (raw === '') return
        form_data[f.key] = f.type === 'number' ? Number(raw) : raw
      })
      return ordersApi.generateReport(Number(id), {
        pdf_template_id: tid,
        form_data: Object.keys(form_data).length ? form_data : undefined,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const signMutation = useMutation({
    mutationFn: (payload: { reportId: number; signer_name: string; signature_image_data?: string }) =>
      reportsApi.sign(payload.reportId, {
        signer_name: payload.signer_name,
        signature_image_data: payload.signature_image_data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      setSignModal(null)
      setSignerName('')
      setSignatureDataUrl(undefined)
    },
  })

  const submitReviewMut = useMutation({
    mutationFn: (reportId: number) => reportsApi.submitReview(reportId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const approveReviewMut = useMutation({
    mutationFn: (reportId: number) => reportsApi.approveReview(reportId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const resultMutation = useMutation({
    mutationFn: ({ sampleId, results }: { sampleId: number; results: Array<{ test_type_param_id: number; value: string }> }) =>
      samplesApi.results(sampleId, results),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      setSelectedSample(null)
      setResultValues({})
    },
  })

  const orderUpdateMut = useMutation({
    mutationFn: (
      body: Partial<Pick<Order, 'order_date' | 'notes' | 'status' | 'site_id'>> & { meta?: EntityMetaPayload | null },
    ) => ordersApi.update(Number(id), body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const orderMetaMut = useMutation({
    mutationFn: (meta: EntityMetaPayload) => ordersApi.update(Number(id), { meta }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const orderDeleteMut = useMutation({
    mutationFn: () => ordersApi.delete(Number(id)),
    onSuccess: () => navigate('/orders'),
  })

  const sampleUpdateMut = useMutation({
    mutationFn: ({
      sampleId,
      body,
    }: {
      sampleId: number
      body: Partial<SampleWriteBody> & Partial<Pick<Sample, 'status'>>
    }) => samplesApi.update(sampleId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      setSampleModal(null)
    },
  })

  const sampleCreateMut = useMutation({
    mutationFn: () =>
      samplesApi.create({
        order_item_id: sampleForm.order_item_id,
        reference: sampleForm.reference,
        notes: sampleForm.notes || undefined,
        borehole_id: sampleForm.borehole_id === '' ? undefined : Number(sampleForm.borehole_id),
        depth_top_m: parseOptNumber(sampleForm.depth_top_m),
        depth_bottom_m: parseOptNumber(sampleForm.depth_bottom_m),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      setSampleModal(null)
    },
  })

  const sampleDeleteMut = useMutation({
    mutationFn: (sampleId: number) => samplesApi.delete(sampleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  useEffect(() => {
    if (order) {
      setOrderEdit({
        order_date: order.order_date?.slice(0, 10) ?? '',
        notes: order.notes ?? '',
        status: order.status,
      })
    }
  }, [order])

  if (id === 'new') {
    navigate('/orders/new')
    return null
  }

  if (isLoading || !id) return <p>Chargement...</p>
  if (error || !order) return <p className="error">Commande introuvable.</p>

  const handleSubmitResults = () => {
    if (!selectedSample) return
    const results = Object.entries(resultValues)
      .filter(([, v]) => v !== '')
      .map(([paramId, value]) => ({ test_type_param_id: Number(paramId), value }))
    if (results.length === 0) return
    resultMutation.mutate({ sampleId: selectedSample, results })
  }

  const sample = order.order_items?.flatMap((oi) => oi.samples ?? []).find((s) => s.id === selectedSample)
  const params = sample?.order_item?.test_type?.params ?? []

  const canDeleteOrder =
    isAdmin ||
    (order.status === 'draft' &&
      (user?.role === 'lab_technician' || (user?.role === 'client' && order.client_id === user.client_id)))

  const openEditSample = (s: Sample) => {
    setSampleForm({
      reference: s.reference,
      status: s.status,
      notes: s.notes ?? '',
      order_item_id: s.order_item_id,
      borehole_id: s.borehole_id ?? '',
      depth_top_m: numOrEmpty(s.depth_top_m),
      depth_bottom_m: numOrEmpty(s.depth_bottom_m),
    })
    setSampleModal(s)
  }

  const openNewSample = (orderItemId: number) => {
    setSampleForm({
      reference: '',
      status: 'pending',
      notes: '',
      order_item_id: orderItemId,
      borehole_id: '',
      depth_top_m: '',
      depth_bottom_m: '',
    })
    setSampleModal('new')
  }

  const submitSampleForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (sampleModal === 'new') {
      if (!sampleForm.reference.trim()) return
      sampleCreateMut.mutate()
    } else if (sampleModal && typeof sampleModal === 'object') {
      sampleUpdateMut.mutate({
        sampleId: sampleModal.id,
        body: {
          reference: sampleForm.reference,
          status: sampleForm.status,
          notes: sampleForm.notes || undefined,
          borehole_id: sampleForm.borehole_id === '' ? null : Number(sampleForm.borehole_id),
          depth_top_m: parseOptNumber(sampleForm.depth_top_m),
          depth_bottom_m: parseOptNumber(sampleForm.depth_bottom_m),
        },
      })
    }
  }

  return (
    <div>
      <PageBackNav
        back={{ to: '/orders', label: 'Liste des commandes' }}
        extras={[
          { to: '/terrain', label: 'Terrain' },
          { to: '/labo', label: 'Laboratoire' },
        ]}
      />
      <h1>Commande {order.reference}</h1>
      <p>
        Client : {order.client?.name} — Chantier : {order.site?.name ?? '-'} — Statut :{' '}
        {STATUS_LABELS[order.status] ?? order.status}
      </p>
      <p>Date : {new Date(order.order_date).toLocaleDateString('fr-FR')}</p>

      {isLab && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Modifier la commande</h2>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={orderEdit.order_date}
              onChange={(e) => setOrderEdit((o) => ({ ...o, order_date: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={orderEdit.notes}
              onChange={(e) => setOrderEdit((o) => ({ ...o, notes: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="form-group">
            <label>Statut</label>
            <select
              value={orderEdit.status}
              onChange={(e) => setOrderEdit((o) => ({ ...o, status: e.target.value }))}
            >
              <option value="draft">Brouillon</option>
              <option value="submitted">Envoyée</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminée</option>
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={orderUpdateMut.isPending}
            onClick={() =>
              orderUpdateMut.mutate({
                order_date: orderEdit.order_date,
                notes: orderEdit.notes,
                status: orderEdit.status,
              })
            }
          >
            {orderUpdateMut.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
          {orderUpdateMut.isError && <p className="error">{(orderUpdateMut.error as Error).message}</p>}
        </div>
      )}

      <EntityMetaCard
        meta={order.meta}
        editable={!!isLab}
        onSave={isLab ? (meta) => orderMetaMut.mutateAsync(meta) : undefined}
        isSaving={orderMetaMut.isPending}
        saveError={orderMetaMut.isError ? (orderMetaMut.error as Error).message : null}
      />

      <div className="crud-actions" style={{ marginBottom: '1rem' }}>
        {canDeleteOrder && (
          <button
            type="button"
            className="btn btn-secondary btn-danger-outline"
            onClick={() => {
              if (window.confirm('Supprimer cette commande ?')) orderDeleteMut.mutate()
            }}
            disabled={orderDeleteMut.isPending}
          >
            Supprimer la commande
          </button>
        )}
      </div>

      {isLab && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Générer un rapport PDF</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted, #64748b)' }}>
            Choisissez un modèle PDF et un formulaire métier (données terrain). La même structure s&apos;applique à tous les services via les définitions côté API.
          </p>
          {isAdmin && (
            <p style={{ fontSize: '0.85rem' }}>
              <Link to="/back-office/modeles-rapports-pdf">Configurer les modèles PDF des rapports (défaut, libellés)</Link>
            </p>
          )}
          <div className="form-group">
            <label>Modèle PDF</label>
            <select
              value={pdfTemplateId === '' ? '' : String(pdfTemplateId)}
              onChange={(e) => setPdfTemplateId(e.target.value ? Number(e.target.value) : '')}
            >
              {pdfTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_default ? ' (défaut)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Formulaire / service</label>
            <select
              value={formDefId === '' ? '' : String(formDefId)}
              onChange={(e) => setFormDefId(e.target.value ? Number(e.target.value) : '')}
            >
              {formDefs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {selectedFormDef && selectedFormDef.fields.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem' }}>Données du formulaire</h3>
              {selectedFormDef.fields.map((f) => (
                <div key={f.key} className="form-group">
                  <label>{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      rows={2}
                      value={formFieldValues[f.key] ?? ''}
                      onChange={(e) => setFormFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={formFieldValues[f.key] ?? ''}
                      onChange={(e) => setFormFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {pdfTemplates.length === 0 && (
            <p className="error" style={{ fontSize: '0.9rem' }}>
              Aucun modèle PDF configuré (migrations / table <code>report_pdf_templates</code>).
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending || pdfTemplateId === '' || pdfTemplates.length === 0}
          >
            {reportMutation.isPending ? 'Génération…' : 'Générer le rapport'}
          </button>
          {reportMutation.isError && <p className="error">{(reportMutation.error as Error).message}</p>}
        </div>
      )}

      <div className="card">
        <h2>Rapports générés</h2>
        {order.reports?.length ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {order.reports.map((r) => (
              <li
                key={r.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid var(--border, #e2e8f0)',
                }}
              >
                <span>
                  {r.filename}
                  {r.pdf_template?.name ? ` — ${r.pdf_template.name}` : ''}
                  <span className={`report-review-pill report-review-pill--${r.review_status ?? 'draft'}`}>
                    {reviewStatusLabel(r.review_status)}
                  </span>
                  {r.review_status === 'approved' && r.reviewed_by_user?.name ? (
                    <span style={{ marginLeft: '0.35rem', fontSize: '0.8rem', color: '#64748b' }}>
                      par {r.reviewed_by_user.name}
                    </span>
                  ) : null}
                  {r.signed_at ? (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--ok, #15803d)' }}>
                      Signé ({r.signer_name ?? '—'})
                    </span>
                  ) : null}
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => reportsApi.download(r.id)}>
                  Télécharger
                </button>
                {isLab && !r.signed_at && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSignModal(r)}>
                    Signer
                  </button>
                )}
                {isLab && r.review_status === 'draft' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={submitReviewMut.isPending}
                    onClick={() => submitReviewMut.mutate(r.id)}
                  >
                    Soumettre pour validation
                  </button>
                )}
                {isAdmin && r.review_status === 'pending_review' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={approveReviewMut.isPending}
                    onClick={() => approveReviewMut.mutate(r.id)}
                  >
                    Approuver (ingénieur)
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucun rapport généré.</p>
        )}
      </div>

      <div className="card">
        <h2>Lignes et échantillons</h2>
        {order.order_items?.map((item) => (
          <div key={item.id} style={{ marginBottom: '1.5rem' }}>
            <div className="crud-actions" style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, flex: 1 }}>
                {item.test_type?.name} (×{item.quantity})
              </h3>
              {isLab && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openNewSample(item.id)}>
                  + Échantillon
                </button>
              )}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Échantillon</th>
                  <th>Statut</th>
                  {isLab && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {item.samples?.map((s) => (
                  <tr key={s.id}>
                    <td>{s.reference}</td>
                    <td>{s.status}</td>
                    {isLab && (
                      <td>
                        <div className="crud-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditSample(s)}>
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedSample(s.id)
                              const vals: Record<number, string> = {}
                              s.test_results?.forEach((tr) => {
                                if (tr.test_type_param_id) vals[tr.test_type_param_id] = tr.value
                              })
                              setResultValues(vals)
                            }}
                          >
                            Résultats
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm btn-danger-outline"
                              onClick={() => {
                                if (window.confirm('Supprimer cet échantillon ?')) sampleDeleteMut.mutate(s.id)
                              }}
                            >
                              Suppr.
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {selectedSample && params.length > 0 && (
        <div className="card">
          <h3>Saisie des résultats</h3>
          {params.map((p) => (
            <div key={p.id} className="form-group">
              <label>
                {p.name} {p.unit ? `(${p.unit})` : ''}
              </label>
              <input
                value={resultValues[p.id] ?? ''}
                onChange={(e) => setResultValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
              />
            </div>
          ))}
          <button type="button" className="btn btn-primary" onClick={handleSubmitResults} disabled={resultMutation.isPending}>
            Enregistrer
          </button>
          <button type="button" className="btn btn-secondary" style={{ marginLeft: '0.5rem' }} onClick={() => setSelectedSample(null)}>
            Annuler
          </button>
        </div>
      )}

      {signModal && (
        <Modal
          title="Signer le rapport"
          onClose={() => {
            setSignModal(null)
            setSignerName('')
            setSignatureDataUrl(undefined)
          }}
        >
          <p style={{ fontSize: '0.9rem', color: 'var(--muted, #64748b)' }}>
            Le PDF sera régénéré avec le bloc signature. Image optionnelle (fichier léger recommandé, limite API ~60 ko en base64).
          </p>
          <div className="form-group">
            <label>Nom du signataire *</label>
            <input value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Image de signature (optionnel)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                  const s = String(reader.result || '')
                  if (s.length > 60000) {
                    window.alert("Image trop volumineuse après encodage ; choisissez un fichier plus petit ou laissez vide.")
                    return
                  }
                  setSignatureDataUrl(s)
                }
                reader.readAsDataURL(file)
              }}
            />
          </div>
          {signMutation.isError && <p className="error">{(signMutation.error as Error).message}</p>}
          <div className="crud-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={signMutation.isPending || !signerName.trim()}
              onClick={() =>
                signMutation.mutate({
                  reportId: signModal.id,
                  signer_name: signerName.trim(),
                  signature_image_data: signatureDataUrl,
                })
              }
            >
              {signMutation.isPending ? 'Signature…' : 'Valider la signature'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSignModal(null)
                setSignerName('')
                setSignatureDataUrl(undefined)
              }}
            >
              Annuler
            </button>
          </div>
        </Modal>
      )}

      {sampleModal && (
        <Modal title={sampleModal === 'new' ? 'Nouvel échantillon' : "Modifier l'échantillon"} onClose={() => setSampleModal(null)}>
          <form onSubmit={submitSampleForm}>
            <div className="form-group">
              <label>Référence *</label>
              <input
                value={sampleForm.reference}
                onChange={(e) => setSampleForm((f) => ({ ...f, reference: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Statut</label>
              <select
                value={sampleForm.status}
                onChange={(e) => setSampleForm((f) => ({ ...f, status: e.target.value }))}
              >
                {SAMPLE_STATUS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={sampleForm.notes} onChange={(e) => setSampleForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            {!!orderSiteId && siteBoreholes.length > 0 && (
              <>
                <div className="form-group">
                  <label>Forage (optionnel)</label>
                  <select
                    value={sampleForm.borehole_id === '' ? '' : String(sampleForm.borehole_id)}
                    onChange={(e) =>
                      setSampleForm((f) => ({
                        ...f,
                        borehole_id: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                  >
                    <option value="">—</option>
                    {siteBoreholes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code?.trim() || `Forage #${b.id}`} ({b.mission_label})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Profondeur prélèvement — haut (m), optionnel</label>
                  <input
                    type="number"
                    step="any"
                    value={sampleForm.depth_top_m}
                    onChange={(e) => setSampleForm((f) => ({ ...f, depth_top_m: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Profondeur prélèvement — bas (m), optionnel</label>
                  <input
                    type="number"
                    step="any"
                    value={sampleForm.depth_bottom_m}
                    onChange={(e) => setSampleForm((f) => ({ ...f, depth_bottom_m: e.target.value }))}
                  />
                </div>
              </>
            )}
            {(sampleUpdateMut.isError || sampleCreateMut.isError) && (
              <p className="error">{(sampleUpdateMut.error || sampleCreateMut.error)?.message}</p>
            )}
            <div className="crud-actions">
              <button type="submit" className="btn btn-primary" disabled={sampleUpdateMut.isPending || sampleCreateMut.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setSampleModal(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
