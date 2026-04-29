/**
 * ActionMeasureConfigPanel
 * Panneau de configuration des mesures/champs de formulaire pour une action article.
 * Affiché dans ArticleActionsPanel sous chaque action (lab_admin).
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { measureConfigsApi, type ActionMeasureConfig } from '../../api/client'

const FIELD_TYPES = [
  { value: 'number',  label: 'Nombre' },
  { value: 'text',    label: 'Texte libre' },
  { value: 'select',  label: 'Liste de choix' },
  { value: 'boolean', label: 'Oui / Non' },
  { value: 'date',    label: 'Date' },
  { value: 'file',    label: 'Fichier / Photo' },
]

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

function ConfigRow({
  config,
  articleId,
  actionId,
}: {
  config: ActionMeasureConfig
  articleId: number
  actionId: number
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>({
    field_name:     config.field_name,
    field_type:     config.field_type,
    unit:           config.unit ?? '',
    min_value:      config.min_value ?? '',
    max_value:      config.max_value ?? '',
    select_options: (config.select_options ?? []).join(', '),
    is_required:    config.is_required,
    placeholder:    config.placeholder ?? '',
    help_text:      config.help_text ?? '',
    ordre:          config.ordre,
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

  const deleteMut = useMutation({
    mutationFn: () => measureConfigsApi.delete(articleId, actionId, config.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['measure-configs', actionId] }),
  })

  if (editing) {
    return (
      <tr>
        <td colSpan={7}>
          <MeasureConfigForm
            initial={form}
            onChange={setForm}
            onSubmit={(data) => updateMut.mutate(data)}
            onCancel={() => setEditing(false)}
            isPending={updateMut.isPending}
          />
        </td>
      </tr>
    )
  }

  const typeLabel = FIELD_TYPES.find((t) => t.value === config.field_type)?.label ?? config.field_type

  return (
    <tr>
      <td style={{ fontSize: '0.82rem' }}>{config.ordre}</td>
      <td><strong style={{ fontSize: '0.85rem' }}>{config.field_name}</strong></td>
      <td>
        <span className="badge">{typeLabel}</span>
        {config.unit && <span className="text-muted" style={{ marginLeft: 4, fontSize: '0.78rem' }}>{config.unit}</span>}
      </td>
      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
        {config.min_value != null && config.max_value != null
          ? `${config.min_value} – ${config.max_value}`
          : config.min_value != null ? `≥ ${config.min_value}`
          : config.max_value != null ? `≤ ${config.max_value}`
          : '—'}
      </td>
      <td>
        {config.is_required
          ? <span style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 600 }}>Requis</span>
          : <span className="text-muted" style={{ fontSize: '0.78rem' }}>Optionnel</span>}
      </td>
      <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {config.help_text || '—'}
      </td>
      <td style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>✏️</button>
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-danger-outline"
          disabled={deleteMut.isPending}
          onClick={() => { if (window.confirm('Supprimer ce champ ?')) deleteMut.mutate() }}
        >✕</button>
      </td>
    </tr>
  )
}

function MeasureConfigForm({
  initial,
  onChange,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial: FormState
  onChange: (f: FormState) => void
  onSubmit: (data: Partial<ActionMeasureConfig>) => void
  onCancel: () => void
  isPending: boolean
}) {
  const form = initial

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data: Partial<ActionMeasureConfig> = {
      field_name:     form.field_name,
      field_type:     form.field_type as ActionMeasureConfig['field_type'],
      unit:           form.unit || undefined,
      min_value:      form.min_value !== '' ? Number(form.min_value) : undefined,
      max_value:      form.max_value !== '' ? Number(form.max_value) : undefined,
      select_options: form.field_type === 'select'
        ? form.select_options.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      is_required:    form.is_required,
      placeholder:    form.placeholder || undefined,
      help_text:      form.help_text || undefined,
      ordre:          form.ordre !== '' ? Number(form.ordre) : 0,
    }
    onSubmit(data)
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ padding: '0.5rem', background: 'var(--color-surface)', borderRadius: 6, border: '1px solid var(--color-border)' }}
    >
      <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <label>
          Nom du champ *
          <input
            value={form.field_name}
            onChange={(e) => onChange({ ...form, field_name: e.target.value })}
            required
            placeholder="Ex: Résistance compression"
          />
        </label>
        <label>
          Type de champ *
          <select
            value={form.field_type}
            onChange={(e) => onChange({ ...form, field_type: e.target.value as FormState['field_type'] })}
          >
            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label>
          Unité
          <input
            value={form.unit}
            onChange={(e) => onChange({ ...form, unit: e.target.value })}
            placeholder="MPa, mm, °C…"
          />
        </label>
        {form.field_type === 'number' && (
          <>
            <label>
              Valeur min
              <input
                type="number" step="any"
                value={form.min_value}
                onChange={(e) => onChange({ ...form, min_value: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </label>
            <label>
              Valeur max
              <input
                type="number" step="any"
                value={form.max_value}
                onChange={(e) => onChange({ ...form, max_value: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </label>
          </>
        )}
        {form.field_type === 'select' && (
          <label style={{ gridColumn: '1 / -1' }}>
            Options (séparées par virgules)
            <input
              value={form.select_options}
              onChange={(e) => onChange({ ...form, select_options: e.target.value })}
              placeholder="Conforme, Non conforme, NA"
            />
          </label>
        )}
        <label>
          Texte d'aide
          <input
            value={form.help_text}
            onChange={(e) => onChange({ ...form, help_text: e.target.value })}
            placeholder="Instruction au remplissage…"
          />
        </label>
        <label>
          Ordre
          <input
            type="number" min={0}
            value={form.ordre}
            onChange={(e) => onChange({ ...form, ordre: e.target.value === '' ? '' : Number(e.target.value) })}
          />
        </label>
        <label className="quote-form-checkbox-row">
          <input
            type="checkbox"
            checked={form.is_required}
            onChange={(e) => onChange({ ...form, is_required: e.target.checked })}
          />
          Champ requis
        </label>
      </div>
      <div className="crud-actions" style={{ marginTop: '0.5rem' }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>
          {isPending ? '…' : 'Enregistrer'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Annuler</button>
      </div>
    </form>
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
  const [showForm, setShowForm] = useState(false)
  const [newForm, setNewForm] = useState<FormState>({
    field_name: '', field_type: 'number', unit: '',
    min_value: '', max_value: '', select_options: '',
    is_required: true, placeholder: '', help_text: '', ordre: 0,
  })
  const qc = useQueryClient()

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['measure-configs', actionId],
    queryFn: () => measureConfigsApi.list(articleId, actionId),
    staleTime: 60_000,
  })

  const createMut = useMutation({
    mutationFn: (data: Partial<ActionMeasureConfig>) =>
      measureConfigsApi.create(articleId, actionId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measure-configs', actionId] })
      setShowForm(false)
      setNewForm({ field_name: '', field_type: 'number', unit: '', min_value: '', max_value: '', select_options: '', is_required: true, placeholder: '', help_text: '', ordre: 0 })
    },
  })

  if (isLoading) return <p className="text-muted" style={{ fontSize: '0.82rem' }}>Chargement…</p>

  return (
    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          📋 Champs du formulaire {actionLabel && `— ${actionLabel}`}
        </span>
        <span className="badge">{configs.length}</span>
      </div>

      {configs.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: '0.5rem' }}>
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th>#</th>
                <th>Champ</th>
                <th>Type / Unité</th>
                <th>Bornes</th>
                <th>Requis</th>
                <th>Aide</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {configs.slice().sort((a, b) => a.ordre - b.ordre).map((c) => (
                <ConfigRow key={c.id} config={c} articleId={articleId} actionId={actionId} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm ? (
        <MeasureConfigForm
          initial={newForm}
          onChange={setNewForm}
          onSubmit={(data) => createMut.mutate(data)}
          onCancel={() => setShowForm(false)}
          isPending={createMut.isPending}
        />
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(true)}>
          + Ajouter un champ
        </button>
      )}
    </div>
  )
}
