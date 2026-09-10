/**
 * Section notes de frais sur fiche ordre de mission (repas, déplacement, autres + PJ).
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  expenseReportsApi,
  EXPENSE_PAYMENT_METHOD_LABELS,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_STATUT_LABELS,
  ordresMissionApi,
  type FraisDeplacement,
  type FraisType,
  type User,
} from '../../api/client'
import { formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'
import {
  DEFAULT_EXPENSE_TAUX_KM,
  FRAIS_TYPE_LABELS,
  FRAIS_TYPE_OPTIONS,
  userExpenseBareme,
} from '../../lib/expenseBareme'
import './om-expense-panel.css'

type Props = {
  omId: number
  frais: FraisDeplacement[]
  users: User[]
}

const EMPTY_FORM = {
  type: 'repas' as FraisType,
  user_id: '',
  date: '',
  amount: '',
  payment_method: '',
  description: '',
  lieu_depart: '',
  lieu_arrivee: '',
  distance_km: '',
  taux_km: String(DEFAULT_EXPENSE_TAUX_KM),
  type_transport: 'voiture',
}

function fraisTypeLabel(f: FraisDeplacement): string {
  return FRAIS_TYPE_LABELS[f.type ?? (f.category === 'Repas' ? 'repas' : f.distance_km != null ? 'deplacement' : 'autres')]
}

function fraisDetail(f: FraisDeplacement): string {
  if (f.type === 'deplacement' || f.distance_km != null) {
    const trajet = [f.lieu_depart, f.lieu_arrivee].filter(Boolean).join(' → ')
    return trajet || f.description || f.notes || '—'
  }
  return f.description || f.notes || '—'
}

export default function OmExpensePanel({ omId, frais, users }: Props) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const selectedUser = useMemo(
    () => users.find((u) => u.id === Number(form.user_id)),
    [users, form.user_id],
  )
  const bareme = userExpenseBareme(selectedUser)

  const totalFrais = frais.reduce((s, f) => s + Number(f.montant ?? f.amount ?? 0), 0)
  const expenseReportId = frais[0]?.expense_report_id
  const expenseReportNumber = frais[0]?.expense_report_number
  const ndfStatut = frais[0]?.ndf_statut

  const createMut = useMutation({
    mutationFn: async () => {
      const body: Parameters<typeof ordresMissionApi.fraisCreate>[1] = {
        type: form.type,
        user_id: Number(form.user_id),
        date: form.date,
        payment_method: form.payment_method || undefined,
        description: form.description || undefined,
        notes: form.description || undefined,
      }

      if (form.type === 'deplacement') {
        body.lieu_depart = form.lieu_depart || undefined
        body.lieu_arrivee = form.lieu_arrivee || undefined
        body.distance_km = Number(form.distance_km)
        body.taux_km = Number(form.taux_km) || bareme.taux_km
        body.type_transport = form.type_transport
      } else {
        body.amount = Number(form.amount)
      }

      const line = await ordresMissionApi.fraisCreate(omId, body)

      if (receiptFile) {
        await expenseReportsApi.uploadLineReceipt(line.expense_report_id, line.id, receiptFile)
      }

      return line
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordre-mission-frais', omId] })
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
      setShowForm(false)
      setForm(EMPTY_FORM)
      setReceiptFile(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (fraisId: number) => ordresMissionApi.fraisDelete(omId, fraisId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordre-mission-frais', omId] })
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
    },
  })

  const downloadMut = useMutation({
    mutationFn: ({ reportId, lineId, filename }: { reportId: number; lineId: number; filename: string }) =>
      expenseReportsApi.downloadLineReceipt(reportId, lineId, filename),
  })

  const estimatedKm =
    form.type === 'deplacement' && form.distance_km && form.taux_km
      ? Number(form.distance_km) * Number(form.taux_km) * 2
      : null

  return (
    <section className="card om-ndf-panel">
      <header className="om-ndf-panel__header">
        <div>
          <h2 className="om-ndf-panel__title">Notes de frais</h2>
          <p className="om-ndf-panel__subtitle">
            Repas, déplacements et autres frais liés à cet ordre de mission.
            {frais.length > 0 ? (
              <span className="om-ndf-panel__total"> Total : <strong>{formatMoney(totalFrais)}</strong></span>
            ) : null}
          </p>
          {expenseReportId ? (
            <p className="om-ndf-panel__ndf-link">
              NDF{' '}
              <Link to={`/notes-de-frais/${expenseReportId}`} className="link-inline">
                {expenseReportNumber ?? `#${expenseReportId}`}
              </Link>
              {ndfStatut ? ` · ${EXPENSE_STATUT_LABELS[ndfStatut]}` : null}
              {' '}— validation dans Terrain → Notes de frais
            </p>
          ) : null}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Fermer' : '+ Ajouter une dépense'}
        </button>
      </header>

      {showForm && (
        <form
          className="om-ndf-panel__form"
          onSubmit={(e) => {
            e.preventDefault()
            createMut.mutate()
          }}
        >
          <div className="om-ndf-type-picker" role="group" aria-label="Type de dépense">
            {FRAIS_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`om-ndf-type-picker__btn${form.type === opt.value ? ' om-ndf-type-picker__btn--active' : ''}`}
                onClick={() => setForm((f) => ({
                  ...f,
                  type: opt.value,
                  taux_km: String(selectedUser?.expense_taux_km ?? DEFAULT_EXPENSE_TAUX_KM),
                  amount: opt.value === 'repas' && selectedUser?.expense_forfait_repas
                    ? String(selectedUser.expense_forfait_repas)
                    : f.amount,
                }))}
              >
                <span className="om-ndf-type-picker__icon">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          <div className="quote-form-grid om-ndf-panel__grid">
            <label>
              Personnel *
              <select
                value={form.user_id}
                onChange={(e) => {
                  const user = users.find((u) => u.id === Number(e.target.value))
                  const b = userExpenseBareme(user)
                  setForm((f) => ({
                    ...f,
                    user_id: e.target.value,
                    taux_km: String(b.taux_km),
                    amount: f.type === 'repas' && b.forfait_repas != null ? String(b.forfait_repas) : f.amount,
                  }))
                }}
                required
              >
                <option value="">Choisir…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label>
              Date *
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
            </label>
            <label>
              Mode de paiement
              <select value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
                <option value="">—</option>
                {EXPENSE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{EXPENSE_PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </label>
            <label>
              Justificatif
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
            </label>

            {form.type === 'deplacement' ? (
              <>
                <label>
                  Départ
                  <input value={form.lieu_depart} onChange={(e) => setForm((f) => ({ ...f, lieu_depart: e.target.value }))} placeholder="Ville départ" />
                </label>
                <label>
                  Arrivée
                  <input value={form.lieu_arrivee} onChange={(e) => setForm((f) => ({ ...f, lieu_arrivee: e.target.value }))} placeholder="Ville arrivée" />
                </label>
                <label>
                  Distance aller (km) *
                  <input type="number" min={0} step="0.1" value={form.distance_km} onChange={(e) => setForm((f) => ({ ...f, distance_km: e.target.value }))} required />
                </label>
                <label>
                  Taux {MONEY_UNIT_LABEL}/km
                  <input type="number" min={0} step="0.0001" value={form.taux_km} onChange={(e) => setForm((f) => ({ ...f, taux_km: e.target.value }))} />
                </label>
              </>
            ) : (
              <>
                <label>
                  Montant TTC ({MONEY_UNIT_LABEL}) *
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                  />
                  {form.type === 'repas' && bareme.plafond_repas != null ? (
                    <span className="om-ndf-panel__hint">Plafond barème : {formatMoney(bareme.plafond_repas)}</span>
                  ) : null}
                </label>
                <label className="om-ndf-panel__grid-span-2">
                  Description
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={form.type === 'repas' ? 'Ex. déjeuner client, restaurant…' : 'Détail de la dépense…'}
                  />
                </label>
              </>
            )}
          </div>

          {estimatedKm != null ? (
            <p className="om-ndf-panel__estimate">
              Montant estimé (A/R) : <strong>{formatMoney(estimatedKm)}</strong>
            </p>
          ) : null}

          {selectedUser ? (
            <p className="om-ndf-panel__bareme-hint text-muted">
              Barème RH : {bareme.taux_km.toFixed(4)} {MONEY_UNIT_LABEL}/km
              {bareme.forfait_repas != null ? ` · forfait repas ${formatMoney(bareme.forfait_repas)}` : ''}
            </p>
          ) : null}

          {createMut.isError ? (
            <p className="error">{(createMut.error as Error).message}</p>
          ) : null}

          <div className="crud-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending}>
              {createMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="data-table data-table--compact om-ndf-panel__table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Personnel</th>
              <th>Date</th>
              <th>Détail</th>
              <th>Montant</th>
              <th>PJ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {frais.map((f) => (
              <tr key={f.id}>
                <td><span className="om-ndf-panel__type-badge">{fraisTypeLabel(f)}</span></td>
                <td>{f.user?.name ?? `#${f.user_id}`}</td>
                <td>{new Date(f.date).toLocaleDateString('fr-FR')}</td>
                <td className="om-ndf-panel__detail">{fraisDetail(f)}</td>
                <td><strong>{formatMoney(Number(f.montant ?? f.amount ?? 0))}</strong></td>
                <td>
                  {f.receipt_path ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={downloadMut.isPending}
                      onClick={() => downloadMut.mutate({
                        reportId: f.expense_report_id,
                        lineId: f.id,
                        filename: f.receipt_filename ?? `justificatif-${f.id}`,
                      })}
                    >
                      📎
                    </button>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-danger-outline"
                    disabled={deleteMut.isPending}
                    onClick={() => { if (window.confirm('Supprimer cette ligne ?')) deleteMut.mutate(f.id) }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {frais.length === 0 && !showForm && (
        <p className="om-ndf-panel__empty text-muted">
          Aucune dépense. Chaque saisie crée ou complète automatiquement la note de frais (NDF) de l’OM.
        </p>
      )}
    </section>
  )
}
