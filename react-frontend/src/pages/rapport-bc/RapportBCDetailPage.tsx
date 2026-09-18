import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rapportBCApi, documentPdfTemplatesApi, pdfApi, type RapportBCTask, type RapportBCVersion, type RapportBCSuivi, type DocumentPdfTemplateRow } from '../../api/client'
import { formatAppDate } from '../../lib/appLocale'
import { useAuth } from '../../contexts/AuthContext'
import { hasStaffCapability } from '../../lib/staffAccess'

const STATUT_META: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:    { label: 'Brouillon',    color: '#6b7280', bg: '#f3f4f6' },
  preliminaire: { label: 'Préliminaire', color: '#f59e0b', bg: '#fef3c7' },
  valide:       { label: 'Validé',       color: '#10b981', bg: '#d1fae5' },
  archive:      { label: 'Archivé',      color: '#8b5cf6', bg: '#ede9fe' },
}

function StatutBadge({ statut }: { statut: string }) {
  const meta = STATUT_META[statut] ?? { label: statut, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12, color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  )
}

function TaskStatutBadge({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    todo: '#9ca3af', in_progress: '#3b82f6', paused: '#f59e0b',
    frozen: '#6b7280', done: '#10b981', validated: '#8b5cf6', rejected: '#ef4444',
  }
  return (
    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, color: '#fff', background: map[statut] ?? '#9ca3af', whiteSpace: 'nowrap' }}>
      {statut}
    </span>
  )
}

export default function RapportBCDetailPage() {
  const { id } = useParams<{ id: string }>()
  const rapportId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const canPublish = hasStaffCapability(user, 'rapport_bc.publish')

  const [editing, setEditing] = useState(false)
  const [editTitre, setEditTitre] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStatut, setEditStatut] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [showTaches, setShowTaches] = useState(false)
  const [selectedTacheIds, setSelectedTacheIds] = useState<number[]>([])
  const [newNote, setNewNote] = useState('')
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printTemplateId, setPrintTemplateId] = useState<number | ''>('')
  const [printLoading, setPrintLoading] = useState(false)

  const { data: rapport, isLoading } = useQuery({
    queryKey: ['rapport-bc', rapportId],
    queryFn: () => rapportBCApi.get(rapportId),
    staleTime: 15_000,
    enabled: !isNaN(rapportId),
  })

  const { data: statuts = [] } = useQuery({
    queryKey: ['rapport-bc-statuts'],
    queryFn: () => rapportBCApi.statuts(),
    staleTime: 60_000,
  })

  const { data: pdfTemplatesRes } = useQuery({
    queryKey: ['pdf-templates-rapport-bc'],
    queryFn: () => documentPdfTemplatesApi.list('rapport_bc', true),
    staleTime: 120_000,
  })
  const pdfTemplates: DocumentPdfTemplateRow[] = pdfTemplatesRes?.data ?? []

  const { data: bcTaches = [] } = useQuery({
    queryKey: ['rapport-bc-taches', rapport?.bon_commande_id],
    queryFn: () => rapportBCApi.bcTaches(rapport!.bon_commande_id),
    enabled: showTaches && !!rapport,
    staleTime: 30_000,
  })

  const { data: recap } = useQuery({
    queryKey: ['rapport-bc-recap', rapportId],
    queryFn: () => rapportBCApi.recap(rapportId),
    staleTime: 30_000,
    enabled: !isNaN(rapportId),
  })

  const updateMut = useMutation({
    mutationFn: (body: { titre?: string; statut?: string; notes?: string; tache_ids?: number[] }) =>
      rapportBCApi.update(rapportId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rapport-bc', rapportId] })
      void qc.invalidateQueries({ queryKey: ['rapport-bc-list'] })
      void qc.invalidateQueries({ queryKey: ['rapport-bc-recap', rapportId] })
      setEditing(false)
    },
  })

  const uploadMut = useMutation({
    mutationFn: ({ file, notes }: { file: File; notes?: string }) =>
      rapportBCApi.uploadVersion(rapportId, file, notes),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rapport-bc', rapportId] })
      setUploadNotes('')
      if (fileRef.current) fileRef.current.value = ''
    },
  })

  const deleteVersionMut = useMutation({
    mutationFn: (versionId: number) => rapportBCApi.deleteVersion(rapportId, versionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rapport-bc', rapportId] }),
  })

  const deleteMut = useMutation({
    mutationFn: () => rapportBCApi.delete(rapportId),
    onSuccess: () => navigate('/rapport-bc'),
  })

  const { data: suivis = [], refetch: refetchSuivis } = useQuery({
    queryKey: ['rapport-bc-suivis', rapportId],
    queryFn: () => rapportBCApi.listSuivis(rapportId),
    staleTime: 10_000,
    enabled: !isNaN(rapportId),
  })

  const addSuiviMut = useMutation({
    mutationFn: (message: string) => rapportBCApi.addSuivi(rapportId, message),
    onSuccess: () => { void refetchSuivis(); setNewNote('') },
  })

  const requestValidationMut = useMutation({
    mutationFn: (message?: string) => rapportBCApi.requestValidation(rapportId, { message }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rapport-bc', rapportId] })
      void refetchSuivis()
      setShowValidationModal(false)
      setValidationMessage('')
    },
  })

  const validateMut = useMutation({
    mutationFn: () => rapportBCApi.update(rapportId, { statut: 'valide' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rapport-bc', rapportId] })
      void refetchSuivis()
    },
  })

  const rejectMut = useMutation({
    mutationFn: () => rapportBCApi.update(rapportId, { statut: 'brouillon' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rapport-bc', rapportId] })
      void refetchSuivis()
    },
  })

  if (isLoading) return <div style={{ padding: 32, color: '#6b7280' }}>Chargement…</div>
  if (!rapport) return <div style={{ padding: 32, color: '#ef4444' }}>Rapport introuvable.</div>

  const startEdit = () => {
    setEditTitre(rapport.titre ?? '')
    setEditNotes(rapport.notes ?? '')
    setEditStatut(rapport.statut)
    setEditing(true)
  }

  const saveEdit = () => {
    updateMut.mutate({ titre: editTitre || undefined, notes: editNotes || undefined, statut: editStatut })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMut.mutate({ file, notes: uploadNotes || undefined })
  }

  const saveTaches = () => {
    updateMut.mutate({ tache_ids: selectedTacheIds })
    setShowTaches(false)
  }

  const openTaches = () => {
    setSelectedTacheIds(rapport.tache_ids ?? [])
    setShowTaches(true)
  }

  const PUBLISH_STATUTS = ['valide', 'archive']

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <button onClick={() => navigate('/rapport-bc')} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, marginBottom: 8, fontSize: '0.85rem' }}>
            ← Retour aux rapports
          </button>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{rapport.numero}</h1>
          {rapport.titre && <div style={{ fontSize: '1rem', color: '#374151', marginTop: 4 }}>{rapport.titre}</div>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <StatutBadge statut={rapport.statut} />
            {rapport.bon_commande && (
              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>BC : {rapport.bon_commande.numero}</span>
            )}
            {rapport.created_by && (
              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>par {rapport.created_by.name}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Demander validation (brouillon → preliminaire) */}
          {rapport.statut === 'brouillon' && (
            <button
              onClick={() => setShowValidationModal(true)}
              style={{ padding: '7px 14px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, cursor: 'pointer', color: '#b45309', fontWeight: 600 }}
            >
              Demander validation
            </button>
          )}
          {/* Valider / Rejeter (lab_admin, preliminaire) */}
          {rapport.statut === 'preliminaire' && canPublish && (
            <>
              <button
                onClick={() => { if (window.confirm('Valider ce rapport ?')) validateMut.mutate() }}
                disabled={validateMut.isPending}
                style={{ padding: '7px 14px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 6, cursor: 'pointer', color: '#065f46', fontWeight: 600 }}
              >
                ✓ Valider
              </button>
              <button
                onClick={() => { if (window.confirm('Rejeter ce rapport (repassera en brouillon) ?')) rejectMut.mutate() }}
                disabled={rejectMut.isPending}
                style={{ padding: '7px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}
              >
                ✕ Rejeter
              </button>
            </>
          )}
          <button
            onClick={() => { setPrintTemplateId(pdfTemplates.find((t) => t.is_default)?.id ?? pdfTemplates[0]?.id ?? ''); setShowPrintModal(true) }}
            style={{ padding: '7px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            🖨 Imprimer PDF
          </button>
          <button onClick={startEdit} style={{ padding: '7px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
            Modifier
          </button>
          <button
            onClick={() => { if (window.confirm('Supprimer ce rapport ?')) deleteMut.mutate() }}
            style={{ padding: '7px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}
          >
            Supprimer
          </button>
        </div>
      </div>

      {/* Edition inline */}
      {editing && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Modifier le rapport</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Titre</label>
              <input type="text" value={editTitre} onChange={(e) => setEditTitre(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Statut</label>
              <select value={editStatut} onChange={(e) => setEditStatut(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
              >
                {statuts.map((s) => {
                  const isPublishStatut = PUBLISH_STATUTS.includes(s)
                  if (isPublishStatut && !canPublish) return null
                  return <option key={s} value={s}>{STATUT_META[s]?.label ?? s}</option>
                })}
              </select>
              {!canPublish && <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 4 }}>Les statuts Validé et Archivé sont réservés aux administrateurs.</div>}
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Notes</label>
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveEdit} disabled={updateMut.isPending}
              style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              {updateMut.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
            <button onClick={() => setEditing(false)} style={{ padding: '7px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Tâches associées */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>Tâches associées ({recap?.taches?.length ?? 0})</div>
            <button onClick={openTaches} style={{ fontSize: '0.78rem', padding: '4px 10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>
              Gérer
            </button>
          </div>
          {recap && recap.taches.length === 0 && <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Aucune tâche sélectionnée.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recap?.taches.map((t: RapportBCTask) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.libelle ?? `Tâche #${t.id}`}</span>
                <TaskStatutBadge statut={t.statut} />
              </div>
            ))}
          </div>
          {recap && (
            <div style={{ marginTop: 12, fontSize: '0.78rem', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
              {Object.entries(recap.bc_statuts).map(([s, count]) => (
                <span key={s} style={{ marginRight: 10 }}>{s}: <b>{String(count)}</b></span>
              ))}
            </div>
          )}
        </div>

        {/* Versions */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Versions ({rapport.versions?.length ?? 0})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {(rapport.versions ?? []).map((v: RapportBCVersion) => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>v{v.version_number}{v.original_filename ? ` — ${v.original_filename}` : ''}</div>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                    {formatAppDate(v.created_at)}
                    {v.uploaded_by ? ` par ${v.uploaded_by.name}` : ''}
                    {v.file_size ? ` · ${Math.round(v.file_size / 1024)} Ko` : ''}
                  </div>
                  {v.upload_notes && <div style={{ fontSize: '0.72rem', color: '#6b7280', fontStyle: 'italic' }}>{v.upload_notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {v.has_file && (
                    <a
                      href={rapportBCApi.downloadVersionUrl(rapportId, v.id)}
                      download={v.original_filename ?? undefined}
                      style={{ fontSize: '0.75rem', padding: '3px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, color: '#2563eb', textDecoration: 'none' }}
                    >
                      ↓
                    </a>
                  )}
                  {canPublish && (
                    <button
                      onClick={() => { if (window.confirm('Supprimer cette version ?')) deleteVersionMut.mutate(v.id) }}
                      style={{ fontSize: '0.75rem', padding: '3px 8px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#dc2626', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Upload */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>Uploader une version</div>
            <input
              type="text"
              placeholder="Note (optionnel)"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, marginBottom: 8, boxSizing: 'border-box', fontSize: '0.85rem' }}
            />
            <input ref={fileRef} type="file" onChange={handleFileChange} style={{ display: 'none' }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadMut.isPending}
              style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
            >
              {uploadMut.isPending ? 'Envoi…' : '📎 Choisir un fichier'}
            </button>
          </div>
        </div>
      </div>

      {/* Section Activité / Suivis */}
      <div style={{ marginTop: 24, border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: '0.95rem' }}>Activité</div>
        {/* Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {suivis.length === 0 && (
            <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Aucune activité enregistrée.</div>
          )}
          {(suivis as RapportBCSuivi[]).slice().reverse().map((s) => (
            <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
                background: s.type === 'validation' ? '#fef3c7' : s.type === 'statut_change' ? '#ede9fe' : s.type === 'upload' ? '#e0f2fe' : '#f3f4f6',
                color: s.type === 'validation' ? '#b45309' : s.type === 'statut_change' ? '#7c3aed' : s.type === 'upload' ? '#0369a1' : '#6b7280',
              }}>
                {s.type === 'validation' ? '⟳' : s.type === 'statut_change' ? '↕' : s.type === 'upload' ? '↑' : '●'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', color: '#111827' }}>{s.message}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
                  {s.user?.name ?? 'Système'} · {formatAppDate(s.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Ajouter une note */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6, color: '#374151' }}>Ajouter une note</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Saisir une note…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newNote.trim()) addSuiviMut.mutate(newNote.trim()) }}
              style={{ flex: 1, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }}
            />
            <button
              onClick={() => { if (newNote.trim()) addSuiviMut.mutate(newNote.trim()) }}
              disabled={!newNote.trim() || addSuiviMut.isPending}
              style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
            >
              {addSuiviMut.isPending ? '…' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal impression PDF */}
      {showPrintModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 480, boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 700 }}>Générer le PDF du rapport</h2>

            {pdfTemplates.length === 0 ? (
              <div style={{ padding: '16px 0', color: '#6b7280', fontSize: '0.88rem' }}>
                <p>Aucun modèle PDF actif pour les rapports de mission.</p>
                <p style={{ marginTop: 8 }}>Créez-en un dans <strong>Configuration → Modèles PDF</strong> avec le type <code>rapport_bc</code>.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Modèle PDF</label>
                  <select
                    value={printTemplateId}
                    onChange={(e) => setPrintTemplateId(e.target.value ? Number(e.target.value) : '')}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.9rem' }}
                  >
                    {pdfTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (défaut)' : ''}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 5 }}>
                    Le PDF inclut : infos du rapport, client, dossier, tâches associées, liste des fichiers déposés et activité.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {/* Aperçu en ligne */}
                  <button
                    disabled={printLoading || !printTemplateId}
                    onClick={async () => {
                      setPrintLoading(true)
                      try {
                        const { url } = await pdfApi.getPreviewLink('rapport_bc', rapportId, printTemplateId ? Number(printTemplateId) : undefined)
                        window.open(url, '_blank')
                      } finally { setPrintLoading(false) }
                    }}
                    style={{ padding: '8px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, color: '#2563eb', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}
                  >
                    {printLoading ? '…' : '👁 Aperçu'}
                  </button>
                  {/* Télécharger */}
                  <button
                    disabled={printLoading || !printTemplateId}
                    onClick={async () => {
                      setPrintLoading(true)
                      try {
                        const blob = await pdfApi.fetchGenerate('rapport_bc', rapportId, printTemplateId ? Number(printTemplateId) : undefined)
                        pdfApi.downloadBlob(blob, `rapport-${rapport.numero}.pdf`)
                      } finally { setPrintLoading(false) }
                    }}
                    style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                  >
                    {printLoading ? 'Génération…' : '⬇ Télécharger PDF'}
                  </button>
                </div>
              </>
            )}

            <div style={{ marginTop: 18, textAlign: 'right' }}>
              <button
                onClick={() => setShowPrintModal(false)}
                style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal demande de validation */}
      {showValidationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 420, boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700 }}>Demander la validation</h2>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 14px' }}>
              Le rapport passera en statut <strong>Préliminaire</strong> et sera soumis à la validation d'un administrateur.
            </p>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Message (optionnel)</label>
              <textarea
                value={validationMessage}
                onChange={(e) => setValidationMessage(e.target.value)}
                placeholder="Commentaire pour le validateur…"
                rows={3}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowValidationModal(false); setValidationMessage('') }}
                style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}
              >
                Annuler
              </button>
              <button
                onClick={() => requestValidationMut.mutate(validationMessage || undefined)}
                disabled={requestValidationMut.isPending}
                style={{ padding: '8px 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700 }}
              >
                {requestValidationMut.isPending ? 'Envoi…' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sélection tâches */}
      {showTaches && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Sélectionner les tâches</div>
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: 400 }}>
              {bcTaches.length === 0 && <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Aucune tâche terminée trouvée pour ce BC.</div>}
              {bcTaches.map((t: RapportBCTask) => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedTacheIds.includes(t.id)}
                    onChange={(e) => {
                      setSelectedTacheIds(prev =>
                        e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id)
                      )
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{t.libelle ?? `Tâche #${t.id}`}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                      {t.assigned_user?.name ?? '—'}
                      {t.completed_at ? ` · terminé ${formatAppDate(t.completed_at)}` : ''}
                    </div>
                  </div>
                  <TaskStatutBadge statut={t.statut} />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveTaches} disabled={updateMut.isPending}
                style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                {updateMut.isPending ? 'Sauvegarde…' : 'Valider'}
              </button>
              <button onClick={() => setShowTaches(false)} style={{ padding: '7px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
