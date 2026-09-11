/**
 * ActionMeasureConfigPanel — champs de mesure / formulaire pour une action article.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { measureConfigsApi, type ActionMeasureConfig } from '../../api/client'
import ConfirmDialog from '../ConfirmDialog'

const FIELD_TYPES = [
  { value: 'number', label: 'Nombre' },
  { value: 'text', label: 'Texte libre' },
  { value: 'select', label: 'Liste de choix' },
  { value: 'boolean', label: 'Oui / Non' },
  { value: 'date', label: 'Date' },
  { value: 'file', label: 'Fichier / Photo' },
] as const

type FormState = {
  field_name: string
  field_type: ActionMeasureConfig['field_type']
  unit: string
  min_value: number | ''
  max_value: number | ''
  select_options: string
  is_required: boolean
  placeholder: string
  help_text: string
  ordre: number | ''
}

function emptyForm(ordre = 0): FormState {
  return {
    field_name: '',
    field_type: 'number',
    unit: '',
    min_value: '',
    max_value: '',
    select_options: '',
    is_required: true,
    placeholder: '',
    help_text: '',
    ordre,
  }
}

function formToPayload(form: FormState): Partial<ActionMeasureConfig> {
  return {
    field_name: form.field_name,
    field_type: form.field_type,
    unit: form.unit || undefined,
    min_value: form.min_value !== '' ? Number(form.min_value) : undefined,
    max_value: form.max_value !== '' ? Number(form.max_value) : undefined,
    select_options:
      form.field_type === 'select'
        ? form.select_options
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    is_required: form.is_required,
    placeholder: form.placeholder || undefined,
    help_text: form.help_text || undefined,
    ordre: form.ordre !== '' ? Number(form.ordre) : 0,
  }
}

function MeasureConfigFormToolbar({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
  error,
}: {
  form: FormState
  onChange: (next: FormState) => void
  onSubmit: () => void
  onCancel?: () => void
  submitLabel: string
  pending: boolean
  error?: string | null
}) {
  return (
    <div className="article-actions-form article-actions-form--measure">
      <div className="list-table-toolbar__row article-actions-form__row article-actions-form__row--measure">
        <label className="list-table-toolbar__field article-actions-form__field-name">
          <span className="filter-label">Nom du champ *</span>
          <input
            type="text"
            className="article-actions-form__input"
            value={form.field_name}
            onChange={(e) => onChange({ ...form, field_name: e.target.value })}
            required
            placeholder="Ex. Résistance compression"
          />
        </label>
        <label className="list-table-toolbar__field article-actions-form__field-type">
          <span className="filter-label">Type *</span>
          <select
            className="article-actions-form__select"
            value={form.field_type}
            onChange={(e) => onChange({ ...form, field_type: e.target.value as FormState['field_type'] })}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="list-table-toolbar__field article-actions-form__unit">
          <span className="filter-label">Unité</span>
          <input
            type="text"
            className="article-actions-form__input"
            value={form.unit}
            onChange={(e) => onChange({ ...form, unit: e.target.value })}
            placeholder="MPa, mm…"
          />
        </label>
        <label className="list-table-toolbar__field article-actions-form__order">
          <span className="filter-label">Ordre</span>
          <input
            type="number"
            className="article-actions-form__input article-actions-form__input--number"
            min={0}
            value={form.ordre}
            onChange={(e) =>
              onChange({ ...form, ordre: e.target.value === '' ? '' : Number(e.target.value) })
            }
          />
        </label>
        <label className="article-actions-form__optional">
          <input
            type="checkbox"
            checked={form.is_required}
            onChange={(e) => onChange({ ...form, is_required: e.target.checked })}
          />
          <span>Requis</span>
        </label>
        <div className="article-actions-form__actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={pending || !form.field_name.trim()}
            onClick={onSubmit}
          >
            {pending ? '…' : submitLabel}
          </button>
          {onCancel ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
              Annuler
            </button>
          ) : null}
        </div>
      </div>

      <div className="list-table-toolbar__row article-actions-form__row article-actions-form__row--measure-extra">
          {form.field_type === 'number' ? (
            <>
              <label className="list-table-toolbar__field article-actions-form__bound">
                <span className="filter-label">Min</span>
                <input
                  type="number"
                  step="any"
                  className="article-actions-form__input article-actions-form__input--number"
                  value={form.min_value}
                  onChange={(e) =>
                    onChange({ ...form, min_value: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                />
              </label>
              <label className="list-table-toolbar__field article-actions-form__bound">
                <span className="filter-label">Max</span>
                <input
                  type="number"
                  step="any"
                  className="article-actions-form__input article-actions-form__input--number"
                  value={form.max_value}
                  onChange={(e) =>
                    onChange({ ...form, max_value: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                />
              </label>
            </>
          ) : null}
          {form.field_type === 'select' ? (
            <label className="list-table-toolbar__field article-actions-form__select-options">
              <span className="filter-label">Options (virgules)</span>
              <input
                type="text"
                className="article-actions-form__input"
                value={form.select_options}
                onChange={(e) => onChange({ ...form, select_options: e.target.value })}
                placeholder="Conforme, Non conforme, NA"
              />
            </label>
          ) : null}
          <label className="list-table-toolbar__field article-actions-form__help">
            <span className="filter-label">Texte d&apos;aide</span>
            <input
              type="text"
              className="article-actions-form__input"
              value={form.help_text}
              onChange={(e) => onChange({ ...form, help_text: e.target.value })}
              placeholder="Instruction au remplissage…"
            />
          </label>
        </div>

      {error ? <p className="error article-actions-form__error">{error}</p> : null}
    </div>
  )
}

function ConfigRow({
  config,
  articleId,
  actionId,
  onDeleteRequest,
}: {
  config: ActionMeasureConfig
  articleId: number
  actionId: number
  onDeleteRequest: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>({
    field_name: config.field_name,
    field_type: config.field_type,
    unit: config.unit ?? '',
    min_value: config.min_value ?? '',
    max_value: config.max_value ?? '',
    select_options: (config.select_options ?? []).join(', '),
    is_required: config.is_required,
    placeholder: config.placeholder ?? '',
    help_text: config.help_text ?? '',
    ordre: config.ordre,
  })
  const qc = useQueryClient()

  const updateMut = useMutation({
    mutationFn: (body: Partial<ActionMeasureConfig>) =>
      measureConfigsApi.update(articleId, actionId, config.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measure-configs', actionId] })
      setEditing(false)
    },
  })

  if (editing) {
    return (
      <tr className="article-actions-row--editing">
        <td colSpan={7}>
          <MeasureConfigFormToolbar
            form={form}
            onChange={setForm}
            submitLabel="Enregistrer"
            pending={updateMut.isPending}
            error={updateMut.isError ? (updateMut.error as Error).message : null}
            onSubmit={() => updateMut.mutate(formToPayload(form))}
            onCancel={() => setEditing(false)}
          />
        </td>
      </tr>
    )
  }

  const typeLabel = FIELD_TYPES.find((t) => t.value === config.field_type)?.label ?? config.field_type

  return (
    <tr>
      <td className="article-actions-cell-muted">{config.ordre}</td>
      <td>
        <strong className="article-actions-measure-name">{config.field_name}</strong>
      </td>
      <td>
        <span className="badge">{typeLabel}</span>
        {config.unit ? <span className="text-muted article-actions-measure-unit">{config.unit}</span> : null}
      </td>
      <td className="article-actions-cell-muted">
        {config.min_value != null && config.max_value != null
          ? `${config.min_value} – ${config.max_value}`
          : config.min_value != null
            ? `≥ ${config.min_value}`
            : config.max_value != null
              ? `≤ ${config.max_value}`
              : '—'}
      </td>
      <td>
        {config.is_required ? (
          <span className="status-pill status-pill--muted">Requis</span>
        ) : (
          <span className="text-muted">Optionnel</span>
        )}
      </td>
      <td className="article-actions-cell-muted article-actions-measure-help">{config.help_text || '—'}</td>
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

export default function ActionMeasureConfigPanel({
  articleId,
  actionId,
  actionLabel,
}: {
  articleId: number
  actionId: number
  actionLabel?: string
}) {
  const [deleteTarget, setDeleteTarget] = useState<ActionMeasureConfig | null>(null)
  const qc = useQueryClient()

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['measure-configs', actionId],
    queryFn: () => measureConfigsApi.list(articleId, actionId),
    staleTime: 60_000,
  })

  const sorted = configs.slice().sort((a, b) => a.ordre - b.ordre)
  const nextOrdre = sorted.reduce((max, c) => Math.max(max, c.ordre), 0) + 1
  const [newForm, setNewForm] = useState<FormState>(() => emptyForm(nextOrdre))

  const createMut = useMutation({
    mutationFn: (data: Partial<ActionMeasureConfig>) =>
      measureConfigsApi.create(articleId, actionId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measure-configs', actionId] })
      setNewForm(emptyForm(nextOrdre + 1))
    },
  })

  const deleteMut = useMutation({
    mutationFn: (configId: number) => measureConfigsApi.delete(articleId, actionId, configId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measure-configs', actionId] })
      setDeleteTarget(null)
    },
  })

  if (isLoading) {
    return <p className="text-muted article-actions-measure-loading">Chargement des champs…</p>
  }

  return (
    <div className="article-actions-measure">
      <div className="article-actions-measure__header">
        <h4 className="article-actions-add__title">
          Champs du formulaire{actionLabel ? ` — ${actionLabel}` : ''}
        </h4>
        <span className="badge">{sorted.length}</span>
      </div>

      <section className="card list-table-toolbar article-actions-add article-actions-add--nested">
        <div className="article-actions-add__head">
          <span className="article-actions-add__title">Ajouter un champ</span>
        </div>
        <MeasureConfigFormToolbar
          form={newForm}
          onChange={setNewForm}
          submitLabel="+ Ajouter"
          pending={createMut.isPending}
          error={createMut.isError ? (createMut.error as Error).message : null}
          onSubmit={() => createMut.mutate(formToPayload(newForm))}
        />
      </section>

      <div className="card dossier-tab-panel dossier-tab-panel--table article-actions-section__table">
        {sorted.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Champ</th>
                  <th>Type / Unité</th>
                  <th>Bornes</th>
                  <th>Requis</th>
                  <th>Aide</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <ConfigRow
                    key={c.id}
                    config={c}
                    articleId={articleId}
                    actionId={actionId}
                    onDeleteRequest={() => setDeleteTarget(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun champ de mesure pour cette action.</p>
        )}
      </div>

      {deleteTarget ? (
        <ConfirmDialog
          title="Supprimer le champ"
          message={
            <>
              Supprimer le champ <strong>{deleteTarget.field_name}</strong> ?
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          error={deleteMut.isError ? (deleteMut.error as Error).message : null}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          onCancel={() => {
            if (!deleteMut.isPending) setDeleteTarget(null)
          }}
        />
      ) : null}
    </div>
  )
}
