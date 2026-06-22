/**
 * ArticleActionsPanel — Actions & matériel (lab_admin / lab_technician).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  articleActionsApi,
  equipmentsApi,
  type ArticleAction,
  type ArticleEquipmentRequirement,
} from '../../api/client'
import ConfirmDialog from '../ConfirmDialog'
import ActionMeasureConfigPanel from './ActionMeasureConfigPanel'
import ArticleS2gSectionProducts from './ArticleS2gSectionProducts'
import type { RefArticleRow } from '../../api/client'

const TYPE_META: Record<string, { label: string; dotClass: string }> = {
  technicien: { label: 'Terrain / Technicien', dotClass: 'article-actions-type-dot--technicien' },
  ingenieur: { label: 'Ingénieur', dotClass: 'article-actions-type-dot--ingenieur' },
  labo: { label: 'Laboratoire', dotClass: 'article-actions-type-dot--labo' },
}

const TYPES = ['technicien', 'ingenieur', 'labo'] as const

type ActionFormState = {
  libelle: string
  description: string
  duree_heures: number
  ordre: number
}

function ActionFormToolbar({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
  error,
  cancelLabel = 'Annuler',
}: {
  form: ActionFormState
  onChange: (next: ActionFormState) => void
  onSubmit: () => void
  onCancel?: () => void
  submitLabel: string
  pending: boolean
  error?: string | null
  cancelLabel?: string
}) {
  return (
    <div className="article-actions-form">
      <div className="list-table-toolbar__row article-actions-form__row article-actions-form__row--action">
        <label className="list-table-toolbar__field article-actions-form__libelle">
          <span className="filter-label">Libellé *</span>
          <input
            type="text"
            className="article-actions-form__input"
            value={form.libelle}
            onChange={(e) => onChange({ ...form, libelle: e.target.value })}
            required
            placeholder="Ex. Essai Proctor"
          />
        </label>
        <label className="list-table-toolbar__field article-actions-form__description">
          <span className="filter-label">Description</span>
          <input
            type="text"
            className="article-actions-form__input"
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder="Précisions optionnelles"
          />
        </label>
        <label className="list-table-toolbar__field article-actions-form__duration">
          <span className="filter-label">Durée (h)</span>
          <input
            type="number"
            className="article-actions-form__input article-actions-form__input--number"
            min={0}
            step={0.25}
            value={form.duree_heures}
            onChange={(e) => onChange({ ...form, duree_heures: Number(e.target.value) })}
          />
        </label>
        <label className="list-table-toolbar__field article-actions-form__order">
          <span className="filter-label">Ordre</span>
          <input
            type="number"
            className="article-actions-form__input article-actions-form__input--number"
            min={0}
            value={form.ordre}
            onChange={(e) => onChange({ ...form, ordre: Number(e.target.value) })}
          />
        </label>
        <div className="article-actions-form__actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={pending || !form.libelle.trim()}
            onClick={onSubmit}
          >
            {pending ? '…' : submitLabel}
          </button>
          {onCancel ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
              {cancelLabel}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="error article-actions-form__error">{error}</p> : null}
    </div>
  )
}

function ActionRow({
  action,
  articleId,
  onDeleteRequest,
}: {
  action: ArticleAction
  articleId: number
  onDeleteRequest: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ActionFormState>({
    libelle: action.libelle,
    description: action.description ?? '',
    duree_heures: action.duree_heures ?? 0,
    ordre: action.ordre ?? 0,
  })
  const qc = useQueryClient()

  const updateMut = useMutation({
    mutationFn: (body: Partial<ArticleAction>) => articleActionsApi.update(articleId, action.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-actions', articleId] })
      setEditing(false)
    },
  })

  const meta = TYPE_META[action.type] ?? { label: action.type, dotClass: '' }

  if (editing) {
    return (
      <tr className="article-actions-row--editing">
        <td colSpan={5}>
          <ActionFormToolbar
            form={form}
            onChange={setForm}
            submitLabel="Enregistrer"
            pending={updateMut.isPending}
            error={updateMut.isError ? (updateMut.error as Error).message : null}
            onSubmit={() =>
              updateMut.mutate({
                libelle: form.libelle,
                description: form.description || undefined,
                duree_heures: Number(form.duree_heures),
                ordre: Number(form.ordre),
              })
            }
            onCancel={() => setEditing(false)}
          />
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>
        <span className={`article-actions-type-dot ${meta.dotClass}`} aria-hidden />
        {action.libelle}
      </td>
      <td className="article-actions-cell-muted">{action.description || '—'}</td>
      <td className="article-actions-cell-amount">{action.duree_heures ? `${action.duree_heures} h` : '—'}</td>
      <td className="article-actions-cell-amount article-actions-cell-muted">{action.ordre ?? 0}</td>
      <td className="article-actions-cell-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)} title="Modifier">
          ✏️
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-danger-outline"
          title="Supprimer"
          onClick={onDeleteRequest}
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

function NewActionForm({
  articleId,
  type,
  nextOrdre,
}: {
  articleId: number
  type: 'technicien' | 'ingenieur' | 'labo'
  nextOrdre: number
}) {
  const [form, setForm] = useState<ActionFormState>({
    libelle: '',
    description: '',
    duree_heures: 1,
    ordre: nextOrdre,
  })
  const qc = useQueryClient()

  const createMut = useMutation({
    mutationFn: () =>
      articleActionsApi.create(articleId, {
        type,
        libelle: form.libelle,
        description: form.description || undefined,
        duree_heures: Number(form.duree_heures),
        ordre: Number(form.ordre),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-actions', articleId] })
      setForm({ libelle: '', description: '', duree_heures: 1, ordre: nextOrdre + 1 })
    },
  })

  return (
    <section className="card list-table-toolbar article-actions-add">
      <div className="article-actions-add__head">
        <h4 className="article-actions-add__title">Ajouter une action</h4>
      </div>
      <ActionFormToolbar
        form={form}
        onChange={setForm}
        submitLabel="+ Ajouter"
        pending={createMut.isPending}
        error={createMut.isError ? (createMut.error as Error).message : null}
        onSubmit={() => createMut.mutate()}
      />
    </section>
  )
}

function EquipmentRequirementRow({
  requirement,
  onDeleteRequest,
}: {
  requirement: ArticleEquipmentRequirement
  onDeleteRequest: () => void
}) {
  const eq = requirement.equipment

  return (
    <tr>
      <td>
        {eq ? (
          <Link to={`/materiel/equipements/${eq.id}`} className="link-inline">
            <code className="code-badge">{eq.code ?? `#${eq.id}`}</code> {eq.name}
          </Link>
        ) : (
          `Équipement #${requirement.equipment_id}`
        )}
      </td>
      <td className="article-actions-cell-muted">{eq?.type?.trim() || '—'}</td>
      <td className="article-actions-cell-amount">{requirement.quantite ?? 1}</td>
      <td className="article-actions-cell-muted">{requirement.notes?.trim() || '—'}</td>
      <td className="article-actions-cell-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-danger-outline"
          title="Retirer"
          onClick={onDeleteRequest}
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

function NewEquipmentForm({
  articleId,
  existingEquipmentIds,
}: {
  articleId: number
  existingEquipmentIds: number[]
}) {
  const [form, setForm] = useState({ equipment_id: '', quantite: 1, notes: '' })
  const qc = useQueryClient()

  const { data: equipments = [] } = useQuery({
    queryKey: ['equipments', 'article-requirements'],
    queryFn: () => equipmentsApi.list(),
    staleTime: 120_000,
  })

  const available = equipments
    .filter((eq) => !existingEquipmentIds.includes(eq.id))
    .sort((a, b) => a.code.localeCompare(b.code, 'fr'))

  const createMut = useMutation({
    mutationFn: () =>
      articleActionsApi.equipmentAdd(articleId, {
        equipment_id: Number(form.equipment_id),
        quantite: Number(form.quantite) || 1,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-equipment-requirements', articleId] })
      setForm({ equipment_id: '', quantite: 1, notes: '' })
    },
  })

  return (
    <section className="card list-table-toolbar article-actions-add">
      <div className="article-actions-add__head">
        <h4 className="article-actions-add__title">Ajouter un équipement</h4>
      </div>
      <div className="article-actions-form">
        <div className="list-table-toolbar__row article-actions-form__row article-actions-form__row--equipment">
          <label className="list-table-toolbar__field article-actions-form__equipment">
            <span className="filter-label">Équipement *</span>
            <select
              className="article-actions-form__select"
              value={form.equipment_id}
              onChange={(e) => setForm((f) => ({ ...f, equipment_id: e.target.value }))}
              required
            >
              <option value="">— Choisir —</option>
              {available.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.code} — {eq.name}
                </option>
              ))}
            </select>
          </label>
          <label className="list-table-toolbar__field article-actions-form__qty">
            <span className="filter-label">Quantité</span>
            <input
              type="number"
              className="article-actions-form__input article-actions-form__input--number"
              min={1}
              value={form.quantite}
              onChange={(e) => setForm((f) => ({ ...f, quantite: Number(e.target.value) }))}
            />
          </label>
          <label className="list-table-toolbar__field article-actions-form__notes">
            <span className="filter-label">Notes</span>
            <input
              type="text"
              className="article-actions-form__input"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optionnel"
            />
          </label>
          <div className="article-actions-form__actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={createMut.isPending || !form.equipment_id}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Ajout…' : '+ Ajouter'}
            </button>
          </div>
        </div>
        {createMut.isError ? (
          <p className="error article-actions-form__error">{(createMut.error as Error).message}</p>
        ) : null}
      </div>
    </section>
  )
}

export default function ArticleActionsPanel({
  article,
  canEdit = false,
}: {
  article: RefArticleRow
  canEdit?: boolean
}) {
  const articleId = article.id
  const isS2g = article.kind === 'jalon' || article.kind === 'product'
  const qc = useQueryClient()
  const [deleteActionTarget, setDeleteActionTarget] = useState<ArticleAction | null>(null)
  const [deleteEquipmentTarget, setDeleteEquipmentTarget] = useState<ArticleEquipmentRequirement | null>(null)

  const { data: actions = [], isLoading: loadingActions } = useQuery({
    queryKey: ['article-actions', articleId],
    queryFn: () => articleActionsApi.list(articleId),
    staleTime: 60_000,
  })

  const { data: equipmentRequirements = [], isLoading: loadingEquipment } = useQuery({
    queryKey: ['article-equipment-requirements', articleId],
    queryFn: () => articleActionsApi.equipmentList(articleId),
    staleTime: 60_000,
  })

  const deleteActionMut = useMutation({
    mutationFn: (actionId: number) => articleActionsApi.delete(articleId, actionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-actions', articleId] })
      setDeleteActionTarget(null)
    },
  })

  const deleteEquipmentMut = useMutation({
    mutationFn: (requirementId: number) => articleActionsApi.equipmentRemove(articleId, requirementId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-equipment-requirements', articleId] })
      setDeleteEquipmentTarget(null)
    },
  })

  if (loadingActions || loadingEquipment) {
    return (
      <div className="article-actions-panel">
        <p className="text-muted">Chargement des actions et matériel…</p>
      </div>
    )
  }

  return (
    <div className="article-actions-panel">
      <section className="card dossier-tab-panel">
        <h2 className="ds-form-section__title">Actions &amp; matériel</h2>
        <p className="dossier-tab-panel__intro">
          {isS2g
            ? 'Répartissez les produits S2G par profil pour les devis (terrain, ingénieur, laboratoire), puis définissez les actions, mesures et le matériel requis.'
            : 'Définissez les actions par profil (terrain, ingénieur, laboratoire), les champs de mesure associés et le matériel requis pour réaliser la prestation.'}
        </p>
      </section>

      {TYPES.map((type) => {
        const meta = TYPE_META[type]
        const typeActions = actions
          .filter((a) => a.type === type)
          .slice()
          .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
        const nextOrdre = typeActions.reduce((max, a) => Math.max(max, a.ordre ?? 0), 0) + 1

        return (
          <section key={type} className="card dossier-tab-panel article-actions-section">
            <div className="article-actions-section__header">
              <span className={`article-actions-type-dot ${meta.dotClass}`} aria-hidden />
              <h3 className="ds-form-section__title">{meta.label}</h3>
              <span className="badge">
                {typeActions.length} action{typeActions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {isS2g ? (
              <ArticleS2gSectionProducts article={article} sectionType={type} canEdit={canEdit} />
            ) : null}

            <NewActionForm articleId={articleId} type={type} nextOrdre={nextOrdre} />

            <div className="card dossier-tab-panel dossier-tab-panel--table article-actions-section__table">
              <div className="dossier-tab-panel__header">
                <h4 className="article-actions-add__title">Actions enregistrées</h4>
              </div>
              {typeActions.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table data-table--compact">
                    <thead>
                      <tr>
                        <th>Libellé</th>
                        <th>Description</th>
                        <th className="article-actions-cell-amount">Durée</th>
                        <th className="article-actions-cell-amount">Ordre</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {typeActions.map((action) => (
                        <ActionRow
                          key={action.id}
                          action={action}
                          articleId={articleId}
                          onDeleteRequest={() => setDeleteActionTarget(action)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dossier-tab-empty">Aucune action définie pour ce type.</p>
              )}
            </div>

            {typeActions.map((action) => (
              <ActionMeasureConfigPanel
                key={action.id}
                articleId={articleId}
                actionId={action.id}
                actionLabel={action.libelle}
              />
            ))}
          </section>
        )
      })}

      <section className="card dossier-tab-panel article-actions-section">
        <div className="article-actions-section__header">
          <span className="article-actions-type-dot article-actions-type-dot--materiel" aria-hidden />
          <h3 className="ds-form-section__title">Matériel requis</h3>
          <span className="badge">
            {equipmentRequirements.length} équipement{equipmentRequirements.length !== 1 ? 's' : ''}
          </span>
        </div>

        <NewEquipmentForm
          articleId={articleId}
          existingEquipmentIds={equipmentRequirements.map((r) => r.equipment_id)}
        />

        <div className="card dossier-tab-panel dossier-tab-panel--table article-actions-section__table">
          <div className="dossier-tab-panel__header">
            <h4 className="article-actions-add__title">Équipements liés</h4>
          </div>
          {equipmentRequirements.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Équipement</th>
                    <th>Type</th>
                    <th className="article-actions-cell-amount">Qté</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {equipmentRequirements.map((req) => (
                    <EquipmentRequirementRow
                      key={req.id}
                      requirement={req}
                      onDeleteRequest={() => setDeleteEquipmentTarget(req)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dossier-tab-empty">Aucun équipement requis défini pour cet article.</p>
          )}
        </div>
      </section>

      {deleteActionTarget ? (
        <ConfirmDialog
          title="Supprimer l'action"
          message={
            <>
              Supprimer l&apos;action <strong>{deleteActionTarget.libelle}</strong> ?
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteActionMut.isPending}
          error={deleteActionMut.isError ? (deleteActionMut.error as Error).message : null}
          onConfirm={() => deleteActionMut.mutate(deleteActionTarget.id)}
          onCancel={() => {
            if (!deleteActionMut.isPending) setDeleteActionTarget(null)
          }}
        />
      ) : null}

      {deleteEquipmentTarget ? (
        <ConfirmDialog
          title="Retirer l'équipement"
          message={
            <>
              Retirer{' '}
              <strong>
                {deleteEquipmentTarget.equipment?.name ?? `équipement #${deleteEquipmentTarget.equipment_id}`}
              </strong>{' '}
              de la fiche article ?
            </>
          }
          confirmLabel="Retirer"
          variant="danger"
          loading={deleteEquipmentMut.isPending}
          error={deleteEquipmentMut.isError ? (deleteEquipmentMut.error as Error).message : null}
          onConfirm={() => deleteEquipmentMut.mutate(deleteEquipmentTarget.id)}
          onCancel={() => {
            if (!deleteEquipmentMut.isPending) setDeleteEquipmentTarget(null)
          }}
        />
      ) : null}
    </div>
  )
}
