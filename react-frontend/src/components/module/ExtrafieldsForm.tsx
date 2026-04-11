import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  extrafieldValuesApi,
  type ExtrafieldDefinitionRow,
  type ExtrafieldEntityType,
} from '../../api/client'

type Row = { definition: ExtrafieldDefinitionRow; value: string | null }

function coerceInput(def: ExtrafieldDefinitionRow, raw: string): string | number | boolean {
  switch (def.field_type) {
    case 'number':
      return raw === '' ? '' : Number(raw)
    case 'boolean':
      return raw === '1' || raw === 'true'
    default:
      return raw
  }
}

export default function ExtrafieldsForm({
  entityType,
  entityId,
  canEdit,
  title = 'Champs personnalisés (extrafields)',
}: {
  entityType: ExtrafieldEntityType
  entityId: number
  canEdit: boolean
  title?: string
}) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['extrafield-values', entityType, entityId],
    queryFn: () => extrafieldValuesApi.list(entityType, entityId),
    enabled: entityId > 0,
  })

  const rows: Row[] = data?.data ?? []
  const [local, setLocal] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!data?.data) return
    const m: Record<string, string> = {}
    for (const r of data.data) {
      const v = r.value
      if (r.definition.field_type === 'boolean') {
        m[r.definition.code] = v === '1' || v === 'true' ? '1' : '0'
      } else {
        m[r.definition.code] = v ?? ''
      }
    }
    setLocal(m)
    setDirty(false)
  }, [data])

  const syncMut = useMutation({
    mutationFn: () => {
      const values: Record<string, unknown> = {}
      for (const r of rows) {
        const code = r.definition.code
        const raw = local[code] ?? ''
        values[code] = coerceInput(r.definition, String(raw))
      }
      return extrafieldValuesApi.sync({ entity_type: entityType, entity_id: entityId, values })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extrafield-values', entityType, entityId] })
      setDirty(false)
    },
  })

  const defsSorted = useMemo(() => rows.map((r) => r.definition), [rows])

  if (entityId <= 0) return null
  if (isLoading) return <p style={{ color: 'var(--color-muted, #64748b)' }}>Chargement des champs…</p>
  if (error) return <p className="error">{(error as Error).message}</p>
  if (defsSorted.length === 0) {
    return (
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={{ margin: 0, color: 'var(--color-muted, #64748b)' }}>
          Aucun champ personnalisé défini pour ce module. Configurez-les dans le back office → Configuration.
        </p>
      </div>
    )
  }

  const renderField = (def: ExtrafieldDefinitionRow) => {
    const code = def.code
    const val = local[code] ?? ''

    const onChange = (next: string) => {
      setDirty(true)
      setLocal((prev) => ({ ...prev, [code]: next }))
    }

    if (def.field_type === 'textarea') {
      return (
        <textarea
          className="entity-meta-input"
          rows={3}
          value={val}
          disabled={!canEdit}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    }
    if (def.field_type === 'number') {
      return (
        <input
          type="number"
          step="any"
          className="entity-meta-input"
          value={val}
          disabled={!canEdit}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    }
    if (def.field_type === 'date') {
      return (
        <input type="date" className="entity-meta-input" value={val} disabled={!canEdit} onChange={(e) => onChange(e.target.value)} />
      )
    }
    if (def.field_type === 'boolean') {
      return (
        <select className="entity-meta-input" value={val} disabled={!canEdit} onChange={(e) => onChange(e.target.value)}>
          <option value="0">Non</option>
          <option value="1">Oui</option>
        </select>
      )
    }
    if (def.field_type === 'select') {
      const opts = def.select_options ?? []
      return (
        <select className="entity-meta-input" value={val} disabled={!canEdit} onChange={(e) => onChange(e.target.value)}>
          <option value="">{def.required ? '— Choisir —' : '—'}</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }
    return (
      <input type="text" className="entity-meta-input" value={val} disabled={!canEdit} onChange={(e) => onChange(e.target.value)} />
    )
  }

  return (
    <div className="card extrafields-form" style={{ marginTop: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div className="extrafields-form__grid">
        {defsSorted.map((def) => (
          <div key={def.id} className="form-group" style={{ marginBottom: 0 }}>
            <label>
              {def.label}
              {def.required ? <span style={{ color: '#b91c1c' }}> *</span> : null}
              <span style={{ fontWeight: 400, fontSize: '0.8rem', marginLeft: 6, color: 'var(--color-muted, #64748b)' }}>
                ({def.code})
              </span>
            </label>
            {renderField(def)}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="crud-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dirty || syncMut.isPending}
            onClick={() => syncMut.mutate()}
          >
            {syncMut.isPending ? 'Enregistrement…' : 'Enregistrer les champs personnalisés'}
          </button>
          {syncMut.isError ? <span className="error">{(syncMut.error as Error).message}</span> : null}
        </div>
      )}
    </div>
  )
}
