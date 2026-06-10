import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { equipmentsApi, type EquipmentRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge, { equipementStatutBadgeProps } from '../../components/ds/StatusBadge'
import EquipmentSuiviTab from '../../components/materiel/EquipmentSuiviTab'
import { affectationEndDate, todayDateInput } from '../../components/materiel/equipmentSuiviUtils'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { MATERIEL_HOME, MATERIEL_MODULE_TABS } from '../materiel/materielModuleTabs'
import { formatAppDate } from '../../lib/appLocale'

type TabId = 'overview' | 'suivi' | 'extrafields'

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  maintenance: 'Maintenance',
  retired: 'Retiré',
}

function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? value
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return formatAppDate(value)
}

function nextMaintenancePlan(eq: EquipmentRow) {
  const plans = (eq.maintenance_plans ?? []).filter((p) => p.active)
  if (plans.length === 0) return null
  return [...plans].sort((a, b) => String(a.next_due_at).localeCompare(String(b.next_due_at)))[0]
}

function currentAffectation(eq: EquipmentRow) {
  const today = todayDateInput()
  return (eq.affectations ?? []).find((a) => {
    const start = a.date_debut.slice(0, 10)
    const end = affectationEndDate(a).slice(0, 10)
    return today >= start && today <= end
  })
}

function latestIntervention(eq: EquipmentRow) {
  const cals = eq.calibrations ?? []
  if (cals.length === 0) return null
  return [...cals].sort((a, b) => String(b.calibration_date).localeCompare(String(a.calibration_date)))[0]
}

function EquipmentOverview({ eq }: { eq: EquipmentRow }) {
  const st = equipementStatutBadgeProps(eq.status)
  const nextPlan = nextMaintenancePlan(eq)
  const activeAffect = currentAffectation(eq)
  const lastIntervention = latestIntervention(eq)

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
            <dt>Prochaine échéance</dt>
            <dd>{nextPlan ? formatDate(nextPlan.next_due_at) : '—'}</dd>
          </div>
          <div>
            <dt>Affectation en cours</dt>
            <dd>
              {activeAffect
                ? `${activeAffect.user?.name ?? 'Non assigné'} — jusqu'au ${formatDate(affectationEndDate(activeAffect))}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Dernière intervention</dt>
            <dd>{lastIntervention ? formatDate(lastIntervention.calibration_date) : '—'}</dd>
          </div>
        </dl>
        <p className="equipment-fiche__id-line text-muted">Réf. interne #{eq.id}</p>
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
  const planCount = eq.maintenance_plans?.filter((p) => p.active).length ?? 0
  const affectCount = eq.affectations?.length ?? 0

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
          {
            id: 'suivi' as const,
            label: `Suivi & planning (${planCount + affectCount})`,
          },
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
      {tab === 'suivi' && (
        <EquipmentSuiviTab equipment={eq} equipmentId={equipmentId} isAdmin={isAdmin} />
      )}
      {tab === 'extrafields' && isAdmin && (
        <ExtrafieldsForm entityType="equipment" entityId={eq.id} canEdit title="Champs personnalisés matériel" />
      )}
    </ModuleEntityShell>
  )
}
