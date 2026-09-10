/**
 * Modal d'ajout / modification d'une ligne de note de frais.
 */
import { useState } from 'react'
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
  type ExpenseCategory,
  type ExpenseTransportType,
} from '../../api/client'
import Modal from '../../components/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'
import { DEFAULT_EXPENSE_TAUX_KM, userExpenseBareme } from '../../lib/expenseBareme'

function computeKmAmount(distanceKm: number, tauxKm: number): number {
  return Math.round(Math.max(0, distanceKm) * Math.max(0, tauxKm) * 2 * 100) / 100
}

type Props = {
  reportId: number
  initial?: Partial<ExpenseLine>
  onClose: () => void
  onSaved: () => void
}

export default function ExpenseLineModal({ reportId, initial, onClose, onSaved }: Props) {
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
    taux_km:        initial?.taux_km ?? DEFAULT_EXPENSE_TAUX_KM,
    type_transport: (initial?.type_transport ?? 'voiture') as ExpenseTransportType,
    useKmCalc:      isVoyage && initial?.distance_km != null,
  })

  const selectedUser = users.find((u) => u.id === form.user_id)
  const bareme = userExpenseBareme(selectedUser)

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
      onSaved()
      onClose()
    },
  })

  return (
    <Modal title={isEdit ? 'Modifier la ligne' : 'Ajouter une ligne'} onClose={onClose}>
      <div className="ndf-line-form" style={{ border: 'none', padding: 0, background: 'transparent' }}>
        <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
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
            <select
              value={form.user_id}
              onChange={(e) => {
                const user = users.find((u) => u.id === Number(e.target.value))
                const b = userExpenseBareme(user)
                setForm((f) => ({
                  ...f,
                  user_id: Number(e.target.value),
                  taux_km: b.taux_km,
                  amount: f.category === 'Repas' && b.forfait_repas != null ? b.forfait_repas : f.amount,
                }))
              }}
            >
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
              {form.category === 'Repas' && bareme.plafond_repas != null ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Plafond barème : {formatMoney(bareme.plafond_repas)}
                </span>
              ) : null}
            </label>
          ) : (
            <label>
              Montant calculé ({MONEY_UNIT_LABEL})
              <input type="text" value={formatMoney(computedAmount)} readOnly disabled />
            </label>
          )}
          <label style={{ gridColumn: '1 / -1' }}>
            Description
            <textarea
              className="ndf-desc-input"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Détail de la dépense, contexte, commentaires…"
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Justificatif
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
            {initial?.receipt_filename && !receiptFile ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Actuel : {initial.receipt_filename}</span>
            ) : null}
          </label>
        </div>

        {form.category === 'Voyage' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={form.useKmCalc} onChange={(e) => setForm({ ...form, useKmCalc: e.target.checked })} />
            Déplacement kilométrique (calcul auto A/R)
          </label>
        )}

        {showKmFields && (
          <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: '0.75rem' }}>
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

        {mut.isError ? (
          <p className="error" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{(mut.error as Error).message}</p>
        ) : null}

        <div className="crud-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-primary" disabled={mut.isPending || !form.user_id} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter la ligne'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={mut.isPending} onClick={onClose}>Annuler</button>
        </div>
      </div>
    </Modal>
  )
}
