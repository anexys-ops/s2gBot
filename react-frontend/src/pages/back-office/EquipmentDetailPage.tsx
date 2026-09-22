import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  articleActionsApi,
  catalogueApi,
  equipmentsApi,
  type ArticleEquipmentRequirement,
  type EquipmentRow,
} from '../../api/client'
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

function EquipmentCatalogueLinks({ eq, isAdmin }: { eq: EquipmentRow; isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [articleId, setArticleId] = useState('')
  const [search, setSearch] = useState('')
  const requirements = eq.article_requirements ?? []
  const linkedIds = new Set(requirements.map((requirement) => requirement.ref_article_id))

  const { data: catalogueArticles = [], isLoading } = useQuery({
    queryKey: ['catalogue-articles', 'equipment-links'],
    queryFn: () => catalogueApi.articles(),
    enabled: isAdmin,
  })

  const choices = catalogueArticles.filter((article) => {
    if (!article.actif || linkedIds.has(article.id)) return false
    if (article.kind !== 'jalon' && article.kind !== 'product') return false
    const term = search.trim().toLowerCase()
    return !term || `${article.code} ${article.libelle}`.toLowerCase().includes(term)
  })

  const addMutation = useMutation({
    mutationFn: () => articleActionsApi.equipmentAdd(Number(articleId), { equipment_id: eq.id, quantite: 1 }),
    onSuccess: () => {
      setArticleId('')
      void queryClient.invalidateQueries({ queryKey: ['equipment', eq.id] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (requirement: ArticleEquipmentRequirement) =>
      articleActionsApi.equipmentRemove(requirement.ref_article_id, requirement.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['equipment', eq.id] }),
  })

  return (
    <section className="card equipment-fiche__section">
      <div className="equipment-create-form__types-head">
        <h2 className="equipment-fiche__section-title">Essais et produits du catalogue</h2>
        <span className="badge">{requirements.length} lié{requirements.length !== 1 ? 's' : ''}</span>
      </div>
      <p className="text-muted equipment-fiche__empty">
        Ces liaisons utilisent la même table que l’affectation du matériel depuis la fiche produit.
      </p>

      {requirements.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table data-table--compact">
            <thead><tr><th>Code</th><th>Libellé</th><th>Type</th>{isAdmin ? <th>Action</th> : null}</tr></thead>
            <tbody>
              {requirements.map((requirement) => (
                <tr key={requirement.id}>
                  <td><code className="code-badge">{requirement.article?.code ?? `#${requirement.ref_article_id}`}</code></td>
                  <td>{requirement.article?.libelle ?? 'Article du catalogue'}</td>
                  <td>{requirement.article?.kind === 'product' ? 'Produit' : 'Essai / jalon'}</td>
                  {isAdmin ? (
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-outline"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(requirement)}
                      >
                        Retirer
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted equipment-fiche__empty">Aucun essai ou produit du catalogue associé.</p>
      )}

      {isAdmin ? (
        <div className="catalogue-article-new-form__grid equipment-catalogue-links__add">
          <label className="catalogue-article-new-form__col-4">
            Rechercher dans tout le catalogue
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Code ou libellé…" />
          </label>
          <label className="catalogue-article-new-form__col-6">
            Essai ou produit
            <select value={articleId} onChange={(event) => setArticleId(event.target.value)} disabled={isLoading}>
              <option value="">— Choisir dans le catalogue —</option>
              {choices.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.code} — {article.libelle} ({article.kind === 'product' ? 'Produit' : 'Essai / jalon'})
                </option>
              ))}
            </select>
          </label>
          <div className="catalogue-article-new-form__col-2 crud-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={!articleId || addMutation.isPending} onClick={() => addMutation.mutate()}>
              Ajouter
            </button>
          </div>
        </div>
      ) : null}
      {addMutation.isError ? <p className="error">{(addMutation.error as Error).message}</p> : null}
      {removeMutation.isError ? <p className="error">{(removeMutation.error as Error).message}</p> : null}
    </section>
  )
}

function EquipmentOverview({ eq, isAdmin }: { eq: EquipmentRow; isAdmin: boolean }) {
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

      <EquipmentCatalogueLinks eq={eq} isAdmin={isAdmin} />
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

      {tab === 'overview' && <EquipmentOverview eq={eq} isAdmin={isAdmin} />}
      {tab === 'suivi' && (
        <EquipmentSuiviTab equipment={eq} equipmentId={equipmentId} isAdmin={isAdmin} />
      )}
      {tab === 'extrafields' && isAdmin && (
        <ExtrafieldsForm entityType="equipment" entityId={eq.id} canEdit title="Champs personnalisés matériel" />
      )}
    </ModuleEntityShell>
  )
}
