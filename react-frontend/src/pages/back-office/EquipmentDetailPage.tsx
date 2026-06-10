import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { equipmentsApi, type CalibrationRow, type EquipmentRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge, { equipementStatutBadgeProps } from '../../components/ds/StatusBadge'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { MATERIEL_HOME, MATERIEL_MODULE_TABS } from '../materiel/materielModuleTabs'
import { formatAppDate } from '../../lib/appLocale'

type TabId = 'overview' | 'calibrations' | 'extrafields'

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  maintenance: 'Maintenance',
  retired: 'Retiré',
}

const CAL_RESULT_LABELS: Record<CalibrationRow['result'], string> = {
  ok: 'Conforme',
  ok_with_reserve: 'Conforme avec réserve',
  failed: 'Non conforme',
}

const CAL_RESULT_VARIANT: Record<
  CalibrationRow['result'],
  'success' | 'warning' | 'danger'
> = {
  ok: 'success',
  ok_with_reserve: 'warning',
  failed: 'danger',
}

function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? value
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return formatAppDate(value)
}

function upcomingCalibration(eq: EquipmentRow): CalibrationRow | null {
  const cals = eq.calibrations ?? []
  if (cals.length === 0) return null
  const withDue = cals.filter((c) => c.next_due_date)
  if (withDue.length === 0) return cals[0] ?? null
  return [...withDue].sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date)))[0]
}

function latestCalibration(eq: EquipmentRow): CalibrationRow | null {
  const cals = eq.calibrations ?? []
  if (cals.length === 0) return null
  return [...cals].sort((a, b) => String(b.calibration_date).localeCompare(String(a.calibration_date)))[0]
}

function AddCalibrationForm({
  equipmentId,
  isAdmin,
}: {
  equipmentId: number
  isAdmin: boolean
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    calibration_date: new Date().toISOString().slice(0, 10),
    next_due_date: '',
    provider: '',
    result: 'ok' as CalibrationRow['result'],
    notes: '',
  })

  const addCal = useMutation({
    mutationFn: () =>
      equipmentsApi.createCalibration(equipmentId, {
        calibration_date: form.calibration_date,
        next_due_date: form.next_due_date || null,
        provider: form.provider || null,
        result: form.result,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] })
      void queryClient.invalidateQueries({ queryKey: ['equipments'] })
      setForm((f) => ({
        ...f,
        next_due_date: '',
        provider: '',
        notes: '',
      }))
    },
  })

  if (!isAdmin) return null

  return (
    <section className="card list-table-toolbar equipment-calibration-add">
      <div className="equipment-calibration-add__head">
        <h3 className="equipment-calibration-add__title">Ajouter un étalonnage</h3>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          addCal.mutate()
        }}
      >
        <div className="list-table-toolbar__row equipment-calibration-add__row">
          <label className="list-table-toolbar__field">
            <span className="filter-label">Date d&apos;étalonnage *</span>
            <input
              type="date"
              className="article-actions-form__input"
              value={form.calibration_date}
              onChange={(e) => setForm((f) => ({ ...f, calibration_date: e.target.value }))}
              required
            />
          </label>
          <label className="list-table-toolbar__field">
            <span className="filter-label">Prochaine échéance</span>
            <input
              type="date"
              className="article-actions-form__input"
              value={form.next_due_date}
              onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
            />
          </label>
          <label className="list-table-toolbar__field equipment-calibration-add__provider">
            <span className="filter-label">Fournisseur</span>
            <input
              type="text"
              className="article-actions-form__input"
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              placeholder="Organisme, labo…"
            />
          </label>
          <label className="list-table-toolbar__field equipment-calibration-add__result">
            <span className="filter-label">Résultat</span>
            <select
              className="article-actions-form__select"
              value={form.result}
              onChange={(e) =>
                setForm((f) => ({ ...f, result: e.target.value as CalibrationRow['result'] }))
              }
            >
              <option value="ok">Conforme</option>
              <option value="ok_with_reserve">Conforme avec réserve</option>
              <option value="failed">Non conforme</option>
            </select>
          </label>
          <div className="equipment-calibration-add__submit">
            <button type="submit" className="btn btn-primary btn-sm" disabled={addCal.isPending}>
              {addCal.isPending ? 'Enregistrement…' : '+ Enregistrer'}
            </button>
          </div>
        </div>
        <label className="equipment-calibration-add__notes">
          <span className="filter-label">Notes</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Observations, réserve, référence certificat…"
          />
        </label>
        {addCal.isError ? <p className="error equipment-calibration-add__error">{(addCal.error as Error).message}</p> : null}
      </form>
    </section>
  )
}

function EquipmentOverview({ eq }: { eq: EquipmentRow }) {
  const st = equipementStatutBadgeProps(eq.status)
  const nextCal = upcomingCalibration(eq)
  const lastCal = latestCalibration(eq)

  return (
    <div className="equipment-fiche">
      <section className="card equipment-fiche__summary">
        <h2 className="equipment-fiche__section-title">Caractéristiques</h2>
        <dl className="module-fiche-grid equipment-fiche__grid">
          <div>
            <dt>Code</dt>
            <dd>
              <code className="code-badge">{eq.code}</code>
            </dd>
          </div>
          <div>
            <dt>Statut</dt>
            <dd>
              <StatusBadge variant={st.variant} size="sm">
                {statusLabel(eq.status)}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt>Nom</dt>
            <dd>{eq.name}</dd>
          </div>
          <div>
            <dt>Type / catégorie</dt>
            <dd>{eq.type?.trim() || '—'}</dd>
          </div>
          <div>
            <dt>Marque</dt>
            <dd>{eq.brand?.trim() || '—'}</dd>
          </div>
          <div>
            <dt>Modèle</dt>
            <dd>{eq.model?.trim() || '—'}</dd>
          </div>
          <div>
            <dt>N° de série</dt>
            <dd>{eq.serial_number?.trim() || '—'}</dd>
          </div>
          <div>
            <dt>Emplacement</dt>
            <dd>{eq.location?.trim() || '—'}</dd>
          </div>
          <div>
            <dt>Agence</dt>
            <dd>{eq.agency?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Date d&apos;achat</dt>
            <dd>{formatDate(eq.purchase_date)}</dd>
          </div>
          <div>
            <dt>Dernier étalonnage</dt>
            <dd>{lastCal ? formatDate(lastCal.calibration_date) : '—'}</dd>
          </div>
          <div>
            <dt>Prochaine échéance</dt>
            <dd>{nextCal?.next_due_date ? formatDate(nextCal.next_due_date) : '—'}</dd>
          </div>
        </dl>
        <p className="equipment-fiche__id-line text-muted">
          Réf. interne #{eq.id}
          {lastCal?.provider ? (
            <>
              {' '}
              — Dernier prestataire : {lastCal.provider}
            </>
          ) : null}
        </p>
      </section>

      <section className="card equipment-fiche__section">
        <h2 className="equipment-fiche__section-title">Types d&apos;essai liés</h2>
        {eq.test_types && eq.test_types.length > 0 ? (
          <ul className="equipment-fiche__tags">
            {eq.test_types.map((t) => (
              <li key={t.id}>
                <span className="catalogue-prolab-tag catalogue-prolab-tag--b">{t.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted equipment-fiche__empty">Aucun type d&apos;essai associé.</p>
        )}
      </section>
    </div>
  )
}

function EquipmentCalibrationsTab({
  eq,
  equipmentId,
  isAdmin,
}: {
  eq: EquipmentRow
  equipmentId: number
  isAdmin: boolean
}) {
  const sorted = useMemo(
    () =>
      [...(eq.calibrations ?? [])].sort((a, b) =>
        String(b.calibration_date).localeCompare(String(a.calibration_date)),
      ),
    [eq.calibrations],
  )

  return (
    <div className="equipment-fiche">
      <AddCalibrationForm equipmentId={equipmentId} isAdmin={isAdmin} />

      <section className="card dossier-tab-panel dossier-tab-panel--table">
        <div className="dossier-tab-panel__header">
          <h2 className="ds-form-section__title">Historique des étalonnages</h2>
          <span className="badge">
            {sorted.length} enregistrement{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>
        {sorted.length > 0 ? (
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
                {sorted.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDate(c.calibration_date)}</td>
                    <td>{formatDate(c.next_due_date)}</td>
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
          <p className="dossier-tab-empty">Aucun étalonnage enregistré pour cet équipement.</p>
        )}
      </section>
    </div>
  )
}

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const equipmentId = Number(id)
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const [tab, setTab] = useState<TabId>('overview')

  const { data: eq, isLoading, error } = useQuery({
    queryKey: ['equipment', equipmentId],
    queryFn: () => equipmentsApi.get(equipmentId),
    enabled: isLab && Number.isFinite(equipmentId) && equipmentId > 0,
  })

  if (!isLab) {
    return <Navigate to="/" replace />
  }
  if (!Number.isFinite(equipmentId) || equipmentId <= 0) {
    return <Navigate to="/materiel/equipements" replace />
  }

  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Parc équipements', to: MATERIEL_HOME },
          { label: '…' },
        ]}
        moduleBarLabel="Matériel"
        title="Chargement…"
        tabs={MATERIEL_MODULE_TABS}
      >
        <p className="text-muted">Chargement de la fiche équipement…</p>
      </ModuleEntityShell>
    )
  }

  if (error || !eq) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Parc équipements', to: MATERIEL_HOME },
          { label: 'Erreur' },
        ]}
        moduleBarLabel="Matériel"
        title="Équipement introuvable"
        tabs={MATERIEL_MODULE_TABS}
      >
        <p className="error">{(error as Error)?.message ?? 'Équipement introuvable.'}</p>
        <Link to="/materiel/equipements" className="link-inline">
          ← Retour au parc
        </Link>
      </ModuleEntityShell>
    )
  }

  const st = equipementStatutBadgeProps(eq.status)
  const calCount = eq.calibrations?.length ?? 0

  return (
    <ModuleEntityShell
      shellClassName="module-shell--equipment-fiche"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Parc équipements', to: MATERIEL_HOME },
        { label: eq.code },
      ]}
      moduleBarLabel="Matériel — Fiche équipement"
      title={eq.name}
      subtitle={
        <div className="equipment-fiche__title-row">
          <code className="code-badge">{eq.code}</code>
          <StatusBadge variant={st.variant} size="sm">
            {statusLabel(eq.status)}
          </StatusBadge>
          {eq.type?.trim() ? <span className="text-muted">{eq.type}</span> : null}
        </div>
      }
      tabs={MATERIEL_MODULE_TABS}
      actions={
        <Link to="/materiel/equipements" className="btn btn-secondary btn-sm">
          ← Liste
        </Link>
      }
    >
      <div className="article-fiche-tabs equipment-fiche-tabs" role="tablist" aria-label="Sections fiche équipement">
        {[
          { id: 'overview' as const, label: 'Fiche' },
          { id: 'calibrations' as const, label: `Étalonnages (${calCount})` },
          ...(isAdmin ? [{ id: 'extrafields' as const, label: 'Champs personnalisés' }] : []),
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={`article-fiche-tabs__btn${tab === t.id ? ' article-fiche-tabs__btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <EquipmentOverview eq={eq} />}
      {tab === 'calibrations' && (
        <EquipmentCalibrationsTab eq={eq} equipmentId={equipmentId} isAdmin={isAdmin} />
      )}
      {tab === 'extrafields' && isAdmin && (
        <ExtrafieldsForm entityType="equipment" entityId={eq.id} canEdit title="Champs personnalisés matériel" />
      )}
    </ModuleEntityShell>
  )
}
