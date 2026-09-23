import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { articleActionsApi, catalogueApi, testTypesApi, type RefArticleRow } from '../../api/client'

type Assignment = { test_type_id: number; article_action_id: number | null }

export default function ArticleTestTypesPanel({ article, canEdit }: { article: RefArticleRow; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const { data: types = [] } = useQuery({ queryKey: ['test-types'], queryFn: testTypesApi.list })
  const { data: actions = [] } = useQuery({
    queryKey: ['article-actions', article.id], queryFn: () => articleActionsApi.list(article.id),
  })

  useEffect(() => {
    setAssignments((article.test_types ?? []).map((type) => ({
      test_type_id: type.id, article_action_id: type.article_action_id ?? null,
    })))
  }, [article.id, article.test_types])

  const save = useMutation({
    mutationFn: () => catalogueApi.syncArticleTestTypes(article.id, assignments),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['catalogue-article', article.id] })
      void queryClient.invalidateQueries({ queryKey: ['test-types'] })
    },
  })
  const available = types.filter((type) => (type.form_fields?.length ?? 0) > 0 && !assignments.some((item) => item.test_type_id === type.id))

  return <section className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
    <h2>Essais et formulaires nécessaires</h2>
    <p className="text-muted">Choisissez les essais du produit. Vous pouvez limiter chaque formulaire à une action terrain, laboratoire ou ingénierie.</p>
    {assignments.length === 0 ? <p>Aucun essai associé à ce produit.</p> : assignments.map((assignment) => {
      const type = types.find((item) => item.id === assignment.test_type_id)
        ?? article.test_types?.find((item) => item.id === assignment.test_type_id)
      return <div key={assignment.test_type_id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <strong>{type?.name ?? `Essai #${assignment.test_type_id}`}</strong>
        {type?.norm ? <span className="text-muted">{type.norm}</span> : null}
        <select
          aria-label={`Action pour ${type?.name ?? assignment.test_type_id}`}
          value={assignment.article_action_id ?? ''}
          disabled={!canEdit || save.isPending}
          onChange={(event) => setAssignments((current) => current.map((item) => item.test_type_id === assignment.test_type_id
            ? { ...item, article_action_id: event.target.value ? Number(event.target.value) : null } : item))}
        >
          <option value="">Toutes les actions du produit</option>
          {actions.map((action) => <option key={action.id} value={action.id}>{action.libelle} ({action.type})</option>)}
        </select>
        {canEdit ? <button type="button" className="btn btn-secondary btn-sm" disabled={save.isPending}
          onClick={() => setAssignments((current) => current.filter((item) => item.test_type_id !== assignment.test_type_id))}>Retirer</button> : null}
      </div>
    })}
    {canEdit ? <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
        <select aria-label="Essai à ajouter" value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)}>
          <option value="">— Choisir un essai —</option>
          {available.map((type) => <option key={type.id} value={type.id}>{type.name}{type.norm ? ` — ${type.norm}` : ''}</option>)}
        </select>
        <button type="button" className="btn btn-secondary btn-sm" disabled={!selectedTypeId || save.isPending}
          onClick={() => { setAssignments((current) => [...current, { test_type_id: Number(selectedTypeId), article_action_id: null }]); setSelectedTypeId('') }}>Ajouter l’essai</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={save.isPending}
          onClick={() => save.mutate()}>{save.isPending ? 'Enregistrement…' : 'Enregistrer les essais'}</button>
      </div>
      {save.isError ? <p className="error">{(save.error as Error).message}</p> : null}
      {save.isSuccess ? <p>Essais enregistrés.</p> : null}
    </> : null}
    <p style={{ marginTop: '0.75rem' }}><Link to="/catalogue/essais">Créer ou modifier un type d’essai et son formulaire</Link></p>
  </section>
}
