/**
 * ExpenseReportsPage — Notes de frais (NDF)
 * Liste les NDF + création depuis un OM terrain/ingénieur + gestion des lignes.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  expenseReportsApi,
  EXPENSE_CATEGORIES,
  type ExpenseReport,
  type ExpenseLine,
  type ExpenseCategory,
} from '../../api/client'

// ── Couleur badge statut ─────────────────────────────────────────────────────
const STATUT_COLORS: Record<string, string> = {
  brouillon: '#6b7280',
  soumis:    '#3b82f6',
  valide:    '#10b981',
  rembourse: '#8b5cf6',
  rejete:    '#ef4444',
}

// ── Composant ligne individuelle ─────────────────────────────────────────────
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
      </td>
      <td style={{ fontWeight: 600 }}>{Number(line.amount).toFixed(2)} €</td>
      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{line.description || '—'}</td>
      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{line.user?.name || `#${line.user_id}`}</td>
      {canEdit && (
        <td style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>✏️</button>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-danger-outline"
            disabled={deleteMut.isPending}
            onClick={() => { if (window.confirm('Supprimer ?')) deleteMut.mutate() }}
          >✕</button>
        </td>
      )}
    </tr>
  )
}

// ── Formulaire ligne ─────────────────────────────────────────────────────────
function LineForm({
  initial,
  reportId,
  onDone,
}: {
  initial?: Partial<ExpenseLine>
  reportId: number
  onDone: () => void
}) {
  const user = { id: 1 }
  const qc = useQueryClient()

  const [form, setForm] = useState({
    user_id:     initial?.user_id ?? user?.id ?? 0,
    category:    (initial?.category ?? 'Repas') as ExpenseCategory,
    amount:      initial?.amount ?? 0,
    date:        initial?.date ?? new Date().toISOString().slice(0, 10),
    description: initial?.description ?? '',
  })

  const isEdit = !!initial?.id

  const mut = useMutation({
    mutationFn: () =>
      isEdit
        ? expenseReportsApi.updateLine(reportId, initial!.id!, form)
        : expenseReportsApi.addLine(reportId, form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expense-report', reportId] })
      onDone()
    },
  })

  return (
    <tr>
      <td colSpan={6}>
        <div
          style={{
            padding: '0.5rem',
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
                onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Montant TTC (€) *
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                required
              />
            </label>
            <label>
              Description
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Détail de la dépense"
              />
            </label>
          </div>
          <div className="crud-actions" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? '…' : isEdit ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onDone}>
              Annuler
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Détail NDF ───────────────────────────────────────────────────────────────
function ReportDetail({ reportId, onBack }: { reportId: number; onBack: () => void }) {
  const [addingLine, setAddingLine] = useState(false)
  const qc = useQueryClient()

  const { data: report, isLoading } = useQuery({
    queryKey: ['expense-report', reportId],
    queryFn: () => expenseReportsApi.get(reportId),
  })

  const updateMut = useMutation({
    mutationFn: (statut: ExpenseReport['statut']) =>
      expenseReportsApi.update(reportId, { statut }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expense-report', reportId] })
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
    },
  })

  if (isLoading || !report) return <p className="text-muted">Chargement…</p>

  const canEdit = report.statut === 'brouillon'
  const lines = report.lines ?? []
  const total = lines.reduce((s, l) => s + Number(l.amount), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>← Retour</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{report.unique_number}</h2>
        <span
          className="badge"
          style={{ background: STATUT_COLORS[report.statut] ?? '#6b7280', color: '#fff', fontWeight: 600 }}
        >
          {report.statut}
        </span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '1rem' }}>
          Total : {total.toFixed(2)} €
        </span>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
        OM : <strong>{report.ordre_mission?.unique_number ?? report.ordre_mission?.numero}</strong>
        {report.ordre_mission?.client && ` — ${report.ordre_mission.client.name}`}
        {report.ordre_mission?.site && ` — ${report.ordre_mission.site.nom ?? report.ordre_mission.site.name}`}
      </div>

      {/* Actions statut */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {report.statut === 'brouillon' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={updateMut.isPending}
            onClick={() => updateMut.mutate('soumis')}
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
              onClick={() => updateMut.mutate('valide')}
            >
              ✓ Valider
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-danger-outline"
              disabled={updateMut.isPending}
              onClick={() => updateMut.mutate('rejete')}
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
            onClick={() => updateMut.mutate('rembourse')}
          >
            Marquer remboursé
          </button>
        )}
      </div>

      {/* Lignes */}
      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Catégorie</th>
              <th>Montant</th>
              <th>Description</th>
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
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem' }}>
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

// ── Page principale ──────────────────────────────────────────────────────────
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

      {/* Formulaire création */}
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
                  {om.unique_number ?? om.numero} — {om.type} — {(om as any).client?.name ?? ''}
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
                    {r.total !== undefined ? `${Number(r.total).toFixed(2)} €` : '—'}
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
