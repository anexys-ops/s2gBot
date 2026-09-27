import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormOptionList, TestTypeFormColumn, TestTypeFormField } from '../../api/client'
import './TestFormFieldsEditor.css'

const FIELD_TYPES: Array<{ value: TestTypeFormField['type']; label: string }> = [
  { value: 'text', label: 'Champ texte' }, { value: 'number', label: 'Champ nombre' },
  { value: 'date', label: 'Date' }, { value: 'select', label: 'Liste de choix' },
  { value: 'checkboxes', label: 'Cases à cocher' }, { value: 'boolean', label: 'Oui / non' },
  { value: 'photo', label: 'Photo' }, { value: 'table', label: 'Tableau' },
  { value: 'formula', label: 'Case calculée' },
]
const COLUMN_TYPES = FIELD_TYPES.filter((item) => !['photo', 'table', 'checkboxes'].includes(item.value))

export function keyFromLabel(label: string): string {
  const key = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return key && !/^[a-z]/.test(key) ? `champ_${key}` : key
}

export function newFormField(type: TestTypeFormField['type'] = 'text'): TestTypeFormField {
  return { key: '', label: '', type, required: false, options: [], columns: type === 'table' ? [] : undefined }
}

export function validateFormFields(fields: TestTypeFormField[]): string[] {
  if (fields.length === 0) return ['Ajoutez au moins un champ au formulaire.']
  const errors: string[] = []
  const keys = new Set<string>()
  fields.forEach((field, index) => {
    const position = `Champ ${index + 1}`
    if (!field.label.trim()) errors.push(`${position} : indiquez le nom affiché.`)
    if (!/^[a-z][a-z0-9_-]*$/i.test(field.key.trim())) errors.push(`${position} : la clé doit commencer par une lettre et contenir uniquement lettres, chiffres, _ ou -.`)
    if (keys.has(field.key.trim())) errors.push(`${position} : cette clé est déjà utilisée.`)
    keys.add(field.key.trim())
    if (['select', 'checkboxes'].includes(field.type) && !field.list_id && !field.options?.some((option) => option.trim())) {
      errors.push(`${position} : ajoutez des choix ou sélectionnez une liste commune.`)
    }
    if (field.type === 'formula' && !field.formula?.trim()) errors.push(`${position} : saisissez la formule.`)
    if (field.type === 'table') {
      if (!field.columns?.length) errors.push(`${position} : ajoutez au moins une colonne.`)
      const columnKeys = new Set<string>()
      field.columns?.forEach((column, columnIndex) => {
        const columnPosition = `${position}, colonne ${columnIndex + 1}`
        if (!column.label.trim() || !/^[a-z][a-z0-9_-]*$/i.test(column.key.trim())) errors.push(`${columnPosition} : renseignez un nom et une clé valides.`)
        if (columnKeys.has(column.key.trim())) errors.push(`${columnPosition} : cette clé est déjà utilisée.`)
        columnKeys.add(column.key.trim())
        if (column.type === 'select' && !column.list_id && !column.options?.some((option) => option.trim())) errors.push(`${columnPosition} : ajoutez des choix ou une liste commune.`)
        if (column.type === 'formula' && !column.formula?.trim()) errors.push(`${columnPosition} : saisissez la formule.`)
      })
    }
  })
  return errors
}

function Choices({ field, lists, onChange }: { field: TestTypeFormField | TestTypeFormColumn; lists: FormOptionList[]; onChange: (field: TestTypeFormField | TestTypeFormColumn) => void }) {
  const [rawOptions, setRawOptions] = useState((field.options ?? []).join('; '))
  useEffect(() => setRawOptions((field.options ?? []).join('; ')), [field.key])
  return <div className="test-form-editor__choices">
    <label>Liste commune
      <select value={field.list_id ?? ''} onChange={(event) => onChange({ ...field, list_id: event.target.value ? Number(event.target.value) : null })}>
        <option value="">Choix propres à ce formulaire</option>
        {lists.map((list) => <option value={list.id} key={list.id}>{list.name}</option>)}
      </select>
    </label>
    {!field.list_id ? <label>Choix, séparés par « ; »
      <input value={rawOptions} placeholder="Oui ; Non ; Sans objet" onChange={(event) => {
        setRawOptions(event.target.value)
        onChange({ ...field, options: event.target.value.split(';').map((value) => value.trim()).filter(Boolean) })
      }} />
    </label> : null}
  </div>
}

export default function TestFormFieldsEditor({ fields, onChange, lists }: {
  fields: TestTypeFormField[]; onChange: (fields: TestTypeFormField[]) => void; lists: FormOptionList[]
}) {
  const [nextType, setNextType] = useState<TestTypeFormField['type']>('text')
  const update = (index: number, patch: TestTypeFormField) => onChange(fields.map((field, itemIndex) => itemIndex === index ? patch : field))

  return <section className="test-form-editor">
    <div className="test-form-editor__heading"><div><h3>Construire le formulaire</h3><p className="text-muted">Les champs s’affichent dans cet ordre sur l’application. Les clés se créent automatiquement à partir du nom.</p></div><span>{fields.length} champ{fields.length > 1 ? 's' : ''}</span></div>
    {fields.length === 0 ? <p className="test-form-editor__empty">Aucun champ pour le moment. Choisissez un type ci-dessous pour commencer.</p> : null}
    {fields.map((field, index) => <div key={index} className="test-form-editor__field">
      <div className="test-form-editor__field-title"><strong>Champ {index + 1}</strong><span>{FIELD_TYPES.find((item) => item.value === field.type)?.label}</span><div className="test-form-editor__order"><button type="button" className="btn btn-secondary btn-sm" aria-label={`Monter le champ ${index + 1}`} disabled={index === 0} onClick={() => { const next = [...fields]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next) }}>↑</button><button type="button" className="btn btn-secondary btn-sm" aria-label={`Descendre le champ ${index + 1}`} disabled={index === fields.length - 1} onClick={() => { const next = [...fields]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; onChange(next) }}>↓</button></div></div>
      <div className="test-form-editor__field-grid">
        <label>Nom affiché *
          <input value={field.label} placeholder="Ex. Longueur" onChange={(event) => {
            const label = event.target.value
            update(index, { ...field, label, key: !field.key || field.key === keyFromLabel(field.label) ? keyFromLabel(label) : field.key })
          }} />
        </label>
        <label>Clé du champ *<input value={field.key} placeholder="ex. longueur" onChange={(event) => update(index, { ...field, key: event.target.value })} /></label>
        <label>Type
          <select value={field.type} onChange={(event) => {
            const type = event.target.value as TestTypeFormField['type']
            update(index, { ...field, type, columns: type === 'table' ? field.columns ?? [] : undefined })
          }}>{FIELD_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        </label>
        <label className="test-form-editor__required"><input type="checkbox" checked={field.required} onChange={(event) => update(index, { ...field, required: event.target.checked })} /> Obligatoire</label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(fields.filter((_, itemIndex) => itemIndex !== index))}>Retirer</button>
      </div>
      {['number', 'formula'].includes(field.type) ? <label>Unité <input value={field.unit ?? ''} onChange={(event) => update(index, { ...field, unit: event.target.value })} /></label> : null}
      {field.type === 'formula' ? <label>Formule * <input value={field.formula ?? ''} placeholder="longueur * largeur" onChange={(event) => update(index, { ...field, formula: event.target.value })} /><small>Utilisez les clés des champs numériques précédents, par exemple longueur * largeur.</small></label> : null}
      {['select', 'checkboxes'].includes(field.type) ? <Choices field={field} lists={lists} onChange={(next) => update(index, next as TestTypeFormField)} /> : null}
      {field.type === 'table' ? <div className="test-form-editor__table">
        <strong>Colonnes du tableau</strong>
        {(field.columns ?? []).map((column, columnIndex) => <div key={columnIndex} className="test-form-editor__column">
          <label>Nom<input value={column.label} placeholder="Ex. Quantité" onChange={(event) => {
            const label = event.target.value
            const next = { ...column, label, key: !column.key || column.key === keyFromLabel(column.label) ? keyFromLabel(label) : column.key }
            update(index, { ...field, columns: field.columns?.map((item, i) => i === columnIndex ? next : item) })
          }} /></label>
          <label>Clé<input value={column.key} onChange={(event) => update(index, { ...field, columns: field.columns?.map((item, i) => i === columnIndex ? { ...item, key: event.target.value } : item) })} /></label>
          <label>Type<select value={column.type} onChange={(event) => update(index, { ...field, columns: field.columns?.map((item, i) => i === columnIndex ? { ...item, type: event.target.value as TestTypeFormColumn['type'] } : item) })}>
            {COLUMN_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><input type="checkbox" checked={column.required} onChange={(event) => update(index, { ...field, columns: field.columns?.map((item, i) => i === columnIndex ? { ...item, required: event.target.checked } : item) })} /> Obligatoire</label>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => update(index, { ...field, columns: field.columns?.filter((_, i) => i !== columnIndex) })}>×</button>
          {column.type === 'formula' ? <label>Formule<input value={column.formula ?? ''} placeholder="quantite * prix" onChange={(event) => update(index, { ...field, columns: field.columns?.map((item, i) => i === columnIndex ? { ...item, formula: event.target.value } : item) })} /></label> : null}
          {column.type === 'select' ? <Choices field={column} lists={lists} onChange={(next) => update(index, { ...field, columns: field.columns?.map((item, i) => i === columnIndex ? next as TestTypeFormColumn : item) })} /> : null}
        </div>)}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => update(index, { ...field, columns: [...(field.columns ?? []), { key: '', label: '', type: 'text', required: false }] })}>+ Colonne</button>
      </div> : null}
    </div>)}
    <div className="test-form-editor__add">
      <select aria-label="Type de champ à ajouter" value={nextType} onChange={(event) => setNextType(event.target.value as TestTypeFormField['type'])}>
        {FIELD_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...fields, newFormField(nextType)])}>+ Ajouter un champ</button>
      <Link to="/config/listes-essais">Configurer les listes communes</Link>
    </div>
  </section>
}
