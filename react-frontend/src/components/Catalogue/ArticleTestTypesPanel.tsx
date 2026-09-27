import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { articleActionsApi, catalogueApi, testTypesApi, type RefArticleRow } from '../../api/client'

type Assignment = { test_type_id: number; article_action_id: number | null }

function sameAssignments(left: Assignment[], right: Assignment[]): boolean {
  const key = (assignment: Assignment) => `${assignment.test_type_id}:${assignment.article_action_id ?? ''}`
  if (left.length !== right.length) return false
  const leftKeys = left.map(key).sort()
  const rightKeys = right.map(key).sort()
  return leftKeys.every((value, index) => value === rightKeys[index])
}

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
    mutationFn: (next: Assignment[]) => catalogueApi.syncArticleTestTypes(article.id, next),
    onSuccess: (savedArticle) => {
      setAssignments((savedArticle.test_types ?? []).map((type) => ({
        test_type_id: type.id, article_action_id: type.article_action_id ?? null,
      })))
      void queryClient.invalidateQueries({ queryKey: ['catalogue-article', article.id] })
      void queryClient.invalidateQueries({ queryKey: ['test-types'] })
    },
  })
  const available = types.filter((type) => !assignments.some((item) => item.test_type_id === type.id))
  const selectedType = available.find((type) => type.id === Number(selectedTypeId))
  const savedAssignments = (article.test_types ?? []).map((type) => ({
    test_type_id: type.id, article_action_id: type.article_action_id ?? null,
  }))
  const serverConfirmed = save.isSuccess && sameAssignments(
    save.variables ?? [],
    (save.data?.test_types ?? []).map((type) => ({ test_type_id: type.id, article_action_id: type.article_action_id ?? null })),
  )
  const saveConfirmed = serverConfirmed && sameAssignments(assignments, save.variables ?? [])
  const hasChanges = !sameAssignments(assignments, savedAssignments) && !saveConfirmed

  return <section className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
    <h2>Essais et formulaires nécessaires</h2>
    <p className="text-muted">Choisissez les essais du produit. Vous pouvez limiter chaque formulaire à une action terrain, laboratoire ou ingénierie.</p>
    {assignments.length === 0 ? <p>Aucun essai associé à ce produit.</p> : assignments.map((assignment) => {
      const type = types.find((item) => item.id === assignment.test_type_id)
        ?? article.test_types?.find((item) => item.id === assignment.test_type_id)
      const context = type && 'context' in type ? type.context : null
      return <div key={assignment.test_type_id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <strong>{type?.name ?? `Essai #${assignment.test_type_id}`}</strong>
        {context ? <span className="text-muted">{context === 'terrain' ? 'Terrain' : context === 'ingenieur' ? 'Ingénierie' : 'Laboratoire'} uniquement</span> : null}
        {!savedAssignments.some((saved) => saved.test_type_id === assignment.test_type_id) && !saveConfirmed ? <span className="text-muted">À enregistrer</span> : null}
        {type?.norm ? <span className="text-muted">{type.norm}</span> : null}
        <select
          aria-label={`Action pour ${type?.name ?? assignment.test_type_id}`}
          value={assignment.article_action_id ?? ''}
          disabled={!canEdit || save.isPending}
          onChange={(event) => setAssignments((current) => current.map((item) => item.test_type_id === assignment.test_type_id
            ? { ...item, article_action_id: event.target.value ? Number(event.target.value) : null } : item))}
        >
          <option value="">Toutes les actions du produit</option>
          {actions.filter((action) => !context || action.type === (context === 'terrain' ? 'technicien' : context)).map((action) => <option key={action.id} value={action.id}>{action.libelle} ({action.type})</option>)}
        </select>
        {canEdit ? <button type="button" className="btn btn-secondary btn-sm" disabled={save.isPending}
          onClick={() => setAssignments((current) => current.filter((item) => item.test_type_id !== assignment.test_type_id))}>Retirer</button> : null}
      </div>
    })}
    {canEdit ? <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
        <select aria-label="Essai à ajouter" value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)}>
          <option value="">— Choisir un essai —</option>
          {available.map((type) => <option key={type.id} value={type.id}>{type.name} · {type.context === 'terrain' ? 'Terrain' : type.context === 'ingenieur' ? 'Ingénierie' : type.context === 'labo' ? 'Laboratoire' : 'Historique (tous)'}{(type.form_fields?.length ?? 0) === 0 ? ' · formulaire à construire' : ''}</option>)}
        </select>
        <button type="button" className="btn btn-secondary btn-sm" disabled={!selectedTypeId || (selectedType?.form_fields?.length ?? 0) === 0 || save.isPending}
          onClick={() => save.mutate([...assignments, { test_type_id: Number(selectedTypeId), article_action_id: null }], {
            onSuccess: () => setSelectedTypeId(''),
          })}>{save.isPending ? 'Ajout en cours…' : 'Ajouter et enregistrer'}</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={save.isPending || !hasChanges}
          onClick={() => save.mutate(assignments)}>{save.isPending ? 'Enregistrement…' : 'Enregistrer les essais'}</button>
      </div>
      {assignments.length === 0 && !hasChanges ? <p className="text-muted">Sélectionnez un essai avec formulaire : son ajout sera enregistré immédiatement.</p> : null}
      {hasChanges ? <p className="text-muted">Modifications non enregistrées.</p> : null}
      {selectedType && (selectedType.form_fields?.length ?? 0) === 0 ? <p className="text-muted">Cet essai existe, mais son formulaire doit être construit avant de l’affecter. <Link to={`/catalogue/essais?edit=${selectedType.id}`}>Modifier cet essai</Link></p> : null}
      {selectedType?.context ? <p className="text-muted">Un essai « {selectedType.context === 'terrain' ? 'Terrain' : selectedType.context === 'ingenieur' ? 'Ingénierie' : 'Laboratoire'} » n’apparaît que sur les tâches du même domaine, même s’il est associé au produit.</p> : null}
      {save.isError ? <p className="error">{(save.error as Error).message}</p> : null}
      {saveConfirmed ? <p>Essais enregistrés.</p> : null}
      {save.isSuccess && !serverConfirmed ? <p className="error">L’association n’a pas été confirmée par le serveur. Rechargez la fiche et réessayez.</p> : null}
    </> : null}
    <p style={{ marginTop: '0.75rem' }}><Link to="/catalogue/essais">Créer ou modifier un type d’essai et son formulaire</Link></p>
  </section>
}
