import { useState } from 'react'
import { taskTestFormsApi, type TestTypeFormColumn, type TestTypeFormField } from '../../api/client'
import TableFieldChart from './TableFieldChart'

type Photo = { id: number; field_key: string; original_name: string }

type Props = {
  taskId: number
  typeId: number
  fields: TestTypeFormField[]
  initialAnswers: Record<string, unknown>
  photos: Photo[]
  editable: boolean
  onChanged?: () => void
}

function ScalarInput({ field, value, onChange }: { field: TestTypeFormField | TestTypeFormColumn; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === 'formula') {
    return <span className="text-muted">{value == null ? 'Calculé à l’enregistrement' : String(value)}{field.unit ? ` ${field.unit}` : ''}</span>
  }
  if (field.type === 'boolean') {
    return <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
  }
  if (field.type === 'select') {
    return <select value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">—</option>
      {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  }
  if (field.type === 'checkboxes') {
    const selected = Array.isArray(value) ? value as string[] : []
    return <div className="test-form-editor__choices">
      {(field.options ?? []).map((option) => (
        <label key={option} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.75rem' }}>
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={(e) => onChange(e.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
          />
          {option}
        </label>
      ))}
    </div>
  }
  if (field.type === 'time') {
    return <input type="text" placeholder="HH:MM" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
  }
  if (field.type === 'duration') {
    return <input type="text" placeholder="HH:MM (durée)" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
  }
  if (field.type === 'date') {
    return <input type="date" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
  }
  if (field.type === 'number') {
    return <input type="text" inputMode="decimal" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value.replace(',', '.'))} />
  }
  return <input type="text" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
}

export default function TestFormWebEditor({ taskId, typeId, fields, initialAnswers, photos, editable, onChanged }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'docx' | 'xlsx' | null>(null)

  const downloadReport = async (format: 'docx' | 'xlsx') => {
    setDownloading(format)
    try {
      await taskTestFormsApi.downloadReport(taskId, typeId, format)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDownloading(null)
    }
  }

  const setValue = (key: string, value: unknown) => setAnswers((current) => ({ ...current, [key]: value }))

  const run = async (action: () => Promise<{ answers: Record<string, unknown> } | unknown>, successMessage: string) => {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      if (result && typeof result === 'object' && 'answers' in result) {
        setAnswers((result as { answers: Record<string, unknown> }).answers)
      }
      setMessage(successMessage)
      onChanged?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const uploadPhoto = async (field: TestTypeFormField, file: File) => {
    await run(() => taskTestFormsApi.uploadPhoto(taskId, typeId, field.key, file), 'Photo ajoutée.')
  }

  return <div className="test-form-web-editor">
    {message ? <p className="text-muted">{message}</p> : null}
    {error ? <p className="error">{error}</p> : null}
    {fields.map((field) => {
      const value = answers[field.key]
      return <div key={field.key} className="form-group">
        <label>{field.label}{field.unit ? ` (${field.unit})` : ''}{field.required ? ' *' : ''}</label>
        {field.help ? <p className="text-muted" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem' }}>{field.help}</p> : null}
        {field.type === 'photo' ? <div>
          {photos.filter((p) => p.field_key === field.key).map((p) => <div key={p.id} className="text-muted">📷 {p.original_name}</div>)}
          {editable ? <input type="file" accept="image/*" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPhoto(field, file); e.target.value = '' }} /> : null}
        </div> : field.type === 'table' ? <div>
          <div className="table-wrap"><table className="data-table data-table--compact"><thead><tr>
            {(field.columns ?? []).map((column) => <th key={column.key}>{column.label}</th>)}
            {editable ? <th /> : null}
          </tr></thead><tbody>
            {(Array.isArray(value) ? value as Record<string, unknown>[] : []).map((row, rowIndex, allRows) => <tr key={rowIndex}>
              {(field.columns ?? []).map((column) => <td key={column.key}>
                {editable ? <ScalarInput field={column} value={row[column.key]} onChange={(v) => setValue(field.key, allRows.map((item, i) => i === rowIndex ? { ...item, [column.key]: v } : item))} /> : String(row[column.key] ?? '—')}
              </td>)}
              {editable ? <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => setValue(field.key, allRows.filter((_, i) => i !== rowIndex))}>×</button></td> : null}
            </tr>)}
          </tbody></table></div>
          {editable ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setValue(field.key, [...(Array.isArray(value) ? value as Record<string, unknown>[] : []), {}])}>+ Ajouter une ligne</button> : null}
          <TableFieldChart field={field} rows={Array.isArray(value) ? value as Record<string, unknown>[] : []} />
        </div> : <ScalarInput field={field} value={value} onChange={(v) => setValue(field.key, v)} />}
      </div>
    })}
    {editable ? <div className="crud-actions">
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(() => taskTestFormsApi.save(taskId, typeId, answers), 'Brouillon enregistré.')}>Enregistrer</button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(async () => {
        await taskTestFormsApi.save(taskId, typeId, answers)
        await taskTestFormsApi.submit(taskId, typeId)
      }, 'Formulaire soumis pour validation.')}>Soumettre</button>
      <button type="button" className="btn btn-secondary" disabled={downloading === 'docx'} onClick={() => void downloadReport('docx')}>
        {downloading === 'docx' ? 'Génération…' : '📄 Imprimer (Word)'}
      </button>
      <button type="button" className="btn btn-secondary" disabled={downloading === 'xlsx'} onClick={() => void downloadReport('xlsx')}>
        {downloading === 'xlsx' ? 'Génération…' : '📊 Imprimer (Excel)'}
      </button>
    </div> : null}
  </div>
}
