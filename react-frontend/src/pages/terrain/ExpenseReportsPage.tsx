/**
 * ExpenseReportsPage — Notes de frais (NDF)
 * CRUD lignes, justificatifs, modes de paiement.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminUsersApi,
  expenseReportsApi,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHOD_LABELS,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_TRANSPORT_TYPES,
  isExpenseDeplacementLine,
  type ExpenseLine,
  type ExpensePaymentMethod,
  type ExpenseReport,
  type ExpenseCategory,
  type ExpenseTransportType,
} from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'

const STATUT_COLORS: Record<string, string> = {
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

function LineRow({
  line,
  reportId,
  canEdit,
}: {
  line: ExpenseLine
  reportId: number
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const qc = useQueryClient()

  const deleteMut = useMutation({
    mutationFn: () => expenseReportsApi.deleteLine(reportId, line.id),
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
    <tr>
      <td style={{ fontSize: '0.82rem' }}>{line.date}</td>
      <td>
        <span className="badge">{line.category}</span>
        {fromOm ? (
          <span className="badge" style={{ marginLeft: '0.35rem', background: '#dbeafe', color: '#1d4ed8' }}>
            OM
          </span>
        ) : null}
      </td>
      <td style={{ fontWeight: 600 }}>{formatMoney(Number(line.amount))}</td>
      <td style={{ fontSize: '0.82rem' }}>{paymentLabel(line.payment_method)}</td>
      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{lineDetailText(line)}</td>
      <td style={{ fontSize: '0.82rem' }}>
        {line.receipt_path ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={downloadMut.isPending}
            onClick={() => downloadMut.mutate()}
            title={line.receipt_filename ?? 'Télécharger le justificatif'}
          >
            📎 {line.receipt_filename ? line.receipt_filename.slice(0, 18) : 'Justificatif'}
          </button>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{line.user?.name || `#${line.user_id}`}</td>
      {canEdit && (
        <td style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>✏️</button>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-danger-outline"
            disabled={deleteMut.isPending}
            onClick={() => { if (window.confirm('Supprimer cette ligne ?')) deleteMut.mutate() }}
          >✕</button>
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
    user_id:         initial?.user_id ?? authUser?.id ?? 0,
    category:        (initial?.category ?? 'Repas') as ExpenseCategory,
    amount:          initial?.amount ?? 0,
    payment_method:  (initial?.payment_method ?? '') as ExpensePaymentMethod | '',
    date:            initial?.date ?? new Date().toISOString().slice(0, 10),
    description:     initial?.description ?? '',
    lieu_depart:     initial?.lieu_depart ?? '',
    lieu_arrivee:    initial?.lieu_arrivee ?? '',
    distance_km:     initial?.distance_km ?? '',
    taux_km:         initial?.taux_km ?? 0.401,
    type_transport:  (initial?.type_transport ?? 'voiture') as ExpenseTransportType,
    useKmCalc:       isVoyage && initial?.distance_km != null,
  })

  const showKmFields = form.category === 'Voyage' && (
    form.useKmCalc ||
    isExpenseDeplacementLine({
      category: initial?.category ?? 'Voyage',
      distance_km: initial?.distance_km,
    })
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

  return (
    <tr>
      <td colSpan={8}>
        <div
          style={{
            padding: '0.75rem',
            background: 'var(--color-surface)',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <label>
              Date *
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </label>
            <label>
              Catégorie *
              <select
                value={form.category}
                onChange={(e) => {
                  const category = e.target.value as ExpenseCategory
                  setForm({
                    ...form,
                    category,
                    useKmCalc: category === 'Voyage' ? form.useKmCalc : false,
                  })
                }}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Personnel *
              <select
                value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: Number(e.target.value) })}
              >
                <option value={0}>— sélectionner —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
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
            <label style={{ gridColumn: 'span 2' }}>
              Description
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Détail de la dépense"
              />
            </label>
            <label>
              Justificatif
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              {initial?.receipt_filename && !receiptFile ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Actuel : {initial.receipt_filename}
                </span>
              ) : null}
            </label>
          </div>

          {form.category === 'Voyage' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={form.useKmCalc}
                onChange={(e) => setForm({ ...form, useKmCalc: e.target.checked })}
              />
              Déplacement kilométrique (calcul auto A/R)
            </label>
          )}

          {showKmFields && (
            <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '0.5rem' }}>
              <label>
                Départ
                <input
                  value={form.lieu_depart}
                  onChange={(e) => setForm({ ...form, lieu_depart: e.target.value })}
                />
              </label>
              <label>
                Arrivée
                <input
                  value={form.lieu_arrivee}
                  onChange={(e) => setForm({ ...form, lieu_arrivee: e.target.value })}
                />
              </label>
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
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.taux_km}
                  onChange={(e) => setForm({ ...form, taux_km: Number(e.target.value) })}
                />
              </label>
              <label>
                Transport
                <select
                  value={form.type_transport}
                  onChange={(e) => setForm({ ...form, type_transport: e.target.value as ExpenseTransportType })}
                >
                  {EXPENSE_TRANSPORT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="crud-actions" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={mut.isPending || !form.user_id}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? '…' : isEdit ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onDone}>
              Annuler
            </button>
            {mut.isError && (
              <span style={{ color: 'var(--color-danger)', fontSize: '0.82rem' }}>
                {(mut.error as Error).message}
              </span>
            )}
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
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap',
        marginBottom: '1rem',
        fontSize: '0.82rem',
      }}
    >
      {byMethod.map(([label, total]) => (
        <span
          key={label}
          className="badge"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'inherit' }}
        >
          {label} : <strong>{formatMoney(total)}</strong>
        </span>
      ))}
    </div>
  )
}

function ReportDetail({ reportId, onBack }: { reportId: number; onBack: () => void }) {
  const [addingLine, setAddingLine] = useState(false)
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: report, isLoading } = useQuery({
    queryKey: ['expense-report', reportId],
    queryFn: () => expenseReportsApi.get(reportId),
  })

  const notesValue = notesDraft ?? report?.notes ?? ''

  const updateMut = useMutation({
    mutationFn: (body: Partial<Pick<ExpenseReport, 'statut' | 'notes'>>) =>
      expenseReportsApi.update(reportId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expense-report', reportId] })
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
      setNotesDraft(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => expenseReportsApi.delete(reportId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
      onBack()
    },
  })

  if (isLoading || !report) return <p className="text-muted">Chargement…</p>

  const canEdit = report.statut === 'brouillon'
  const lines = report.lines ?? []
  const total = lines.reduce((s, l) => s + Number(l.amount), 0)
  const colCount = canEdit ? 8 : 7

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>← Retour</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{report.unique_number}</h2>
        <span
          className="badge"
          style={{ background: STATUT_COLORS[report.statut] ?? '#6b7280', color: '#fff', fontWeight: 600 }}
        >
          {report.statut}
        </span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '1rem' }}>
          Total : {formatMoney(total)}
        </span>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
        OM : <strong>{report.ordre_mission?.unique_number ?? report.ordre_mission?.numero}</strong>
        {report.ordre_mission?.client && ` — ${report.ordre_mission.client.name}`}
        {report.ordre_mission?.site && ` — ${report.ordre_mission.site.nom ?? report.ordre_mission.site.name}`}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
          Notes internes
        </label>
        <textarea
          value={notesValue}
          onChange={(e) => setNotesDraft(e.target.value)}
          readOnly={!canEdit}
          rows={2}
          style={{ width: '100%', maxWidth: 640, fontSize: '0.85rem' }}
          placeholder="Commentaires sur cette note de frais…"
        />
        {canEdit && notesDraft !== null && notesDraft !== (report.notes ?? '') && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '0.35rem' }}
            disabled={updateMut.isPending}
            onClick={() => updateMut.mutate({ notes: notesDraft })}
          >
            Enregistrer les notes
          </button>
        )}
      </div>

      <PaymentSummary lines={lines} />

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
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
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={updateMut.isPending}
              onClick={() => updateMut.mutate({ statut: 'valide' })}
            >
              ✓ Valider
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-danger-outline"
              disabled={updateMut.isPending}
              onClick={() => updateMut.mutate({ statut: 'rejete' })}
            >
              ✗ Rejeter
            </button>
          </>
        )}
        {report.statut === 'valide' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={updateMut.isPending}
            onClick={() => updateMut.mutate({ statut: 'rembourse' })}
          >
            Marquer remboursé
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-danger-outline"
            style={{ marginLeft: 'auto' }}
            disabled={deleteMut.isPending}
            onClick={() => {
              if (window.confirm('Supprimer cette note de frais ?')) deleteMut.mutate()
            }}
          >
            Supprimer la NDF
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Catégorie</th>
              <th>Montant</th>
              <th>Paiement</th>
              <th>Description</th>
              <th>Justificatif</th>
              <th>Personnel</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <LineRow key={l.id} line={l} reportId={reportId} canEdit={canEdit} />
            ))}
            {addingLine && (
              <LineForm reportId={reportId} onDone={() => setAddingLine(false)} />
            )}
            {lines.length === 0 && !addingLine && (
              <tr>
                <td colSpan={colCount} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem' }}>
                  Aucune ligne — ajoutez des dépenses ci-dessous
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && !addingLine && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginTop: '0.5rem' }}
          onClick={() => setAddingLine(true)}
        >
          + Ajouter une ligne
        </button>
      )}
    </div>
  )
}

export default function ExpenseReportsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedOM, setSelectedOM] = useState<number | ''>('')
  const [filterStatut, setFilterStatut] = useState('')
  const qc = useQueryClient()

  const { data: reports, isLoading } = useQuery({
    queryKey: ['expense-reports', filterStatut],
    queryFn: () =>
      expenseReportsApi.list(filterStatut ? { statut: filterStatut } : undefined),
    staleTime: 30_000,
  })

  const { data: eligibleOMs = [] } = useQuery({
    queryKey: ['expense-eligible-oms'],
    queryFn: () => expenseReportsApi.eligibleOMs(),
    enabled: creating,
    staleTime: 60_000,
  })

  const createMut = useMutation({
    mutationFn: () =>
      expenseReportsApi.create({ ordre_mission_id: Number(selectedOM) }),
    onSuccess: (report) => {
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
      setCreating(false)
      setSelectedOM('')
      setSelectedId(report.id)
    },
  })

  if (selectedId !== null) {
    return <ReportDetail reportId={selectedId} onBack={() => setSelectedId(null)} />
  }

  const list = reports?.data ?? []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Notes de frais</h1>

        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          style={{ fontSize: '0.85rem' }}
        >
          <option value="">Tous statuts</option>
          {['brouillon', 'soumis', 'valide', 'rembourse', 'rejete'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => setCreating(true)}
        >
          + Nouvelle NDF
        </button>
      </div>

      {creating && (
        <div
          style={{
            padding: '0.75rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            marginBottom: '1rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <label style={{ flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Ordre de mission *</span>
            <select
              value={selectedOM}
              onChange={(e) => setSelectedOM(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ display: 'block', width: '100%', marginTop: 2 }}
            >
              <option value="">— sélectionner —</option>
              {eligibleOMs.map((om) => (
                <option key={om.id} value={om.id}>
                  {om.unique_number ?? om.numero} — {om.type} — {(om as { client?: { name: string } }).client?.name ?? ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!selectedOM || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? '…' : 'Créer'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreating(false)}>
            Annuler
          </button>
        </div>
      )}

      {isLoading && <p className="text-muted">Chargement…</p>}

      {!isLoading && list.length === 0 && (
        <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
          Aucune note de frais
        </p>
      )}

      {list.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>OM</th>
                <th>Client</th>
                <th>Statut</th>
                <th>Total</th>
                <th>Créé le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong style={{ fontSize: '0.85rem' }}>{r.unique_number}</strong>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {r.ordre_mission?.unique_number ?? r.ordre_mission?.numero ?? `#${r.ordre_mission_id}`}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                    {r.ordre_mission?.client?.name ?? '—'}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: STATUT_COLORS[r.statut] ?? '#6b7280',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                      }}
                    >
                      {r.statut}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {r.total !== undefined ? formatMoney(Number(r.total)) : '—'}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                    {r.created_at?.slice(0, 10)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedId(r.id)}
                    >
                      Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
