/**
 * ExpenseReportsPage — Notes de frais (NDF)
 */
import { useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  expenseReportsApi,
  EXPENSE_PAYMENT_METHOD_LABELS,
  EXPENSE_STATUT_LABELS,
  EXPENSE_STATUT_OPTIONS,
  isExpenseDeplacementLine,
  type ExpenseLine,
  type ExpensePaymentMethod,
  type ExpenseReport,
  type ExpenseReportStatut,
} from '../../api/client'
import ListTableToolbar, { PaginationBar } from '../../components/ListTableToolbar'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import DocumentPdfPickerModal from '../../components/pdf/DocumentPdfPickerModal'
import ExpenseLineModal from './ExpenseLineModal'
import NdfSendEmailModal from './NdfSendEmailModal'
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
  const porteur = report.user

  return (
    <div className="ndf-context-row">
      {om ? (
        <span className="ndf-context-chip">
          <span className="ndf-context-chip__label">OM</span>
          <strong>{om.unique_number ?? om.numero}</strong>
        </span>
      ) : porteur ? (
        <span className="ndf-context-chip">
          <span className="ndf-context-chip__label">Hors OM</span>
          <strong>{porteur.name}</strong>
        </span>
      ) : (
        <span className="ndf-context-chip">
          <span className="ndf-context-chip__label">Hors OM</span>
          <strong>Autonome</strong>
        </span>
      )}
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
    om ? (om.unique_number ?? om.numero) : (report.user?.name ? `Hors OM · ${report.user.name}` : 'Hors OM'),
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

function LineRow({
  line,
  reportId,
  canEdit,
  canValidate,
  onEdit,
}: {
  line: ExpenseLine
  reportId: number
  canEdit: boolean
  canValidate: boolean
  onEdit: (line: ExpenseLine) => void
}) {
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(line)} title="Modifier">✏️</button>
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
  const [lineModal, setLineModal] = useState<'new' | ExpenseLine | null>(null)
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [privateNotesDraft, setPrivateNotesDraft] = useState<string | null>(null)
  const [advanceDraft, setAdvanceDraft] = useState<number | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPdfOpen(true)}>🖨 Imprimer PDF</button>
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
                <LineRow
                  key={l.id}
                  line={l}
                  reportId={reportId}
                  canEdit={canEdit}
                  canValidate={canValidate}
                  onEdit={(line) => setLineModal(line)}
                />
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem' }}>
                    Aucune ligne — ajoutez des dépenses ci-dessous
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <button type="button" className="btn btn-secondary btn-sm ndf-no-print" style={{ marginTop: '0.75rem' }} onClick={() => setLineModal('new')}>
            + Ajouter une ligne
          </button>
        )}
      </div>

      {lineModal ? (
        <ExpenseLineModal
          reportId={reportId}
          initial={lineModal === 'new' ? undefined : lineModal}
          onClose={() => setLineModal(null)}
          onSaved={() => setLineModal(null)}
        />
      ) : null}

      {emailOpen ? <NdfSendEmailModal report={report} onClose={() => setEmailOpen(false)} /> : null}

      {pdfOpen ? (
        <DocumentPdfPickerModal
          documentType="expense_report"
          documentId={report.id}
          documentLabel={report.unique_number}
          onClose={() => setPdfOpen(false)}
        />
      ) : null}
    </ModuleEntityShell>
  )
}

export default function ExpenseReportsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const reportId = id ? Number(id) : null

  const [creating, setCreating] = useState(false)
  const [createMode, setCreateMode] = useState<'with_om' | 'without_om'>('without_om')
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
    enabled: creating && createMode === 'with_om',
    staleTime: 60_000,
  })

  const createMut = useMutation({
    mutationFn: () => expenseReportsApi.create(
      createMode === 'with_om'
        ? { ordre_mission_id: Number(selectedOM) }
        : {},
    ),
    onSuccess: (report) => {
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
      setCreating(false)
      setSelectedOM('')
      setCreateMode('without_om')
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
          <div className="card ndf-no-print ndf-create-card">
            <div className="ndf-create-mode">
              <label className={`ndf-create-mode__option${createMode === 'without_om' ? ' ndf-create-mode__option--active' : ''}`}>
                <input
                  type="radio"
                  name="ndf-create-mode"
                  checked={createMode === 'without_om'}
                  onChange={() => setCreateMode('without_om')}
                />
                <span>
                  <strong>Sans ordre de mission</strong>
                  <small>NDF autonome (automatisation, frais divers)</small>
                </span>
              </label>
              <label className={`ndf-create-mode__option${createMode === 'with_om' ? ' ndf-create-mode__option--active' : ''}`}>
                <input
                  type="radio"
                  name="ndf-create-mode"
                  checked={createMode === 'with_om'}
                  onChange={() => setCreateMode('with_om')}
                />
                <span>
                  <strong>Liée à un OM</strong>
                  <small>Rattacher à un ordre de mission existant</small>
                </span>
              </label>
            </div>
            {createMode === 'with_om' ? (
              <label style={{ flex: 1, minWidth: 220, marginTop: '0.75rem' }}>
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
            ) : (
              <p className="text-muted" style={{ margin: '0.75rem 0 0', fontSize: '0.85rem' }}>
                La NDF sera créée pour votre compte, sans rattachement à un OM. Vous pourrez y ajouter des lignes (repas, déplacement, autres).
              </p>
            )}
            <div className="crud-actions" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={(createMode === 'with_om' && !selectedOM) || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? '…' : 'Créer'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreating(false)}>Annuler</button>
            </div>
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
                          <Link to={`/notes-de-frais/${r.id}`} className="btn btn-secondary btn-sm">Modifier</Link>
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
