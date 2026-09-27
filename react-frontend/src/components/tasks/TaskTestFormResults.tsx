import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { taskTestFormsApi, type TaskTestFormSummary, type TestTypeFormField } from '../../api/client'
import type { ReactNode } from 'react'

type RawAnswers = Record<string, unknown>

function rawFromAnswer(field: TestTypeFormField, answer: unknown): unknown {
  if (field.type === 'boolean') return answer === true ? 'true' : answer === false ? 'false' : ''
  if (field.type === 'checkboxes') return Array.isArray(answer) ? answer.map(String) : []
  if (field.type === 'table') {
    if (!Array.isArray(answer)) return []
    return answer.map((row) => {
      const raw: RawAnswers = {}
      for (const column of field.columns ?? []) {
        raw[column.key] = rawFromAnswer(column as TestTypeFormField, (row as Record<string, unknown>)?.[column.key])
      }
      return raw
    })
  }
  if (answer == null) return ''
  return String(answer)
}

function initRawAnswers(fields: TestTypeFormField[], answers: RawAnswers | undefined): RawAnswers {
  const raw: RawAnswers = {}
  for (const field of fields) {
    raw[field.key] = rawFromAnswer(field, answers?.[field.key])
  }
  return raw
}

function payloadFromRaw(field: TestTypeFormField, raw: unknown): unknown {
  if (field.type === 'formula' || field.type === 'photo') return undefined
  if (field.type === 'boolean') return raw === 'true' ? true : raw === 'false' ? false : null
  if (field.type === 'number') return raw === '' || raw == null ? null : Number(raw)
  if (field.type === 'checkboxes') return Array.isArray(raw) ? raw : []
  if (field.type === 'table') {
    const rows = Array.isArray(raw) ? raw : []
    return rows.map((row) => {
      const out: RawAnswers = {}
      for (const column of field.columns ?? []) {
        const value = payloadFromRaw(column as TestTypeFormField, (row as Record<string, unknown>)?.[column.key])
        if (value !== undefined) out[column.key] = value
      }
      return out
    })
  }
  return raw === '' || raw == null ? null : raw
}

function buildAnswersPayload(fields: TestTypeFormField[], raw: RawAnswers): RawAnswers {
  const payload: RawAnswers = {}
  for (const field of fields) {
    const value = payloadFromRaw(field, raw[field.key])
    if (value !== undefined) payload[field.key] = value
  }
  return payload
}

function ScalarAnswerInput({ field, value, onChange }: {
  field: TestTypeFormField
  value: string
  onChange: (v: string) => void
}) {
  switch (field.type) {
    case 'select':
      return <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    case 'boolean':
      return <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        <option value="true">Oui</option>
        <option value="false">Non</option>
      </select>
    case 'date':
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    case 'time':
      return <input type="time" value={value} onChange={(e) => onChange(e.target.value)} />
    case 'duration':
      return <input type="text" value={value} placeholder="H:MM" onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return <input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
    default:
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
  }
}

function AnswerField({ field, raw, onChange }: {
  field: TestTypeFormField
  raw: unknown
  onChange: (v: unknown) => void
}) {
  if (field.type === 'formula') {
    return (
      <div className="task-test-form-fill__field">
        <span className="task-test-form-fill__label">{field.label}{field.unit ? ` (${field.unit})` : ''}</span>
        <strong>{raw === '' || raw == null ? '—' : String(raw)}</strong>
        <span className="text-muted task-test-form-fill__hint">Calculé automatiquement à l'enregistrement</span>
      </div>
    )
  }

  if (field.type === 'checkboxes') {
    const selected = Array.isArray(raw) ? raw as string[] : []
    return (
      <div className="task-test-form-fill__field">
        <span className="task-test-form-fill__label">{field.label}{field.required && <span className="task-test-form-fill__req"> *</span>}</span>
        <div className="task-test-form-fill__checkboxes">
          {(field.options ?? []).map((o) => (
            <label key={o} className="task-test-form-fill__checkbox">
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((v) => v !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'table') {
    const rows = Array.isArray(raw) ? raw as RawAnswers[] : []
    const columns = field.columns ?? []
    return (
      <div className="task-test-form-fill__field task-test-form-fill__field--table">
        <span className="task-test-form-fill__label">{field.label}{field.required && <span className="task-test-form-fill__req"> *</span>}</span>
        <div className="table-wrap">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                <th aria-hidden style={{ width: '2rem' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      <ScalarAnswerInput
                        field={column as TestTypeFormField}
                        value={typeof row[column.key] === 'string' ? row[column.key] as string : ''}
                        onChange={(v) => {
                          const nextRows = rows.map((r, i) => i === rowIndex ? { ...r, [column.key]: v } : r)
                          onChange(nextRows)
                        }}
                      />
                    </td>
                  ))}
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(rows.filter((_, i) => i !== rowIndex))}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onChange([...rows, Object.fromEntries(columns.map((c) => [c.key, '']))])}
        >
          + Ligne
        </button>
      </div>
    )
  }

  return (
    <div className="task-test-form-fill__field">
      <span className="task-test-form-fill__label">
        {field.label}
        {field.required && <span className="task-test-form-fill__req"> *</span>}
        {field.unit && <span className="text-muted task-test-form-fill__unit"> {field.unit}</span>}
      </span>
      {field.help && <span className="text-muted task-test-form-fill__hint">{field.help}</span>}
      <ScalarAnswerInput field={field} value={typeof raw === 'string' ? raw : ''} onChange={onChange} />
    </div>
  )
}

function FormFillCard({ taskId, form, onOpenPhoto }: {
  taskId: number
  form: TaskTestFormSummary
  onOpenPhoto?: (photoId: number) => void
}) {
  const qc = useQueryClient()
  const typeId = form.test_type.id
  const [raw, setRaw] = useState<RawAnswers>(() => initRawAnswers(form.form_fields, form.submission?.answers))
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['task-test-forms', taskId] })

  const save = useMutation({
    mutationFn: () => taskTestFormsApi.save(taskId, typeId, buildAnswersPayload(form.form_fields, raw)),
    onSuccess: () => invalidate(),
  })

  const submit = useMutation({
    mutationFn: async () => {
      await taskTestFormsApi.save(taskId, typeId, buildAnswersPayload(form.form_fields, raw))
      return taskTestFormsApi.submit(taskId, typeId)
    },
    onSuccess: () => invalidate(),
  })

  const uploadPhoto = async (field: TestTypeFormField, file: File) => {
    setUploadingKey(field.key)
    try {
      if (!form.submission) {
        await taskTestFormsApi.save(taskId, typeId, buildAnswersPayload(form.form_fields, raw))
      }
      await taskTestFormsApi.uploadPhoto(taskId, typeId, field.key, file)
      invalidate()
    } catch (error) {
      window.alert((error as Error).message)
    } finally {
      setUploadingKey(null)
    }
  }

  const error = save.error || submit.error
  const photosByField = new Map<string, NonNullable<TaskTestFormSummary['submission']>['photos']>()
  for (const photo of form.submission?.photos ?? []) {
    const list = photosByField.get(photo.field_key) ?? []
    list.push(photo)
    photosByField.set(photo.field_key, list)
  }

  return (
    <div className="task-test-form-fill">
      {form.submission?.correction_note && (
        <p className="task-test-form-fill__correction">Correction demandée : {form.submission.correction_note}</p>
      )}
      <div className="task-test-form-fill__grid">
        {form.form_fields.filter((f) => f.type !== 'photo').map((field) => (
          <AnswerField
            key={field.key}
            field={field}
            raw={raw[field.key]}
            onChange={(v) => setRaw((prev) => ({ ...prev, [field.key]: v }))}
          />
        ))}
      </div>
      {form.form_fields.filter((f) => f.type === 'photo').map((field) => (
        <div key={field.key} className="task-test-form-fill__field">
          <span className="task-test-form-fill__label">{field.label}{field.required && <span className="task-test-form-fill__req"> *</span>}</span>
          <div className="task-test-form-fill__photos">
            {(photosByField.get(field.key) ?? []).map((photo) => (
              <button key={photo.id} type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenPhoto?.(photo.id)}>
                {photo.original_name}
              </button>
            ))}
          </div>
          <input
            type="file"
            accept="image/*"
            disabled={uploadingKey === field.key}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPhoto(field, file); e.target.value = '' }}
          />
        </div>
      ))}
      {error && <p className="error">{(error as Error).message}</p>}
      <div className="crud-actions">
        <button type="button" className="btn btn-secondary btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? 'Envoi…' : 'Soumettre le formulaire'}
        </button>
      </div>
    </div>
  )
}

export default function TaskTestFormResults({ forms, taskId, onOpenPhoto, renderActions, canFill }: {
  forms: TaskTestFormSummary[]
  taskId?: number
  onOpenPhoto?: (photoId: number) => void
  renderActions?: (form: TaskTestFormSummary) => ReactNode
  canFill?: boolean
}) {
  const [downloading, setDownloading] = useState<string | null>(null)

  if (forms.length === 0) return <p className="text-muted">Aucun formulaire d’essai associé à cette tâche.</p>

  const downloadReport = async (typeId: number, format: 'docx' | 'xlsx') => {
    if (!taskId) return
    const key = `${typeId}-${format}`
    setDownloading(key)
    try {
      await taskTestFormsApi.downloadReport(taskId, typeId, format)
    } catch (error) {
      window.alert((error as Error).message)
    } finally {
      setDownloading(null)
    }
  }

  return <div className="task-test-results">
    {forms.map((form) => {
      const fillable = canFill && taskId && (!form.submission || ['draft', 'correction_requested'].includes(form.submission.status))
      return <section key={form.test_type.id} className="task-test-results__form">
        <h3>{form.test_type.name} <small>· {form.submission?.status ?? 'À remplir'}</small></h3>
        {form.test_type.norm ? <p className="text-muted">Norme : {form.test_type.norm}</p> : null}
        {form.test_type.description ? <p className="text-muted">{form.test_type.description}</p> : null}
        {fillable ? (
          <FormFillCard key={`${form.test_type.id}-${form.submission?.status ?? 'new'}`} taskId={taskId!} form={form} onOpenPhoto={onOpenPhoto} />
        ) : <>
          {form.submission?.correction_note ? <p>Correction demandée : {form.submission.correction_note}</p> : null}
          {form.submission ? <dl>{form.form_fields.filter((field) => field.type !== 'photo').map((field) => {
            const value = form.submission?.answers?.[field.key]
            return <div key={field.key}><dt>{field.label}{field.help ? <div className="text-muted mission-task-list__sub">{field.help}</div> : null}</dt><dd>
              {field.type === 'table' && Array.isArray(value) ? <div className="table-wrap"><table className="data-table data-table--compact"><thead><tr>{field.columns?.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>
                {value.map((row: Record<string, unknown>, index: number) => <tr key={index}>{field.columns?.map((column) => <td key={column.key}>{String(row[column.key] ?? '—')}</td>)}</tr>)}
              </tbody></table></div> : typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : Array.isArray(value) ? value.join(', ') : String(value ?? '—')}{field.unit ? ` ${field.unit}` : ''}
            </dd></div>
          })}</dl> : <p className="text-muted">Le formulaire n’a pas encore été rempli.</p>}
          {form.submission?.photos?.map((photo) => onOpenPhoto ? <button key={photo.id} type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenPhoto(photo.id)}>Voir la photo : {photo.original_name}</button> : <span key={photo.id}>{photo.original_name}</span>)}
        </>}
        {form.submission && taskId ? <div className="crud-actions">
          <button type="button" className="btn btn-secondary btn-sm" disabled={downloading === `${form.test_type.id}-docx`} onClick={() => void downloadReport(form.test_type.id, 'docx')}>
            {downloading === `${form.test_type.id}-docx` ? 'Génération…' : '📄 Rapport Word'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={downloading === `${form.test_type.id}-xlsx`} onClick={() => void downloadReport(form.test_type.id, 'xlsx')}>
            {downloading === `${form.test_type.id}-xlsx` ? 'Génération…' : '📊 Rapport Excel'}
          </button>
        </div> : null}
        {renderActions?.(form)}
      </section>
    })}
  </div>
}
