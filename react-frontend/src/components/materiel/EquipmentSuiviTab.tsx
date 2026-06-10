import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminUsersApi,
  equipmentsApi,
  type CalibrationRow,
  type EquipmentMaintenancePlanRow,
  type EquipmentRow,
  type MaterielAffectationRow,
} from '../../api/client'
import StatusBadge from '../ds/StatusBadge'
import { formatAppDate } from '../../lib/appLocale'
import {
  intervalLabel,
  MAINTENANCE_INTERVAL_OPTIONS,
  MAINTENANCE_KIND_OPTIONS,
  maintenanceKindLabel,
} from './equipmentSuiviUtils'

const CAL_RESULT_LABELS: Record<CalibrationRow['result'], string> = {
  ok: 'Conforme',
  ok_with_reserve: 'Conforme avec réserve',
  failed: 'Non conforme',
}

const CAL_RESULT_VARIANT: Record<CalibrationRow['result'], 'success' | 'warning' | 'danger'> = {
  ok: 'success',
  ok_with_reserve: 'warning',
  failed: 'danger',
}

type Props = {
  equipment: EquipmentRow
  equipmentId: number
  isAdmin: boolean
}

export default function EquipmentSuiviTab({ equipment, equipmentId, isAdmin }: Props) {
  const queryClient = useQueryClient()
  const plans = equipment.maintenance_plans ?? []
  const affectations = equipment.affectations ?? []
  const calibrations = equipment.calibrations ?? []

  const { data: usersPage } = useQuery({
    queryKey: ['admin-users', 'equipment-suivi'],
    queryFn: () => adminUsersApi.list({ page: 1 }),
    enabled: isAdmin,
  })
  const labUsers = (usersPage?.data ?? []).filter((u) =>
    ['lab_admin', 'lab_technician'].includes(u.role),
  )

  const [planForm, setPlanForm] = useState({
    label: 'Étalonnage',
    kind: 'etalonnage' as EquipmentMaintenancePlanRow['kind'],
    interval_months: 12,
    next_due_at: new Date().toISOString().slice(0, 10),
    provider: '',
    notes: '',
  })

  const [affectForm, setAffectForm] = useState({
    user_id: '',
    date_debut: new Date().toISOString().slice(0, 10),
    date_retour_prevue: '',
    observations: '',
  })

  const [recordPlanId, setRecordPlanId] = useState<number | null>(null)
  const [recordForm, setRecordForm] = useState({
    performed_at: new Date().toISOString().slice(0, 10),
    result: 'ok' as CalibrationRow['result'],
    notes: '',
  })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] })
    void queryClient.invalidateQueries({ queryKey: ['equipments'] })
  }

  const createPlan = useMutation({
    mutationFn: () =>
      equipmentsApi.createMaintenancePlan(equipmentId, {
        label: planForm.label.trim(),
        kind: planForm.kind,
        interval_months: planForm.interval_months,
        next_due_at: planForm.next_due_at,
        provider: planForm.provider.trim() || null,
        notes: planForm.notes.trim() || null,
      }),
    onSuccess: refresh,
  })

  const deletePlan = useMutation({
    mutationFn: (planId: number) => equipmentsApi.deleteMaintenancePlan(equipmentId, planId),
    onSuccess: refresh,
  })

  const createAffect = useMutation({
    mutationFn: () =>
      equipmentsApi.createAffectation(equipmentId, {
        user_id: affectForm.user_id ? Number(affectForm.user_id) : null,
        date_debut: affectForm.date_debut,
        date_retour_prevue: affectForm.date_retour_prevue || null,
        observations: affectForm.observations.trim() || null,
      }),
    onSuccess: () => {
      refresh()
      setAffectForm((f) => ({ ...f, date_retour_prevue: '', observations: '' }))
    },
  })

  const deleteAffect = useMutation({
    mutationFn: (id: number) => equipmentsApi.deleteAffectation(equipmentId, id),
    onSuccess: refresh,
  })

  const recordPlan = useMutation({
    mutationFn: () => {
      if (recordPlanId == null) throw new Error('Programme requis.')
      return equipmentsApi.recordMaintenancePlan(equipmentId, recordPlanId, recordForm)
    },
    onSuccess: () => {
      setRecordPlanId(null)
      refresh()
    },
  })

  const sortedCals = [...calibrations].sort((a, b) =>
    String(b.calibration_date).localeCompare(String(a.calibration_date)),
  )

  return (
    <div className="equipment-fiche equipment-suivi">
      <section className="card equipment-suivi__section">
        <div className="equipment-suivi__head">
          <h2 className="equipment-fiche__section-title">Programmes périodiques</h2>
          <p className="text-muted equipment-suivi__hint">
            Définissez la fréquence d&apos;étalonnage ou de maintenance. Les échéances apparaissent dans le planning matériel.
          </p>
        </div>

        {isAdmin ? (
          <form
            className="list-table-toolbar equipment-suivi__form"
            onSubmit={(e) => {
              e.preventDefault()
              createPlan.mutate()
            }}
          >
            <div className="list-table-toolbar__row">
              <label className="list-table-toolbar__field">
                <span className="filter-label">Libellé *</span>
                <input
                  className="article-actions-form__input"
                  value={planForm.label}
                  onChange={(e) => setPlanForm((f) => ({ ...f, label: e.target.value }))}
                  required
                />
              </label>
              <label className="list-table-toolbar__field">
                <span className="filter-label">Type</span>
                <select
                  className="article-actions-form__select"
                  value={planForm.kind}
                  onChange={(e) =>
                    setPlanForm((f) => ({
                      ...f,
                      kind: e.target.value as EquipmentMaintenancePlanRow['kind'],
                    }))
                  }
                >
                  {MAINTENANCE_KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="list-table-toolbar__field">
                <span className="filter-label">Fréquence *</span>
                <select
                  className="article-actions-form__select"
                  value={planForm.interval_months}
                  onChange={(e) =>
                    setPlanForm((f) => ({ ...f, interval_months: Number(e.target.value) }))
                  }
                >
                  {MAINTENANCE_INTERVAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="list-table-toolbar__field">
                <span className="filter-label">Prochaine échéance *</span>
                <input
                  type="date"
                  className="article-actions-form__input"
                  value={planForm.next_due_at}
                  onChange={(e) => setPlanForm((f) => ({ ...f, next_due_at: e.target.value }))}
                  required
                />
              </label>
              <div className="equipment-suivi__form-submit">
                <button type="submit" className="btn btn-primary btn-sm" disabled={createPlan.isPending}>
                  {createPlan.isPending ? 'Ajout…' : '+ Programme'}
                </button>
              </div>
            </div>
            {createPlan.isError ? <p className="error">{(createPlan.error as Error).message}</p> : null}
          </form>
        ) : null}

        {plans.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Fréquence</th>
                  <th>Prochaine échéance</th>
                  <th>Dernière réalisation</th>
                  <th>Statut</th>
                  {isAdmin ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.label}</strong>
                      <span className="text-muted equipment-suivi__kind">{maintenanceKindLabel(p.kind)}</span>
                    </td>
                    <td>{intervalLabel(p.interval_months)}</td>
                    <td>{formatAppDate(p.next_due_at)}</td>
                    <td>{p.last_performed_at ? formatAppDate(p.last_performed_at) : '—'}</td>
                    <td>
                      <StatusBadge variant={p.active ? 'success' : 'neutral'} size="sm">
                        {p.active ? 'Actif' : 'Inactif'}
                      </StatusBadge>
                    </td>
                    {isAdmin ? (
                      <td className="equipment-suivi__actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setRecordPlanId(p.id)
                            setRecordForm({
                              performed_at: new Date().toISOString().slice(0, 10),
                              result: 'ok',
                              notes: '',
                            })
                          }}
                        >
                          Réaliser
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-danger-outline"
                          onClick={() => {
                            if (window.confirm(`Supprimer le programme « ${p.label} » ?`)) {
                              deletePlan.mutate(p.id)
                            }
                          }}
                        >
                          Supprimer
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun programme périodique configuré.</p>
        )}

        {recordPlanId != null ? (
          <form
            className="card equipment-suivi__record"
            onSubmit={(e) => {
              e.preventDefault()
              recordPlan.mutate()
            }}
          >
            <h3 className="equipment-suivi__record-title">Enregistrer une réalisation</h3>
            <div className="list-table-toolbar__row">
              <label className="list-table-toolbar__field">
                <span className="filter-label">Date *</span>
                <input
                  type="date"
                  className="article-actions-form__input"
                  value={recordForm.performed_at}
                  onChange={(e) => setRecordForm((f) => ({ ...f, performed_at: e.target.value }))}
                  required
                />
              </label>
              <label className="list-table-toolbar__field">
                <span className="filter-label">Résultat</span>
                <select
                  className="article-actions-form__select"
                  value={recordForm.result}
                  onChange={(e) =>
                    setRecordForm((f) => ({ ...f, result: e.target.value as CalibrationRow['result'] }))
                  }
                >
                  <option value="ok">Conforme</option>
                  <option value="ok_with_reserve">Conforme avec réserve</option>
                  <option value="failed">Non conforme</option>
                </select>
              </label>
            </div>
            <label className="equipment-suivi__notes">
              <span className="filter-label">Notes</span>
              <textarea
                rows={2}
                value={recordForm.notes}
                onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <div className="crud-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={recordPlan.isPending}>
                {recordPlan.isPending ? 'Enregistrement…' : 'Valider'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRecordPlanId(null)}>
                Annuler
              </button>
            </div>
            {recordPlan.isError ? <p className="error">{(recordPlan.error as Error).message}</p> : null}
          </form>
        ) : null}
      </section>

      <section className="card equipment-suivi__section">
        <div className="equipment-suivi__head">
          <h2 className="equipment-fiche__section-title">Affectations &amp; utilisation</h2>
          <p className="text-muted equipment-suivi__hint">
            Matériel prêté ou utilisé par un technicien ou le labo sur une période — visible dans le planning.
          </p>
        </div>

        {isAdmin ? (
          <form
            className="list-table-toolbar equipment-suivi__form"
            onSubmit={(e) => {
              e.preventDefault()
              createAffect.mutate()
            }}
          >
            <div className="list-table-toolbar__row">
              <label className="list-table-toolbar__field">
                <span className="filter-label">Responsable</span>
                <select
                  className="article-actions-form__select"
                  value={affectForm.user_id}
                  onChange={(e) => setAffectForm((f) => ({ ...f, user_id: e.target.value }))}
                >
                  <option value="">— Non assigné —</option>
                  {labUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="list-table-toolbar__field">
                <span className="filter-label">Début *</span>
                <input
                  type="date"
                  className="article-actions-form__input"
                  value={affectForm.date_debut}
                  onChange={(e) => setAffectForm((f) => ({ ...f, date_debut: e.target.value }))}
                  required
                />
              </label>
              <label className="list-table-toolbar__field">
                <span className="filter-label">Retour prévu</span>
                <input
                  type="date"
                  className="article-actions-form__input"
                  value={affectForm.date_retour_prevue}
                  onChange={(e) => setAffectForm((f) => ({ ...f, date_retour_prevue: e.target.value }))}
                />
              </label>
              <div className="equipment-suivi__form-submit">
                <button type="submit" className="btn btn-primary btn-sm" disabled={createAffect.isPending}>
                  {createAffect.isPending ? 'Ajout…' : '+ Affectation'}
                </button>
              </div>
            </div>
            <label className="equipment-suivi__notes">
              <span className="filter-label">Observations</span>
              <input
                className="article-actions-form__input"
                value={affectForm.observations}
                onChange={(e) => setAffectForm((f) => ({ ...f, observations: e.target.value }))}
                placeholder="Chantier, dossier, contexte…"
              />
            </label>
            {createAffect.isError ? <p className="error">{(createAffect.error as Error).message}</p> : null}
          </form>
        ) : null}

        {affectations.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Responsable</th>
                  <th>Début</th>
                  <th>Fin prévue / effective</th>
                  <th>Observations</th>
                  {isAdmin ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {affectations.map((a: MaterielAffectationRow) => (
                  <tr key={a.id}>
                    <td>{a.user?.name ?? '—'}</td>
                    <td>{formatAppDate(a.date_debut)}</td>
                    <td>
                      {a.date_retour_effective
                        ? formatAppDate(a.date_retour_effective)
                        : a.date_retour_prevue
                          ? formatAppDate(a.date_retour_prevue)
                          : '—'}
                    </td>
                    <td>{a.observations?.trim() || '—'}</td>
                    {isAdmin ? (
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-danger-outline"
                          onClick={() => {
                            if (window.confirm('Supprimer cette affectation ?')) {
                              deleteAffect.mutate(a.id)
                            }
                          }}
                        >
                          Supprimer
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucune affectation enregistrée.</p>
        )}
      </section>

      <section className="card equipment-suivi__section dossier-tab-panel dossier-tab-panel--table">
        <div className="dossier-tab-panel__header">
          <h2 className="ds-form-section__title">Historique des interventions</h2>
          <span className="badge">{sortedCals.length} entrée{sortedCals.length !== 1 ? 's' : ''}</span>
        </div>
        {sortedCals.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Prochaine échéance</th>
                  <th>Fournisseur</th>
                  <th>Résultat</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {sortedCals.map((c) => (
                  <tr key={c.id}>
                    <td>{formatAppDate(c.calibration_date)}</td>
                    <td>{c.next_due_date ? formatAppDate(c.next_due_date) : '—'}</td>
                    <td>{c.provider?.trim() || '—'}</td>
                    <td>
                      <StatusBadge variant={CAL_RESULT_VARIANT[c.result]} size="sm">
                        {CAL_RESULT_LABELS[c.result]}
                      </StatusBadge>
                    </td>
                    <td className="equipment-fiche__notes-cell">{c.notes?.trim() || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucune intervention enregistrée.</p>
        )}
      </section>
    </div>
  )
}
