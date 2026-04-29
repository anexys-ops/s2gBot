import { useMemo, useState } from 'react'
import {
  CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import './DynamicForm.css'

/**
 * v1.2.0 — Formulaires dynamiques (FormTemplate → DynamicForm)
 *
 * Génère un formulaire à partir d'une définition JSON (`fields`).
 * Types supportés : number, text, photo, graph, table, coordinates, file.
 *
 * Pas de dépendance externe en plus de celles déjà présentes (recharts).
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type DynamicFieldType =
  | 'number'
  | 'text'
  | 'photo'
  | 'graph'
  | 'table'
  | 'coordinates'
  | 'file'

export type DynamicFieldColumn = { key: string; label: string }

export type DynamicField = {
  key: string
  type: DynamicFieldType
  label: string
  unit?: string
  required?: boolean
  multiline?: boolean
  computed?: boolean // valeur calculée — affichée en lecture seule
  // table
  columns?: DynamicFieldColumn[]
  // graph
  source?: string // clé d'un champ table source
  x?: string // colonne X
  y?: string | string[] // colonne(s) Y
  // file/photo
  accept?: string
  // coordinates
  defaultLat?: number
  defaultLng?: number
}

export type DynamicFormValues = Record<string, unknown>

export type DynamicFormProps = {
  fields: DynamicField[]
  value: DynamicFormValues
  onChange: (next: DynamicFormValues) => void
  readOnly?: boolean
  /** Upload handler pour les champs photo/file. Reçoit le File et doit renvoyer une URL/path persistée. */
  onUpload?: (field: DynamicField, file: File) => Promise<string>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function setKey<T extends Record<string, unknown>>(obj: T, key: string, val: unknown): T {
  return { ...obj, [key]: val }
}

function asNumber(v: unknown): number | '' {
  if (v === '' || v === null || v === undefined) return ''
  const n = Number(v)
  return Number.isFinite(n) ? n : ''
}

function asTableRows(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function NumberField({ field, value, onChange, readOnly }: {
  field: DynamicField; value: unknown; onChange: (v: number | '') => void; readOnly?: boolean
}) {
  const v = asNumber(value)
  const disabled = readOnly || field.computed
  return (
    <label className="dynform-field">
      <span className="dynform-label">
        {field.label}{field.unit ? ` (${field.unit})` : ''}{field.required && <span className="dynform-req"> *</span>}
        {field.computed && <span className="dynform-tag">calculé</span>}
      </span>
      <input
        type="number"
        step="any"
        value={v}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="dynform-input"
      />
    </label>
  )
}

function TextField({ field, value, onChange, readOnly }: {
  field: DynamicField; value: unknown; onChange: (v: string) => void; readOnly?: boolean
}) {
  const v = typeof value === 'string' ? value : ''
  const disabled = readOnly || field.computed
  return (
    <label className="dynform-field">
      <span className="dynform-label">
        {field.label}{field.required && <span className="dynform-req"> *</span>}
      </span>
      {field.multiline ? (
        <textarea
          value={v}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="dynform-input"
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={v}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="dynform-input"
        />
      )}
    </label>
  )
}

function FileField({ field, value, onChange, readOnly, onUpload }: {
  field: DynamicField; value: unknown; onChange: (v: string) => void; readOnly?: boolean
  onUpload?: (f: File) => Promise<string>
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const v = typeof value === 'string' ? value : ''
  const isImage = field.type === 'photo'

  const handle = async (file: File) => {
    setErr(null)
    if (!onUpload) {
      // Fallback : on stocke le nom + une data URL pour aperçu local
      const reader = new FileReader()
      reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : file.name)
      reader.readAsDataURL(file)
      return
    }
    setBusy(true)
    try {
      const url = await onUpload(file)
      onChange(url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Échec du téléversement")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dynform-field">
      <span className="dynform-label">
        {field.label}{field.required && <span className="dynform-req"> *</span>}
      </span>
      {!readOnly && (
        <input
          type="file"
          accept={field.accept ?? (isImage ? 'image/*' : undefined)}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handle(f)
          }}
          disabled={busy}
        />
      )}
      {busy && <span className="dynform-hint">Téléversement…</span>}
      {err && <span className="dynform-error">{err}</span>}
      {v && (
        isImage ? (
          <img src={v} alt={field.label} className="dynform-preview" />
        ) : (
          <a href={v} target="_blank" rel="noreferrer" className="dynform-link">{v.split('/').pop() || v}</a>
        )
      )}
    </div>
  )
}

function CoordinatesField({ field, value, onChange, readOnly }: {
  field: DynamicField; value: unknown; onChange: (v: { lat: number; lng: number }) => void; readOnly?: boolean
}) {
  const v = (value && typeof value === 'object') ? value as { lat?: number; lng?: number } : {}
  const lat = typeof v.lat === 'number' ? v.lat : (field.defaultLat ?? '')
  const lng = typeof v.lng === 'number' ? v.lng : (field.defaultLng ?? '')

  const requestGps = () => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 5000 },
    )
  }

  return (
    <div className="dynform-field">
      <span className="dynform-label">
        {field.label}{field.required && <span className="dynform-req"> *</span>}
      </span>
      <div className="dynform-row">
        <input
          type="number" step="any" placeholder="Latitude"
          value={lat}
          disabled={readOnly}
          onChange={(e) => onChange({ lat: Number(e.target.value), lng: typeof lng === 'number' ? lng : 0 })}
          className="dynform-input"
        />
        <input
          type="number" step="any" placeholder="Longitude"
          value={lng}
          disabled={readOnly}
          onChange={(e) => onChange({ lat: typeof lat === 'number' ? lat : 0, lng: Number(e.target.value) })}
          className="dynform-input"
        />
        {!readOnly && (
          <button type="button" onClick={requestGps} className="dynform-btn">📍 GPS</button>
        )}
      </div>
    </div>
  )
}

function TableField({ field, value, onChange, readOnly }: {
  field: DynamicField; value: unknown; onChange: (v: Record<string, unknown>[]) => void; readOnly?: boolean
}) {
  const cols = field.columns ?? []
  const rows = asTableRows(value)

  const addRow = () => {
    const empty: Record<string, unknown> = {}
    cols.forEach((c) => { empty[c.key] = '' })
    onChange([...rows, empty])
  }
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx))
  const updateCell = (idx: number, key: string, val: string) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r))
    onChange(next)
  }

  return (
    <div className="dynform-field dynform-table-wrap">
      <span className="dynform-label">
        {field.label}{field.required && <span className="dynform-req"> *</span>}
      </span>
      <table className="dynform-table">
        <thead>
          <tr>
            {cols.map((c) => <th key={c.key}>{c.label}</th>)}
            {!readOnly && <th aria-label="actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length + (readOnly ? 0 : 1)} className="dynform-empty">Aucune ligne</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c.key}>
                  <input
                    type="text"
                    value={typeof r[c.key] === 'string' || typeof r[c.key] === 'number' ? String(r[c.key]) : ''}
                    disabled={readOnly}
                    onChange={(e) => updateCell(i, c.key, e.target.value)}
                    className="dynform-input dynform-input-sm"
                  />
                </td>
              ))}
              {!readOnly && (
                <td>
                  <button type="button" onClick={() => removeRow(i)} className="dynform-btn dynform-btn-danger" aria-label="Supprimer ligne">×</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <button type="button" onClick={addRow} className="dynform-btn">+ Ajouter une ligne</button>
      )}
    </div>
  )
}

function GraphField({ field, allValues }: { field: DynamicField; allValues: DynamicFormValues }) {
  const sourceKey = field.source
  const sourceRows = useMemo(() => {
    if (!sourceKey) return []
    return asTableRows(allValues[sourceKey]).map((r) => {
      const out: Record<string, number | string> = {}
      Object.entries(r).forEach(([k, v]) => {
        const n = Number(v)
        out[k] = Number.isFinite(n) && v !== '' && v !== null ? n : (v as string)
      })
      return out
    })
  }, [sourceKey, allValues])

  const yKeys: string[] = Array.isArray(field.y) ? field.y : (field.y ? [field.y] : [])
  const xKey = field.x ?? 'x'

  return (
    <div className="dynform-field">
      <span className="dynform-label">{field.label}</span>
      {sourceRows.length === 0 ? (
        <p className="dynform-hint">Aucune donnée — saisir des lignes dans « {sourceKey ?? '—'} » pour afficher la courbe.</p>
      ) : (
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={sourceRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {yKeys.map((yk, i) => (
                <Line key={yk} type="monotone" dataKey={yk} stroke={i === 0 ? '#3B82F6' : '#A16207'} dot />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function DynamicForm({ fields, value, onChange, readOnly, onUpload }: DynamicFormProps) {
  const setField = (key: string, v: unknown) => onChange(setKey(value, key, v))

  return (
    <div className="dynform">
      {fields.map((f) => {
        const v = value[f.key]
        switch (f.type) {
          case 'number':
            return <NumberField key={f.key} field={f} value={v} readOnly={readOnly} onChange={(nv) => setField(f.key, nv)} />
          case 'text':
            return <TextField key={f.key} field={f} value={v} readOnly={readOnly} onChange={(nv) => setField(f.key, nv)} />
          case 'photo':
          case 'file':
            return (
              <FileField
                key={f.key} field={f} value={v} readOnly={readOnly}
                onUpload={onUpload ? ((file) => onUpload(f, file)) : undefined}
                onChange={(nv) => setField(f.key, nv)}
              />
            )
          case 'coordinates':
            return <CoordinatesField key={f.key} field={f} value={v} readOnly={readOnly} onChange={(nv) => setField(f.key, nv)} />
          case 'table':
            return <TableField key={f.key} field={f} value={v} readOnly={readOnly} onChange={(nv) => setField(f.key, nv)} />
          case 'graph':
            return <GraphField key={f.key} field={f} allValues={value} />
          default:
            return null
        }
      })}
    </div>
  )
}
