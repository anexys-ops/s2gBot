import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminUsersApi,
  equipmentsApi,
  type EquipmentMaintenancePlanRow,
  type EquipmentRow,
  type MaterielAffectationRow,
} from '../../api/client'
import { formatAppDate } from '../../lib/appLocale'
import {
  dateInputValue,
  intervalLabel,
  MAINTENANCE_INTERVAL_OPTIONS,
  MAINTENANCE_KIND_OPTIONS,
  maintenanceKindLabel,
  todayDateInput,
} from './equipmentSuiviUtils'

type Props = {
  equipment: EquipmentRow
  equipmentId: number
  isAdmin: boolean
}

export default function EquipmentSuiviTab({ equipment, equipmentId, isAdmin }: Props) {
  const queryClient = useQueryClient()
  const plans = equipment.maintenance_plans ?? []
  const affectations = equipment.affectations ?? []

  const { data: usersPage } = useQuery({
    queryKey: ['admin-users', 'equipment-suivi'],
    queryFn: () => adminUsersApi.list({ page: 1 }),
    enabled: isAdmin,
  })
  const labUsers = (usersPage?.data ?? []).filter((u) =>
    ['lab_admin', 'lab_technician'].includes(u.role),
  )

  const [planForm, setPlanForm] = useState({
    label: '',
    kind: 'etalonnage' as EquipmentMaintenancePlanRow['kind'],
    interval_months: 12,
    next_due_at: todayDateInput(),
    provider: '',
    notes: '',
  })

  const [affectForm, setAffectForm] = useState({
    user_id: '',
    date_debut: todayDateInput(),
    date_retour_prevue: '',
    observations: '',
  })

  const [planSavingId, setPlanSavingId] = useState<number | null>(null)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] })
    void queryClient.invalidateQueries({ queryKey: ['equipments'] })
    void queryClient.invalidateQueries({ queryKey: ['materiel-affectations'] })
    void queryClient.invalidateQueries({ queryKey: ['equipment-maintenance-due'] })
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
    onSuccess: () => {
      refresh()
      setPlanForm((f) => ({ ...f, label: '', provider: '', notes: '' }))
    },
  })

  const updatePlan = useMutation({
    mutationFn: ({
      planId,
      body,
    }: {
      planId: number
      body: Parameters<typeof equipmentsApi.updateMaintenancePlan>[2]
    }) => equipmentsApi.updateMaintenancePlan(equipmentId, planId, body),
    onMutate: ({ planId }) => setPlanSavingId(planId),
    onSettled: () => setPlanSavingId(null),
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

  function patchPlan(plan: EquipmentMaintenancePlanRow, body: Parameters<typeof equipmentsApi.updateMaintenancePlan>[2]) {
    updatePlan.mutate({ planId: plan.id, body })
  }

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
                  placeholder="Ex. Contrôle annuel"
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
            <table className="data-table data-table--compact equipment-suivi__table">
              <thead>
                <tr>
                  <th>Libellé</th>
                  <th>Type</th>
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
                      {isAdmin ? (
                        <input
                          className="article-actions-form__input equipment-suivi__cell-input"
                          defaultValue={p.label}
                          key={`${p.id}-${p.label}`}
                          onBlur={(e) => {
                            const next = e.target.value.trim()
                            if (next && next !== p.label) patchPlan(p, { label: next })
                          }}
                          disabled={planSavingId === p.id}
                        />
                      ) : (
                        p.label
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <select
                          className="article-actions-form__select equipment-suivi__cell-input"
                          value={p.kind}
                          onChange={(e) =>
                            patchPlan(p, { kind: e.target.value as EquipmentMaintenancePlanRow['kind'] })
                          }
                          disabled={planSavingId === p.id}
                        >
                          {MAINTENANCE_KIND_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        maintenanceKindLabel(p.kind)
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <select
                          className="article-actions-form__select equipment-suivi__cell-input"
                          value={p.interval_months}
                          onChange={(e) => patchPlan(p, { interval_months: Number(e.target.value) })}
                          disabled={planSavingId === p.id}
                        >
                          {MAINTENANCE_INTERVAL_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        intervalLabel(p.interval_months)
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <input
                          type="date"
                          className="article-actions-form__input equipment-suivi__cell-input"
                          value={dateInputValue(p.next_due_at)}
                          onChange={(e) => patchPlan(p, { next_due_at: e.target.value })}
                          disabled={planSavingId === p.id}
                        />
                      ) : (
                        formatAppDate(p.next_due_at)
                      )}
                    </td>
                    <td>{p.last_performed_at ? formatAppDate(p.last_performed_at) : '—'}</td>
                    <td>
                      {isAdmin ? (
                        <select
                          className="article-actions-form__select equipment-suivi__cell-input"
                          value={p.active ? '1' : '0'}
                          onChange={(e) => patchPlan(p, { active: e.target.value === '1' })}
                          disabled={planSavingId === p.id}
                        >
                          <option value="1">Actif</option>
                          <option value="0">Inactif</option>
                        </select>
                      ) : (
                        p.active ? 'Actif' : 'Inactif'
                      )}
                    </td>
                    {isAdmin ? (
                      <td className="equipment-suivi__actions">
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
        {updatePlan.isError ? <p className="error">{(updatePlan.error as Error).message}</p> : null}
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
                <span className="filter-label">Fin prévue / effective</span>
                <input
                  type="date"
                  className="article-actions-form__input"
                  value={affectForm.date_retour_prevue}
                  onChange={(e) => setAffectForm((f) => ({ ...f, date_retour_prevue: e.target.value }))}
                />
              </label>
              <label className="list-table-toolbar__field equipment-suivi__field-grow">
                <span className="filter-label">Observations</span>
                <input
                  className="article-actions-form__input"
                  value={affectForm.observations}
                  onChange={(e) => setAffectForm((f) => ({ ...f, observations: e.target.value }))}
                  placeholder="Chantier, dossier, contexte…"
                />
              </label>
              <div className="equipment-suivi__form-submit">
                <button type="submit" className="btn btn-primary btn-sm" disabled={createAffect.isPending}>
                  {createAffect.isPending ? 'Ajout…' : '+ Affectation'}
                </button>
              </div>
            </div>
            {createAffect.isError ? <p className="error">{(createAffect.error as Error).message}</p> : null}
          </form>
        ) : null}

        {affectations.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact equipment-suivi__table">
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
    </div>
  )
}
