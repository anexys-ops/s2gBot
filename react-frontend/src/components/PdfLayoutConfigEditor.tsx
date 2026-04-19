import { useEffect, useState } from 'react'

export type PdfLayoutConfig = Record<string, unknown>

type Props = {
  layoutConfig: PdfLayoutConfig
  onSave: (parsed: PdfLayoutConfig) => Promise<void>
  disabled?: boolean
}

export default function PdfLayoutConfigEditor({ layoutConfig, onSave, disabled }: Props) {
  const [text, setText] = useState(() => JSON.stringify(layoutConfig, null, 2))
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setText(JSON.stringify(layoutConfig, null, 2))
  }, [layoutConfig])

  async function handleSave() {
    setErr(null)
    let parsed: PdfLayoutConfig
    try {
      parsed = JSON.parse(text) as PdfLayoutConfig
    } catch {
      setErr('JSON invalide.')
      return
    }
    setSaving(true)
    try {
      await onSave(parsed)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', margin: '0 0 0.5rem', maxWidth: '72ch', lineHeight: 1.45 }}>
        Schéma : <code>export_pdf</code>, <code>export_docx</code> (réservé, pas encore généré côté serveur),{' '}
        <code>header.show_logo</code>, <code>header.show_signature_block</code>, <code>header.photo_slots</code> (0–3),{' '}
        <code>extra_fields</code> comme liste de <code>{'{ key, label, type }'}</code> (<code>type</code> : <code>text</code> ou{' '}
        <code>image</code> pour une data URL dans le formulaire / <code>formData</code> du rapport).
      </p>
      <textarea
        className="input"
        rows={14}
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled || saving}
        style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
      />
      {err ? <p className="error" style={{ marginTop: '0.35rem' }}>{err}</p> : null}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ marginTop: '0.5rem' }}
        disabled={disabled || saving}
        onClick={() => void handleSave()}
      >
        {saving ? 'Enregistrement…' : 'Enregistrer la mise en page'}
      </button>
    </div>
  )
}
