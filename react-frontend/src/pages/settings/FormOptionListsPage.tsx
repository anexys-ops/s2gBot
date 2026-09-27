import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formOptionListsApi, type FormOptionList } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export default function FormOptionListsPage() {
  const queryClient = useQueryClient()
  const { data: lists = [] } = useQuery({ queryKey: ['form-option-lists'], queryFn: formOptionListsApi.list })
  const [editing, setEditing] = useState<FormOptionList | null>(null)
  const [name, setName] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), options: optionsText.split(/\n|;/).map((option) => option.trim()).filter(Boolean) }
      if (editing) return formOptionListsApi.update(editing.id, payload)
      return formOptionListsApi.create(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['form-option-lists'] })
      setEditing(null); setName(''); setOptionsText(''); setError('')
    },
    onError: (reason: Error) => setError(reason.message),
  })
  const remove = useMutation({
    mutationFn: formOptionListsApi.delete,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['form-option-lists'] }),
    onError: (reason: Error) => setError(reason.message),
  })

  return <ModuleEntityShell moduleBarLabel="Configuration — Essais" title="Listes de choix communes"
    breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Essais', to: '/catalogue/essais' }, { label: 'Listes communes' }]}>
    <p>Ces listes peuvent être réutilisées dans les formulaires terrain, laboratoire et ingénierie. Les formulaires déjà commencés conservent leurs choix d’origine.</p>
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <h2>{editing ? `Modifier « ${editing.name} »` : 'Nouvelle liste'}</h2>
      <form onSubmit={(event) => { event.preventDefault(); setError(''); save.mutate() }}>
        <div className="form-group"><label>Nom de la liste *<input required value={name} onChange={(event) => setName(event.target.value)} /></label></div>
        <div className="form-group"><label>Choix * (un par ligne)<textarea required rows={6} value={optionsText} onChange={(event) => setOptionsText(event.target.value)} /></label></div>
        <div className="crud-actions"><button className="btn btn-primary" type="submit" disabled={save.isPending}>Enregistrer la liste</button>
          {editing ? <button className="btn btn-secondary" type="button" onClick={() => { setEditing(null); setName(''); setOptionsText('') }}>Annuler</button> : null}</div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
    <div className="card" style={{ padding: '1rem' }}>
      <h2>Listes disponibles</h2>
      {lists.length === 0 ? <p>Aucune liste commune.</p> : <div className="table-wrap"><table className="data-table data-table--compact"><thead><tr><th>Nom</th><th>Choix</th><th>Actions</th></tr></thead><tbody>
        {lists.map((list) => <tr key={list.id}><td>{list.name}</td><td>{list.options.join(' · ')}</td><td><div className="crud-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(list); setName(list.name); setOptionsText(list.options.join('\n')) }}>Modifier</button>
          <button type="button" className="btn btn-secondary btn-sm btn-danger-outline" onClick={() => { if (window.confirm(`Supprimer la liste « ${list.name} » ?`)) remove.mutate(list.id) }}>Supprimer</button>
        </div></td></tr>)}
      </tbody></table></div>}
    </div>
  </ModuleEntityShell>
}
