import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormOptionList, TestTypeFormColumn, TestTypeFormField } from '../../api/client'

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

function Choices({ field, lists, onChange }: { field: TestTypeFormField | TestTypeFormColumn; lists: FormOptionList[]; onChange: (field: TestTypeFormField | TestTypeFormColumn) => void }) {
  return <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
    <label>Liste commune
      <select value={field.list_id ?? ''} onChange={(event) => onChange({ ...field, list_id: event.target.value ? Number(event.target.value) : null })}>
        <option value="">Choix propres à ce formulaire</option>
        {lists.map((list) => <option value={list.id} key={list.id}>{list.name}</option>)}
      </select>
    </label>
    {!field.list_id ? <label>Choix, séparés par « ; »
      <input value={(field.options ?? []).join('; ')} onChange={(event) => onChange({ ...field, options: event.target.value.split(';').map((value) => value.trim()).filter(Boolean) })} />
    </label> : null}
  </div>
}

export default function TestFormFieldsEditor({ fields, onChange, lists }: {
  fields: TestTypeFormField[]; onChange: (fields: TestTypeFormField[]) => void; lists: FormOptionList[]
}) {
  const [nextType, setNextType] = useState<TestTypeFormField['type']>('text')
  const update = (index: number, patch: TestTypeFormField) => onChange(fields.map((field, itemIndex) => itemIndex === index ? patch : field))

  return <section>
    <h3>Construire le formulaire</h3>
    <p className="text-muted">Ajoutez des champs dans l’ordre de saisie. Une formule peut utiliser les clés des champs numériques placés avant elle, par exemple <code>longueur * largeur</code>.</p>
    {fields.map((field, index) => <div key={index} className="card" style={{ padding: '0.75rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end' }}>
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
        <label><input type="checkbox" checked={field.required} onChange={(event) => update(index, { ...field, required: event.target.checked })} /> Obligatoire</label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(fields.filter((_, itemIndex) => itemIndex !== index))}>Retirer</button>
      </div>
      {['number', 'formula'].includes(field.type) ? <label>Unité <input value={field.unit ?? ''} onChange={(event) => update(index, { ...field, unit: event.target.value })} /></label> : null}
      {field.type === 'formula' ? <label>Formule * <input value={field.formula ?? ''} placeholder="longueur * largeur" onChange={(event) => update(index, { ...field, formula: event.target.value })} /></label> : null}
      {['select', 'checkboxes'].includes(field.type) ? <Choices field={field} lists={lists} onChange={(next) => update(index, next as TestTypeFormField)} /> : null}
      {field.type === 'table' ? <div style={{ marginTop: '0.75rem' }}>
        <strong>Colonnes du tableau</strong>
        {(field.columns ?? []).map((column, columnIndex) => <div key={columnIndex} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'end' }}>
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
      <select aria-label="Type de champ à ajouter" value={nextType} onChange={(event) => setNextType(event.target.value as TestTypeFormField['type'])}>
        {FIELD_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...fields, newFormField(nextType)])}>+ Ajouter un champ</button>
      <Link to="/config/listes-essais">Configurer les listes communes</Link>
    </div>
  </section>
}
