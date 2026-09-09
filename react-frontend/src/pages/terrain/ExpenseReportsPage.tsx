/**
 * ExpenseReportsPage — Notes de frais (NDF)
 */
import { useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  adminUsersApi,
  expenseReportsApi,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHOD_LABELS,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_STATUT_LABELS,
  EXPENSE_STATUT_OPTIONS,
  EXPENSE_TRANSPORT_TYPES,
  isExpenseDeplacementLine,
  type ExpenseLine,
  type ExpensePaymentMethod,
  type ExpenseReport,
  type ExpenseCategory,
  type ExpenseReportStatut,
  type ExpenseTransportType,
} from '../../api/client'
import ListTableToolbar, { PaginationBar } from '../../components/ListTableToolbar'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility'
import { formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'
import './expense-reports.css'

const STATUT_COLORS: Record<ExpenseReportStatut, string> = {
  brouillon: '#6b7280',
  soumis:    '#3b82f6',
  valide:    '#10b981',
  rembourse: '#8b5cf6',
  rejete:    '#ef4444',
}

function computeKmAmount(distanceKm: number, tauxKm: number): number {
  return Math.round(Math.max(0, distanceKm) * Math.max(0, tauxKm) * 2 * 100) / 100
}

function paymentLabel(method?: ExpensePaymentMethod | null): string {
  if (!method) return '—'
  return EXPENSE_PAYMENT_METHOD_LABELS[method] ?? method
}

function reportTotal(report: ExpenseReport): number {
  if (report.total != null) return Number(report.total)
  return (report.lines ?? []).reduce((s, l) => s + Number(l.amount), 0)
}

function lineDetailText(line: ExpenseLine): string {
  const parts: string[] = []
  if (line.description) parts.push(line.description)
  if (isExpenseDeplacementLine(line)) {
    const trajet = [line.lieu_depart, line.lieu_arrivee].filter(Boolean).join(' → ')
    if (trajet) parts.push(trajet)
    if (line.distance_km != null) {
      parts.push(`${line.distance_km} km × ${line.taux_km ?? 0.401} (A/R)`)
    }
  }
  return parts.join(' · ') || '—'
}

function LinesValidationBadge({ report }: { report: ExpenseReport }) {
  const total = report.lines_count ?? report.lines?.length ?? 0
  const validated = report.lines_validated_count
    ?? (report.lines ?? []).filter((l) => l.is_validated).length

  if (total === 0) {
    return <span className="ndf-lines-badge ndf-lines-badge--empty">○ 0 ligne</span>
  }
  const allOk = validated >= total
  const cls = allOk ? 'ndf-lines-badge--ok' : validated > 0 ? 'ndf-lines-badge--partial' : 'ndf-lines-badge--empty'
  return (
    <span className={`ndf-lines-badge ${cls}`} title={`${validated}/${total} lignes validées`}>
      {allOk ? '✓' : validated > 0 ? '◐' : '○'} {validated}/{total}
    </span>
  )
}

function ReportContextRow({ report }: { report: ExpenseReport }) {
  const om = report.ordre_mission
  const dossier = om?.dossier
  const client = om?.client
  const site = om?.site

  return (
    <div className="ndf-context-row">
      {om ? (
        <span className="ndf-context-chip">
          <span className="ndf-context-chip__label">OM</span>
          <strong>{om.unique_number ?? om.numero}</strong>
        </span>
      ) : null}
      {dossier ? (
        <span className="ndf-context-chip">
          <span className="ndf-context-chip__label">Dossier</span>
          <strong>{dossier.reference ?? dossier.titre ?? `#${dossier.id}`}</strong>
        </span>
      ) : null}
      {client ? (
        <span className="ndf-context-chip">
          <span className="ndf-context-chip__label">Client</span>
          <strong>{client.name}</strong>
        </span>
      ) : null}
      {site ? (
        <span className="ndf-context-chip">
          <span className="ndf-context-chip__label">Chantier</span>
          <strong>{site.nom ?? site.name ?? `#${site.id}`}</strong>
        </span>
      ) : null}
    </div>
  )
}

function ReportContextCell({ report }: { report: ExpenseReport }) {
  const om = report.ordre_mission
  const parts = [
    om ? (om.unique_number ?? om.numero) : null,
    om?.dossier?.reference ?? om?.dossier?.titre ?? null,
    om?.client?.name ?? null,
    om?.site?.nom ?? om?.site?.name ?? null,
  ].filter(Boolean)

  return (
    <div className="ndf-context-cell">
      {parts.map((p, i) => (
        <span key={`${p}-${i}`}>
          {i > 0 ? <span className="ndf-context-cell__sep">·</span> : null}
          {p}
        </span>
      ))}
      {parts.length === 0 ? '—' : null}
    </div>
  )
}

function StatutSelect({
  value,
  onChange,
  disabled,
}: {
  value: ExpenseReportStatut
  onChange: (v: ExpenseReportStatut) => void
  disabled?: boolean
}) {
  return (
    <select
      className="ndf-statut-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ExpenseReportStatut)}
      style={{ color: '#fff', background: STATUT_COLORS[value], borderColor: STATUT_COLORS[value] }}
    >
      {EXPENSE_STATUT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value} style={{ color: '#111', background: '#fff' }}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function EmailModal({
  report,
  onClose,
}: {
  report: ExpenseReport
  onClose: () => void
}) {
  const { user } = useAuth()
  const [to, setTo] = useState(user?.email ?? '')
  const [subject, setSubject] = useState(`Note de frais ${report.unique_number}`)
  const [body, setBody] = useState('')

  const sendMut = useMutation({
    mutationFn: () => expenseReportsApi.sendEmail(report.id, {
      to,
      subject,
      body: body.trim() || undefined,
    }),
    onSuccess: onClose,
  })

  return (
    <div className="ndf-email-modal-backdrop ndf-no-print" onClick={onClose} role="presentation">
      <div className="ndf-email-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Envoyer la NDF par e-mail</h3>
        <label>
          Destinataire
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
        </label>
        <label>
          Objet
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </label>
        <label>
          Message (optionnel — récap auto si vide)
          <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        {sendMut.isError ? (
          <p className="error" style={{ fontSize: '0.85rem' }}>{(sendMut.error as Error).message}</p>
        ) : null}
        <div className="crud-actions">
          <button type="button" className="btn btn-primary btn-sm" disabled={sendMut.isPending || !to} onClick={() => sendMut.mutate()}>
            {sendMut.isPending ? 'Envoi…' : 'Envoyer'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

function LineRow({
  line,
  reportId,
  canEdit,
  canValidate,
}: {
  line: ExpenseLine
  reportId: number
  canEdit: boolean
  canValidate: boolean
}) {
  const [editing, setEditing] = useState(false)
  const qc = useQueryClient()

  const deleteMut = useMutation({
    mutationFn: () => expenseReportsApi.deleteLine(reportId, line.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['expense-report', reportId] }),
  })

  const validateMut = useMutation({
    mutationFn: (is_validated: boolean) =>
      expenseReportsApi.updateLine(reportId, line.id, { is_validated }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['expense-report', reportId] }),
  })

  const downloadMut = useMutation({
    mutationFn: () =>
      expenseReportsApi.downloadLineReceipt(
        reportId,
        line.id,
        line.receipt_filename ?? `justificatif-ligne-${line.id}`,
      ),
  })

  const fromOm = isExpenseDeplacementLine(line)

  if (editing) {
    return (
      <LineForm
        initial={line}
        reportId={reportId}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    <tr className={line.is_validated ? 'ndf-line-row--validated' : ''}>
      <td className="ndf-no-print" style={{ textAlign: 'center' }}>
        {canValidate ? (
          <input
            type="checkbox"
            className="ndf-line-valid"
            checked={!!line.is_validated}
            disabled={validateMut.isPending}
            onChange={(e) => validateMut.mutate(e.target.checked)}
            title={line.is_validated ? 'Ligne validée' : 'À valider'}
          />
        ) : (
          <span className={`ndf-line-valid-icon ${line.is_validated ? 'ndf-line-valid-icon--yes' : 'ndf-line-valid-icon--no'}`}>
            {line.is_validated ? '✓' : '○'}
          </span>
        )}
      </td>
      <td>{line.date}</td>
      <td>
        <span className="badge">{line.category}</span>
        {fromOm ? (
          <span className="badge" style={{ marginLeft: '0.35rem', background: '#dbeafe', color: '#1d4ed8' }}>OM</span>
        ) : null}
      </td>
      <td className="ndf-total-cell" style={{ fontSize: '0.9rem' }}>{formatMoney(Number(line.amount))}</td>
      <td>{paymentLabel(line.payment_method)}</td>
      <td className="ndf-desc-cell">{lineDetailText(line)}</td>
      <td>
        {line.receipt_path ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm ndf-no-print"
            disabled={downloadMut.isPending}
            onClick={() => downloadMut.mutate()}
          >
            📎 {line.receipt_filename ? line.receipt_filename.slice(0, 16) : 'PJ'}
          </button>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td>{line.user?.name || `#${line.user_id}`}</td>
      {canEdit && (
        <td className="ndf-no-print">
          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>✏️</button>
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-danger-outline"
              disabled={deleteMut.isPending}
              onClick={() => { if (window.confirm('Supprimer cette ligne ?')) deleteMut.mutate() }}
            >✕</button>
          </div>
        </td>
      )}
    </tr>
  )
}

function LineForm({
  initial,
  reportId,
  onDone,
}: {
  initial?: Partial<ExpenseLine>
  reportId: number
  onDone: () => void
}) {
  const { user: authUser } = useAuth()
  const qc = useQueryClient()
  const isEdit = !!initial?.id
  const isVoyage = (initial?.category ?? 'Repas') === 'Voyage' || initial?.distance_km != null

  const { data: usersPage } = useQuery({
    queryKey: ['admin-users', 'ndf-line'],
    queryFn: () => adminUsersApi.list({ page: 1 }),
    staleTime: 120_000,
  })
  const users = usersPage?.data ?? []

  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    user_id:        initial?.user_id ?? authUser?.id ?? 0,
    category:       (initial?.category ?? 'Repas') as ExpenseCategory,
    amount:         initial?.amount ?? 0,
    payment_method: (initial?.payment_method ?? '') as ExpensePaymentMethod | '',
    date:           initial?.date ?? new Date().toISOString().slice(0, 10),
    description:    initial?.description ?? '',
    lieu_depart:    initial?.lieu_depart ?? '',
    lieu_arrivee:   initial?.lieu_arrivee ?? '',
    distance_km:    initial?.distance_km ?? '',
    taux_km:        initial?.taux_km ?? 0.401,
    type_transport: (initial?.type_transport ?? 'voiture') as ExpenseTransportType,
    useKmCalc:      isVoyage && initial?.distance_km != null,
  })

  const showKmFields = form.category === 'Voyage' && (
    form.useKmCalc ||
    isExpenseDeplacementLine({ category: initial?.category ?? 'Voyage', distance_km: initial?.distance_km })
  )

  const computedAmount = showKmFields && form.distance_km !== ''
    ? computeKmAmount(Number(form.distance_km), Number(form.taux_km))
    : form.amount

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: form.user_id,
        category: form.category,
        amount: showKmFields ? computedAmount : form.amount,
        payment_method: form.payment_method || undefined,
        date: form.date,
        description: form.description || undefined,
        ...(showKmFields
          ? {
              lieu_depart: form.lieu_depart || undefined,
              lieu_arrivee: form.lieu_arrivee || undefined,
              distance_km: Number(form.distance_km) || 0,
              taux_km: Number(form.taux_km) || 0.401,
              type_transport: form.type_transport,
            }
          : {
              lieu_depart: undefined,
              lieu_arrivee: undefined,
              distance_km: undefined,
              taux_km: undefined,
              type_transport: undefined,
            }),
      }

      const line = isEdit
        ? await expenseReportsApi.updateLine(reportId, initial!.id!, payload)
        : await expenseReportsApi.addLine(reportId, payload)

      if (receiptFile) {
        await expenseReportsApi.uploadLineReceipt(reportId, line.id, receiptFile)
      }

      return line
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expense-report', reportId] })
      onDone()
    },
  })

  const colSpan = 9

  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="ndf-line-form">
          <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <label>
              Date *
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
            <label>
              Catégorie *
              <select
                value={form.category}
                onChange={(e) => {
                  const category = e.target.value as ExpenseCategory
                  setForm({ ...form, category, useKmCalc: category === 'Voyage' ? form.useKmCalc : false })
                }}
              >
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Personnel *
              <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: Number(e.target.value) })}>
                <option value={0}>— sélectionner —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label>
              Mode de paiement
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value as ExpensePaymentMethod | '' })}
              >
                <option value="">— non renseigné —</option>
                {EXPENSE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{EXPENSE_PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </label>
            {!showKmFields ? (
              <label>
                Montant TTC ({MONEY_UNIT_LABEL}) *
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  required
                />
              </label>
            ) : (
              <label>
                Montant calculé ({MONEY_UNIT_LABEL})
                <input type="text" value={formatMoney(computedAmount)} readOnly disabled />
              </label>
            )}
            <label style={{ gridColumn: 'span 3' }}>
              Description
              <textarea
                className="ndf-desc-input"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Détail de la dépense, contexte, commentaires…"
              />
            </label>
            <label>
              Justificatif
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
              {initial?.receipt_filename && !receiptFile ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Actuel : {initial.receipt_filename}</span>
              ) : null}
            </label>
          </div>

          {form.category === 'Voyage' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={form.useKmCalc} onChange={(e) => setForm({ ...form, useKmCalc: e.target.checked })} />
              Déplacement kilométrique (calcul auto A/R)
            </label>
          )}

          {showKmFields && (
            <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '0.5rem' }}>
              <label>Départ<input value={form.lieu_depart} onChange={(e) => setForm({ ...form, lieu_depart: e.target.value })} /></label>
              <label>Arrivée<input value={form.lieu_arrivee} onChange={(e) => setForm({ ...form, lieu_arrivee: e.target.value })} /></label>
              <label>
                Distance (km) *
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.distance_km}
                  onChange={(e) => setForm({ ...form, distance_km: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </label>
              <label>
                Taux km
                <input type="number" step="0.001" min="0" value={form.taux_km} onChange={(e) => setForm({ ...form, taux_km: Number(e.target.value) })} />
              </label>
              <label>
                Transport
                <select value={form.type_transport} onChange={(e) => setForm({ ...form, type_transport: e.target.value as ExpenseTransportType })}>
                  {EXPENSE_TRANSPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="crud-actions" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={mut.isPending || !form.user_id} onClick={() => mut.mutate()}>
              {mut.isPending ? '…' : isEdit ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onDone}>Annuler</button>
            {mut.isError ? <span className="error" style={{ fontSize: '0.82rem' }}>{(mut.error as Error).message}</span> : null}
          </div>
        </div>
      </td>
    </tr>
  )
}

function PaymentSummary({ lines }: { lines: ExpenseLine[] }) {
  const byMethod = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of lines) {
      const key = line.payment_method ? EXPENSE_PAYMENT_METHOD_LABELS[line.payment_method] : 'Non renseigné'
      map.set(key, (map.get(key) ?? 0) + Number(line.amount))
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [lines])

  if (byMethod.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {byMethod.map(([label, total]) => (
        <span key={label} className="badge" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {label} : <strong>{formatMoney(total)}</strong>
        </span>
      ))}
    </div>
  )
}

function TotalHero({ total, advance }: { total: number; advance: number }) {
  const net = Math.max(0, total - advance)
  const hasAdvance = advance > 0

  return (
    <div className="ndf-hero-total">
      <div className="ndf-hero-total__card ndf-hero-total__card--primary">
        <span className="ndf-hero-total__label">Total TTC</span>
        <span className="ndf-hero-total__value">{formatMoney(total)}</span>
      </div>
      <div className="ndf-hero-total__card">
        <span className="ndf-hero-total__label">Acompte versé</span>
        <span className="ndf-hero-total__value" style={{ color: hasAdvance ? '#059669' : 'var(--color-text-muted)' }}>
          {hasAdvance ? formatMoney(advance) : 'Aucun'}
        </span>
      </div>
      <div className="ndf-hero-total__card">
        <span className="ndf-hero-total__label">Net à rembourser</span>
        <span className="ndf-hero-total__value" style={{ color: '#1d4ed8' }}>
          {formatMoney(hasAdvance ? net : total)}
        </span>
      </div>
    </div>
  )
}

function ReportDetail({ reportId, onBack }: { reportId: number; onBack: () => void }) {
  const [addingLine, setAddingLine] = useState(false)
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [privateNotesDraft, setPrivateNotesDraft] = useState<string | null>(null)
  const [advanceDraft, setAdvanceDraft] = useState<number | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const qc = useQueryClient()

  const { data: report, isLoading } = useQuery({
    queryKey: ['expense-report', reportId],
    queryFn: () => expenseReportsApi.get(reportId),
  })

  const notesValue = notesDraft ?? report?.notes ?? ''
  const privateNotesValue = privateNotesDraft ?? report?.private_notes ?? ''
  const advanceValue = advanceDraft ?? report?.advance_amount ?? 0

  const updateMut = useMutation({
    mutationFn: (body: Partial<Pick<ExpenseReport, 'statut' | 'notes' | 'private_notes' | 'advance_amount'>>) =>
      expenseReportsApi.update(reportId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expense-report', reportId] })
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
      setNotesDraft(null)
      setPrivateNotesDraft(null)
      setAdvanceDraft(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => expenseReportsApi.delete(reportId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
      onBack()
    },
  })

  if (isLoading || !report) {
    return (
      <ModuleEntityShell
        breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Notes de frais', to: '/notes-de-frais' }, { label: '…' }]}
        moduleBarLabel="Terrain"
        title="Note de frais"
        subtitle="Chargement…"
      >
        <p className="text-muted">Chargement…</p>
      </ModuleEntityShell>
    )
  }

  const canEdit = report.statut === 'brouillon'
  const canValidate = report.statut !== 'brouillon'
  const lines = report.lines ?? []
  const total = reportTotal(report)
  const colCount = canEdit ? 9 : 8

  const notesDirty = notesDraft !== null && notesDraft !== (report.notes ?? '')
  const privateDirty = privateNotesDraft !== null && privateNotesDraft !== (report.private_notes ?? '')
  const advanceDirty = advanceDraft !== null && advanceDraft !== (report.advance_amount ?? 0)

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Notes de frais', to: '/notes-de-frais' },
        { label: report.unique_number },
      ]}
      moduleBarLabel="Terrain — Notes de frais"
      title={report.unique_number}
      subtitle={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <StatutSelect
            value={report.statut}
            onChange={(statut) => updateMut.mutate({ statut })}
            disabled={updateMut.isPending}
          />
        </span>
      }
      actions={
        <div className="ndf-toolbar-actions ndf-no-print">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>← Liste</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨 Imprimer</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEmailOpen(true)}>✉ Envoyer par mail</button>
        </div>
      }
    >
      <div className="ndf-page">
        <div className="ndf-print-header">
          <h1 style={{ margin: 0 }}>Note de frais {report.unique_number}</h1>
          <p style={{ margin: '0.25rem 0 0' }}>Statut : {EXPENSE_STATUT_LABELS[report.statut]}</p>
        </div>

        <ReportContextRow report={report} />
        <TotalHero total={total} advance={Number(advanceValue)} />

        <div className="ndf-notes-grid">
          <label>
            Notes (partagées / comptabilité)
            <textarea
              value={notesValue}
              onChange={(e) => setNotesDraft(e.target.value)}
              readOnly={!canEdit && !canValidate}
              rows={4}
              placeholder="Commentaires visibles pour le traitement comptable…"
            />
          </label>
          <label>
            Note personnelle / privée
            <textarea
              value={privateNotesValue}
              onChange={(e) => setPrivateNotesDraft(e.target.value)}
              readOnly={!canEdit}
              rows={4}
              placeholder="Note privée — visible uniquement en interne…"
            />
          </label>
          <label>
            Acompte déjà versé ({MONEY_UNIT_LABEL})
            <input
              type="number"
              step="0.01"
              min="0"
              value={advanceValue}
              onChange={(e) => setAdvanceDraft(Number(e.target.value))}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </label>
        </div>

        {(canEdit || canValidate) && (notesDirty || privateDirty || advanceDirty) && (
          <button
            type="button"
            className="btn btn-secondary btn-sm ndf-no-print"
            style={{ marginBottom: '1rem' }}
            disabled={updateMut.isPending}
            onClick={() => updateMut.mutate({
              notes: notesValue,
              private_notes: privateNotesValue,
              advance_amount: advanceValue,
            })}
          >
            Enregistrer les notes
          </button>
        )}

        <PaymentSummary lines={lines} />

        <div className="ndf-toolbar-actions ndf-no-print">
          {report.statut === 'brouillon' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={updateMut.isPending || lines.length === 0}
              onClick={() => updateMut.mutate({ statut: 'soumis' })}
            >
              Soumettre
            </button>
          )}
          {report.statut === 'soumis' && (
            <>
              <button type="button" className="btn btn-primary btn-sm" disabled={updateMut.isPending} onClick={() => updateMut.mutate({ statut: 'valide' })}>✓ Valider</button>
              <button type="button" className="btn btn-secondary btn-sm btn-danger-outline" disabled={updateMut.isPending} onClick={() => updateMut.mutate({ statut: 'rejete' })}>✗ Rejeter</button>
            </>
          )}
          {report.statut === 'valide' && (
            <button type="button" className="btn btn-primary btn-sm" disabled={updateMut.isPending} onClick={() => updateMut.mutate({ statut: 'rembourse' })}>Marquer remboursé</button>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-danger-outline"
              style={{ marginLeft: 'auto' }}
              disabled={deleteMut.isPending}
              onClick={() => { if (window.confirm('Supprimer cette note de frais ?')) deleteMut.mutate() }}
            >
              Supprimer
            </button>
          )}
        </div>

        <div className="table-wrap">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th title="Ligne validée">✓</th>
                <th>Date</th>
                <th>Catégorie</th>
                <th>Montant</th>
                <th>Paiement</th>
                <th>Description</th>
                <th>Justificatif</th>
                <th>Personnel</th>
                {canEdit && <th className="ndf-no-print"></th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <LineRow key={l.id} line={l} reportId={reportId} canEdit={canEdit} canValidate={canValidate} />
              ))}
              {addingLine && <LineForm reportId={reportId} onDone={() => setAddingLine(false)} />}
              {lines.length === 0 && !addingLine && (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem' }}>
                    Aucune ligne — ajoutez des dépenses ci-dessous
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canEdit && !addingLine && (
          <button type="button" className="btn btn-secondary btn-sm ndf-no-print" style={{ marginTop: '0.75rem' }} onClick={() => setAddingLine(true)}>
            + Ajouter une ligne
          </button>
        )}
      </div>

      {emailOpen ? <EmailModal report={report} onClose={() => setEmailOpen(false)} /> : null}
    </ModuleEntityShell>
  )
}

export default function ExpenseReportsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const reportId = id ? Number(id) : null

  const [creating, setCreating] = useState(false)
  const [selectedOM, setSelectedOM] = useState<number | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const qc = useQueryClient()

  const { visible, toggle } = usePersistedColumnVisibility('expense-reports', {
    number: true,
    context: true,
    lines: true,
    statut: true,
    total: true,
    date: true,
    actions: true,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['expense-reports', debouncedSearch, filterStatut, page],
    queryFn: () =>
      expenseReportsApi.list({
        search: debouncedSearch.trim() || undefined,
        statut: filterStatut || undefined,
        page,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const { data: eligibleOMs = [] } = useQuery({
    queryKey: ['expense-eligible-oms'],
    queryFn: () => expenseReportsApi.eligibleOMs(),
    enabled: creating,
    staleTime: 60_000,
  })

  const createMut = useMutation({
    mutationFn: () => expenseReportsApi.create({ ordre_mission_id: Number(selectedOM) }),
    onSuccess: (report) => {
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
      setCreating(false)
      setSelectedOM('')
      navigate(`/notes-de-frais/${report.id}`)
    },
  })

  const statusMut = useMutation({
    mutationFn: ({ id: rid, statut }: { id: number; statut: ExpenseReportStatut }) =>
      expenseReportsApi.update(rid, { statut }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['expense-reports'] }),
  })

  if (reportId && !Number.isNaN(reportId)) {
    return <ReportDetail reportId={reportId} onBack={() => navigate('/notes-de-frais')} />
  }

  const list = data?.data ?? []
  const hasActiveFilters = searchInput.trim() !== '' || filterStatut !== ''

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Notes de frais' }]}
      moduleBarLabel="Terrain — Notes de frais"
      title="Notes de frais"
      subtitle="Suivi des dépenses terrain, validation des lignes et remboursements."
      actions={
        <div className="ndf-toolbar-actions ndf-no-print">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨 Imprimer</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Nouvelle NDF</button>
        </div>
      }
    >
      <div className="ndf-page">
        <ListTableToolbar
          searchValue={searchInput}
          onSearchChange={(v) => { setSearchInput(v); setPage(1) }}
          searchPlaceholder="N° NDF, OM, client, dossier, chantier…"
          statusValue={filterStatut}
          onStatusChange={(v) => { setFilterStatut(v); setPage(1) }}
          statusOptions={EXPENSE_STATUT_OPTIONS}
          columns={[
            { id: 'number', label: 'N° NDF' },
            { id: 'context', label: 'Contexte' },
            { id: 'lines', label: 'Lignes validées' },
            { id: 'statut', label: 'Statut' },
            { id: 'total', label: 'Total TTC' },
            { id: 'date', label: 'Créé le' },
            { id: 'actions', label: 'Actions' },
          ]}
          visibleColumns={visible}
          onToggleColumn={toggle}
          footer={
            hasActiveFilters ? (
              <>
                <span className="list-table-toolbar__footer-label">Filtres actifs</span>
                {searchInput.trim() !== '' && (
                  <span className="list-table-toolbar__chip">
                    <span className="list-table-toolbar__chip-text">Recherche : « {searchInput.trim()} »</span>
                    <button type="button" className="list-table-toolbar__chip-remove" onClick={() => setSearchInput('')}>×</button>
                  </span>
                )}
                {filterStatut !== '' && (
                  <span className="list-table-toolbar__chip">
                    <span className="list-table-toolbar__chip-text">Statut : {EXPENSE_STATUT_LABELS[filterStatut as ExpenseReportStatut] ?? filterStatut}</span>
                    <button type="button" className="list-table-toolbar__chip-remove" onClick={() => setFilterStatut('')}>×</button>
                  </span>
                )}
              </>
            ) : undefined
          }
        />

        {creating && (
          <div className="card ndf-no-print" style={{ padding: '0.85rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: 220 }}>
              <span className="filter-label">Ordre de mission *</span>
              <select
                value={selectedOM}
                onChange={(e) => setSelectedOM(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                <option value="">— sélectionner —</option>
                {eligibleOMs.map((om) => (
                  <option key={om.id} value={om.id}>
                    {om.unique_number ?? om.numero} — {om.type} — {(om as { client?: { name: string } }).client?.name ?? ''}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-primary btn-sm" disabled={!selectedOM || createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? '…' : 'Créer'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreating(false)}>Annuler</button>
          </div>
        )}

        {isLoading && !data ? <p className="text-muted">Chargement…</p> : null}

        {!isLoading && list.length === 0 && (
          <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
            {hasActiveFilters ? 'Aucune note de frais pour ces filtres' : 'Aucune note de frais'}
          </p>
        )}

        {list.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {visible.number !== false && <th>N°</th>}
                    {visible.context !== false && <th>OM · Dossier · Client · Chantier</th>}
                    {visible.lines !== false && <th>Lignes</th>}
                    {visible.statut !== false && <th>Statut</th>}
                    {visible.total !== false && <th>Total TTC</th>}
                    {visible.date !== false && <th>Créé le</th>}
                    {visible.actions !== false && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      {visible.number !== false && (
                        <td><strong>{r.unique_number}</strong></td>
                      )}
                      {visible.context !== false && (
                        <td><ReportContextCell report={r} /></td>
                      )}
                      {visible.lines !== false && (
                        <td><LinesValidationBadge report={r} /></td>
                      )}
                      {visible.statut !== false && (
                        <td>
                          <StatutSelect
                            value={r.statut}
                            onChange={(statut) => statusMut.mutate({ id: r.id, statut })}
                            disabled={statusMut.isPending}
                          />
                        </td>
                      )}
                      {visible.total !== false && (
                        <td className="ndf-total-cell">{formatMoney(reportTotal(r))}</td>
                      )}
                      {visible.date !== false && (
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{r.created_at?.slice(0, 10)}</td>
                      )}
                      {visible.actions !== false && (
                        <td>
                          <Link to={`/notes-de-frais/${r.id}`} className="btn btn-secondary btn-sm">Ouvrir</Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={data?.current_page ?? 1}
              lastPage={data?.last_page ?? 1}
              onPage={setPage}
            />
          </>
        )}
      </div>
    </ModuleEntityShell>
  )
}
