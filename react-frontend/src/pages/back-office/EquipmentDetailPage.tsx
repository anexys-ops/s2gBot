import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { equipmentsApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const equipmentId = Number(id)
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()

  const [calForm, setCalForm] = useState({
    calibration_date: new Date().toISOString().slice(0, 10),
    next_due_date: '',
    provider: '',
    result: 'ok',
    notes: '',
  })

  const { data: eq, isLoading, error } = useQuery({
    queryKey: ['equipment', equipmentId],
    queryFn: () => equipmentsApi.get(equipmentId),
    enabled: isLab && Number.isFinite(equipmentId),
  })

  const addCal = useMutation({
    mutationFn: () =>
      equipmentsApi.createCalibration(equipmentId, {
        calibration_date: calForm.calibration_date,
        next_due_date: calForm.next_due_date || null,
        provider: calForm.provider || null,
        result: calForm.result,
        notes: calForm.notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] })
      queryClient.invalidateQueries({ queryKey: ['equipments'] })
      setCalForm((f) => ({
        ...f,
        next_due_date: '',
        provider: '',
        notes: '',
      }))
    },
  })

  if (!isLab) {
    return <Navigate to="/" replace />
  }
  if (!Number.isFinite(equipmentId)) {
    return <Navigate to="/back-office/equipements" replace />
  }

  return (
    <div className="design-card">
      <p>
        <Link to="/back-office/equipements">← Liste équipements</Link>
      </p>
      {isLoading && <p className="design-card__muted">Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      {eq && (
        <>
          <h2 style={{ marginTop: 0 }}>
            {eq.code} — {eq.name}
          </h2>
          <dl className="meta-dl" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
            <dt className="design-card__muted">Statut</dt>
            <dd>{eq.status}</dd>
            <dt className="design-card__muted">Marque / modèle</dt>
            <dd>
              {[eq.brand, eq.model].filter(Boolean).join(' · ') || '—'}
            </dd>
            <dt className="design-card__muted">N° série</dt>
            <dd>{eq.serial_number ?? '—'}</dd>
            <dt className="design-card__muted">Emplacement</dt>
            <dd>{eq.location ?? '—'}</dd>
            <dt className="design-card__muted">Agence</dt>
            <dd>{eq.agency?.name ?? '—'}</dd>
            <dt className="design-card__muted">Types d’essai</dt>
            <dd>{eq.test_types?.map((t) => t.name).join(', ') || '—'}</dd>
          </dl>

          <h3>Étalonnages</h3>
          <div className="activity-table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Prochaine échéance</th>
                  <th>Fournisseur</th>
                  <th>Résultat</th>
                </tr>
              </thead>
              <tbody>
                {(eq.calibrations ?? []).map((c) => (
                  <tr key={c.id}>
                    <td>{c.calibration_date ? new Date(c.calibration_date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>{c.next_due_date ? new Date(c.next_due_date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>{c.provider ?? '—'}</td>
                    <td>{c.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(eq.calibrations ?? []).length === 0 && (
              <p className="design-card__muted">Aucun étalonnage enregistré.</p>
            )}
          </div>

          {isAdmin && (
            <form
              style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}
              onSubmit={(e) => {
                e.preventDefault()
                addCal.mutate()
              }}
            >
              <h4>Ajouter un étalonnage</h4>
              <label>
                <span className="design-card__muted">Date d’étalonnage</span>
                <input
                  type="date"
                  className="input"
                  value={calForm.calibration_date}
                  onChange={(e) => setCalForm((f) => ({ ...f, calibration_date: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span className="design-card__muted">Prochaine échéance</span>
                <input
                  type="date"
                  className="input"
                  value={calForm.next_due_date}
                  onChange={(e) => setCalForm((f) => ({ ...f, next_due_date: e.target.value }))}
                />
              </label>
              <label>
                <span className="design-card__muted">Fournisseur</span>
                <input
                  className="input"
                  value={calForm.provider}
                  onChange={(e) => setCalForm((f) => ({ ...f, provider: e.target.value }))}
                />
              </label>
              <label>
                <span className="design-card__muted">Résultat</span>
                <select
                  className="input"
                  value={calForm.result}
                  onChange={(e) =>
                    setCalForm((f) => ({
                      ...f,
                      result: e.target.value as 'ok' | 'ok_with_reserve' | 'failed',
                    }))
                  }
                >
                  <option value="ok">ok</option>
                  <option value="ok_with_reserve">ok_with_reserve</option>
                  <option value="failed">failed</option>
                </select>
              </label>
              <label>
                <span className="design-card__muted">Notes</span>
                <textarea
                  className="input"
                  rows={2}
                  value={calForm.notes}
                  onChange={(e) => setCalForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              {addCal.isError && <p className="error">{(addCal.error as Error).message}</p>}
              <button type="submit" className="btn btn--primary" disabled={addCal.isPending}>
                Enregistrer
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
