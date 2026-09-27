import { useState } from 'react'
import { taskTestFormsApi, type TaskTestFormSummary } from '../../api/client'
import type { ReactNode } from 'react'

export default function TaskTestFormResults({ forms, taskId, onOpenPhoto, renderActions }: {
  forms: TaskTestFormSummary[]
  taskId?: number
  onOpenPhoto?: (photoId: number) => void
  renderActions?: (form: TaskTestFormSummary) => ReactNode
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
    {forms.map((form) => <section key={form.test_type.id} className="task-test-results__form">
      <h3>{form.test_type.name} <small>· {form.submission?.status ?? 'À remplir'}</small></h3>
      {form.test_type.norm ? <p className="text-muted">Norme : {form.test_type.norm}</p> : null}
      {form.test_type.description ? <p className="text-muted">{form.test_type.description}</p> : null}
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
      {form.submission && taskId ? <div className="crud-actions">
        <button type="button" className="btn btn-secondary btn-sm" disabled={downloading === `${form.test_type.id}-docx`} onClick={() => void downloadReport(form.test_type.id, 'docx')}>
          {downloading === `${form.test_type.id}-docx` ? 'Génération…' : '📄 Rapport Word'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={downloading === `${form.test_type.id}-xlsx`} onClick={() => void downloadReport(form.test_type.id, 'xlsx')}>
          {downloading === `${form.test_type.id}-xlsx` ? 'Génération…' : '📊 Rapport Excel'}
        </button>
      </div> : null}
      {renderActions?.(form)}
    </section>)}
  </div>
}
