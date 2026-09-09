import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  articleActionsApi,
  catalogueApi,
  ordresMissionApi,
  type ArticleAction,
  type OrdreMission,
  type RefArticleRow,
} from '../../api/client'

type AddMode = 'libre' | 'catalogue'

type Props = {
  om: OrdreMission
  onClose: () => void
  onCreated: () => void
}

function actionTypeForOm(type: OrdreMission['type']): ArticleAction['type'] {
  if (type === 'labo') return 'labo'
  if (type === 'ingenieur') return 'ingenieur'
  return 'technicien'
}

export default function OmLigneAddPanel({ om, onClose, onCreated }: Props) {
  const [mode, setMode] = useState<AddMode>('libre')
  const [libelle, setLibelle] = useState('')
  const [quantite, setQuantite] = useState('1')
  const [search, setSearch] = useState('')
  const [selectedArticle, setSelectedArticle] = useState<RefArticleRow | null>(null)
  const [selectedActionId, setSelectedActionId] = useState<number | ''>('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ['catalogue-articles-om', search],
    queryFn: () => catalogueApi.articles({ q: search.trim() || undefined, with_inactif: false }),
    enabled: mode === 'catalogue',
    staleTime: 30_000,
  })

  const { data: actions = [] } = useQuery({
    queryKey: ['article-actions-om', selectedArticle?.id, om.type],
    queryFn: () => articleActionsApi.list(selectedArticle!.id),
    enabled: mode === 'catalogue' && selectedArticle != null,
    staleTime: 30_000,
  })

  const filteredActions = useMemo(() => {
    const expected = actionTypeForOm(om.type)
    return actions.filter((a) => a.type === expected)
  }, [actions, om.type])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      if (mode === 'libre') {
        const label = libelle.trim()
        if (!label) {
          setError('Saisissez un libellé pour la tâche.')
          return
        }
        await ordresMissionApi.createLigne(om.id, {
          libelle: label,
          quantite: Number(quantite) || 1,
        })
      } else {
        if (!selectedArticle) {
          setError('Sélectionnez un produit catalogue.')
          return
        }
        await ordresMissionApi.createLigne(om.id, {
          ref_article_id: selectedArticle.id,
          libelle: selectedArticle.libelle,
          quantite: Number(quantite) || 1,
          article_action_id: selectedActionId === '' ? null : selectedActionId,
        })
      }
      onCreated()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="om-ligne-add-panel" onSubmit={handleSubmit}>
      <div className="om-ligne-add-panel__modes">
        <button
          type="button"
          className={`btn btn-sm ${mode === 'libre' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('libre')}
        >
          Tâche libre
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'catalogue' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('catalogue')}
        >
          Depuis catalogue
        </button>
      </div>

      <label className="form-group">
        Quantité
        <input
          type="number"
          min={0.001}
          step="any"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          disabled={pending}
        />
      </label>

      {mode === 'libre' ? (
        <label className="form-group">
          Libellé de la tâche *
          <input
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="ex. Prélèvement complémentaire"
            disabled={pending}
            required
          />
        </label>
      ) : (
        <>
          <label className="form-group">
            Rechercher un produit catalogue
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelectedArticle(null)
                setSelectedActionId('')
              }}
              placeholder="Code ou libellé…"
              disabled={pending}
            />
          </label>
          {articlesLoading ? <p className="text-muted">Recherche…</p> : null}
          {!articlesLoading && search.trim() !== '' && articles.length === 0 ? (
            <p className="text-muted">Aucun produit trouvé.</p>
          ) : null}
          {articles.length > 0 ? (
            <ul className="om-ligne-add-panel__articles">
              {articles.slice(0, 12).map((article) => (
                <li key={article.id}>
                  <button
                    type="button"
                    className={`om-ligne-add-panel__article${selectedArticle?.id === article.id ? ' om-ligne-add-panel__article--active' : ''}`}
                    onClick={() => {
                      setSelectedArticle(article)
                      setSelectedActionId('')
                    }}
                  >
                    <code>{article.code}</code> — {article.libelle}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selectedArticle && filteredActions.length > 0 ? (
            <label className="form-group">
              Action catalogue ({actionTypeForOm(om.type)})
              <select
                value={selectedActionId}
                onChange={(e) => setSelectedActionId(e.target.value ? Number(e.target.value) : '')}
                disabled={pending}
              >
                <option value="">— Libellé produit uniquement —</option>
                {filteredActions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.libelle} ({action.duree_heures}h)
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      )}

      {error ? <p className="error">{error}</p> : null}

      <div className="crud-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'Ajout…' : 'Ajouter la tâche'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={onClose}>
          Annuler
        </button>
      </div>
    </form>
  )
}
