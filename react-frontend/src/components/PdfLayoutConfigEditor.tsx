import { useCallback, useEffect, useState } from 'react'
import type { PdfLayoutConfig } from '../api/client'
import {
  emptyExtraField,
  formToLayoutConfigPayload,
  layoutConfigToForm,
  validateLayoutForm,
  type PdfLayoutConfigForm,
  type PdfLayoutExtraFieldRow,
} from '../lib/pdfLayoutConfig'

type Props = {
  layoutConfig: PdfLayoutConfig
  onSave: (parsed: PdfLayoutConfig) => Promise<void>
  disabled?: boolean
}

export default function PdfLayoutConfigEditor({ layoutConfig, onSave, disabled }: Props) {
  const [form, setForm] = useState<PdfLayoutConfigForm>(() => layoutConfigToForm(layoutConfig))
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(layoutConfigToForm(layoutConfig))
    setErr(null)
  }, [layoutConfig])

  const setHeader = useCallback((patch: Partial<PdfLayoutConfigForm['header']>) => {
    setForm((f) => ({ ...f, header: { ...f.header, ...patch } }))
  }, [])

  const updateField = useCallback((index: number, patch: Partial<PdfLayoutExtraFieldRow>) => {
    setForm((f) => {
      const extra_fields = f.extra_fields.map((row, i) => (i === index ? { ...row, ...patch } : row))
      return { ...f, extra_fields }
    })
  }, [])

  const removeField = useCallback((index: number) => {
    setForm((f) => ({
      ...f,
      extra_fields: f.extra_fields.filter((_, i) => i !== index),
    }))
  }, [])

  const addField = useCallback(() => {
    setForm((f) => ({
      ...f,
      extra_fields: [...f.extra_fields, emptyExtraField()],
    }))
  }, [])

  async function handleSave() {
    setErr(null)
    const msg = validateLayoutForm(form)
    if (msg) {
      setErr(msg)
      return
    }
    setSaving(true)
    try {
      await onSave(formToLayoutConfigPayload(form))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setForm(layoutConfigToForm(layoutConfig))
    setErr(null)
  }

  return (
    <div className="pdf-layout-editor">
      <p className="pdf-layout-editor__intro">
        Options fusionnées avec les valeurs serveur. Les champs configurés alimentent le tableau « champs du modèle » sur les
        rapports (clés = données <code>formData</code>). <strong>Export Word</strong> reste indicatif tant que la génération
        n’est pas activée côté API.
      </p>

      <section className="pdf-layout-editor__section">
        <h3 className="pdf-layout-editor__h">Exports</h3>
        <label className="pdf-layout-editor__check">
          <input
            type="checkbox"
            checked={form.export_pdf}
            onChange={(e) => setForm((f) => ({ ...f, export_pdf: e.target.checked }))}
            disabled={disabled || saving}
          />
          Générer le PDF
        </label>
        <label className="pdf-layout-editor__check">
          <input
            type="checkbox"
            checked={form.export_docx}
            onChange={(e) => setForm((f) => ({ ...f, export_docx: e.target.checked }))}
            disabled={disabled || saving}
          />
          Prévoir l’export Word (bientôt)
        </label>
      </section>

      <section className="pdf-layout-editor__section">
        <h3 className="pdf-layout-editor__h">En-tête PDF</h3>
        <label className="pdf-layout-editor__check">
          <input
            type="checkbox"
            checked={form.header.show_logo}
            onChange={(e) => setHeader({ show_logo: e.target.checked })}
            disabled={disabled || saving}
          />
          Afficher le logo (charte / paramètres)
        </label>
        <label className="pdf-layout-editor__check">
          <input
            type="checkbox"
            checked={form.header.show_signature_block}
            onChange={(e) => setHeader({ show_signature_block: e.target.checked })}
            disabled={disabled || saving}
          />
          Bloc signature (rapports)
        </label>
        <div className="pdf-layout-editor__field">
          <label htmlFor="pdf-layout-subtitle">Sous-titre sous le logo (optionnel)</label>
          <input
            id="pdf-layout-subtitle"
            className="input"
            type="text"
            value={form.header.subtitle}
            onChange={(e) => setHeader({ subtitle: e.target.value })}
            disabled={disabled || saving}
            placeholder="Ex. Laboratoire agréé COFRAC"
          />
        </div>
        <div className="pdf-layout-editor__field">
          <label htmlFor="pdf-layout-slots">Emplacements photos (rapport, formData photo_slot_1…)</label>
          <select
            id="pdf-layout-slots"
            className="input"
            value={String(form.header.photo_slots)}
            onChange={(e) => setHeader({ photo_slots: Number(e.target.value) })}
            disabled={disabled || saving}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={String(n)}>
                {n === 0 ? 'Aucun' : `${n} emplacement${n > 1 ? 's' : ''}`}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="pdf-layout-editor__section">
        <div className="pdf-layout-editor__section-head">
          <h3 className="pdf-layout-editor__h" style={{ marginBottom: 0 }}>
            Champs configurés
          </h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={disabled || saving}
            onClick={addField}
          >
            Ajouter un champ
          </button>
        </div>
        <p className="pdf-layout-editor__hint">
          CRUD : ajoutez des lignes, modifiez clé / libellé / type, supprimez une ligne. Clé technique : lettres, chiffres,
          underscore (ex. <code>reference_chantier</code>).
        </p>
        {form.extra_fields.length === 0 ? (
          <p className="pdf-layout-editor__empty">Aucun champ — cliquez sur « Ajouter un champ ».</p>
        ) : (
          <div className="pdf-layout-editor__table-wrap">
            <table className="pdf-layout-editor__table">
              <thead>
                <tr>
                  <th>Clé technique</th>
                  <th>Libellé PDF</th>
                  <th>Type</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {form.extra_fields.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        className="input input--table"
                        value={row.key}
                        onChange={(e) => updateField(index, { key: e.target.value })}
                        disabled={disabled || saving}
                        placeholder="ex. nom_terrain"
                        spellCheck={false}
                      />
                    </td>
                    <td>
                      <input
                        className="input input--table"
                        value={row.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        disabled={disabled || saving}
                        placeholder="Libellé affiché"
                      />
                    </td>
                    <td>
                      <select
                        className="input input--table"
                        value={row.type}
                        onChange={(e) =>
                          updateField(index, { type: e.target.value === 'image' ? 'image' : 'text' })
                        }
                        disabled={disabled || saving}
                      >
                        <option value="text">Texte</option>
                        <option value="image">Image (data URL)</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={disabled || saving}
                        onClick={() => removeField(index)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {err ? <p className="error pdf-layout-editor__err">{err}</p> : null}

      <div className="pdf-layout-editor__actions">
        <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || saving} onClick={() => void handleSave()}>
          {saving ? 'Enregistrement…' : 'Enregistrer la mise en page'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || saving} onClick={handleReset}>
          Annuler les modifications
        </button>
      </div>
    </div>
  )
}
