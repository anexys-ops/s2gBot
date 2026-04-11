import { useEffect, useState } from 'react'
import type { EntityMetaPayload } from '../../api/client'
import { normalizeEntityMeta, serializeMetaForApi } from '../../lib/entityMeta'

type Row = { key: string; value: string }

function rowsFromRecord(rec: Record<string, string>): Row[] {
  const entries = Object.entries(rec)
  if (entries.length === 0) return [{ key: '', value: '' }]
  return entries.map(([key, value]) => ({ key, value }))
}

function recordFromRows(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    const k = r.key.trim()
    if (k) out[k] = r.value
  }
  return out
}

type Props = {
  title?: string
  /** Données brutes renvoyées par l’API (`order.meta`, etc.) */
  meta: unknown
  editable: boolean
  onSave?: (meta: EntityMetaPayload) => void | Promise<unknown>
  isSaving?: boolean
  saveError?: string | null
}

export default function EntityMetaCard({
  title = 'Indicateurs & champs personnalisés',
  meta,
  editable,
  onSave,
  isSaving,
  saveError,
}: Props) {
  const normalized = normalizeEntityMeta(meta)
  const [indRows, setIndRows] = useState<Row[]>(() => rowsFromRecord(normalized.indicateurs ?? {}))
  const [cpRows, setCpRows] = useState<Row[]>(() => rowsFromRecord(normalized.champs_perso ?? {}))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const n = normalizeEntityMeta(meta)
    setIndRows(rowsFromRecord(n.indicateurs ?? {}))
    setCpRows(rowsFromRecord(n.champs_perso ?? {}))
    setDirty(false)
  }, [meta])

  const readOnly = !editable || !onSave

  const payload = (): EntityMetaPayload =>
    serializeMetaForApi({
      indicateurs: recordFromRows(indRows),
      champs_perso: recordFromRows(cpRows),
    })

  const handleSave = async () => {
    if (!onSave) return
    await onSave(payload())
    setDirty(false)
  }

  const renderSection = (
    label: string,
    hint: string,
    rows: Row[],
    setRows: (r: Row[]) => void,
  ) => (
    <div className="entity-meta-section">
      <h3 className="entity-meta-section__title">{label}</h3>
      <p className="entity-meta-section__hint">{hint}</p>
      {readOnly && rows.every((r) => !r.key && !r.value) ? (
        <p className="entity-meta-empty">Aucune donnée.</p>
      ) : (
        <ul className="entity-meta-rows">
          {rows.map((row, i) => (
            <li key={i} className="entity-meta-row">
              {readOnly ? (
                <>
                  <span className="entity-meta-k">{row.key || '—'}</span>
                  <span className="entity-meta-v">{row.value || '—'}</span>
                </>
              ) : (
                <>
                  <input
                    className="entity-meta-input entity-meta-input--key"
                    placeholder="Libellé"
                    value={row.key}
                    onChange={(e) => {
                      setDirty(true)
                      setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
                    }}
                  />
                  <input
                    className="entity-meta-input"
                    placeholder="Valeur"
                    value={row.value}
                    onChange={(e) => {
                      setDirty(true)
                      setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm entity-meta-remove"
                    onClick={() => {
                      setDirty(true)
                      setRows(rows.filter((_, j) => j !== i))
                    }}
                  >
                    Retirer
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setDirty(true)
            setRows([...rows, { key: '', value: '' }])
          }}
        >
          + Ligne
        </button>
      )}
    </div>
  )

  return (
    <div className="card entity-meta-card">
      <h2 className="entity-meta-card__title">{title}</h2>
      {renderSection(
        'Indicateurs',
        'Valeurs numériques ou libellés à suivre (ex. priorité, score, objectif).',
        indRows,
        setIndRows,
      )}
      {renderSection(
        'Champs personnalisés',
        'Informations libres (références internes, codes métiers, annotations).',
        cpRows,
        setCpRows,
      )}
      {!readOnly && (
        <div className="entity-meta-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={isSaving || !dirty}
            onClick={() => void handleSave()}
          >
            {isSaving ? 'Enregistrement…' : 'Enregistrer indicateurs & champs'}
          </button>
          {saveError ? <p className="error">{saveError}</p> : null}
        </div>
      )}
    </div>
  )
}
