import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  articleSectionProductsApi,
  catalogueApi,
  type ArticleSectionProductsGrouped,
  type RefArticleRow,
} from '../../api/client'

type Props = {
  article: RefArticleRow
  sectionType: 'technicien' | 'ingenieur' | 'labo'
  canEdit: boolean
}

export default function ArticleS2gSectionProducts({ article, sectionType, canEdit }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const { data: grouped, isLoading } = useQuery({
    queryKey: ['article-section-products', article.id],
    queryFn: () => articleSectionProductsApi.list(article.id),
    staleTime: 30_000,
  })

  const { data: searchResults } = useQuery({
    queryKey: ['catalogue-articles-search', search],
    queryFn: () => catalogueApi.articles({ q: search, kind: 'product' }),
    enabled: showPicker && search.trim().length >= 2,
    staleTime: 10_000,
  })

  const onSuccess = (data: ArticleSectionProductsGrouped) => {
    qc.setQueryData(['article-section-products', article.id], data)
  }

  const addMut = useMutation({
    mutationFn: (body: { product_article_id: number; quantite: number }) =>
      articleSectionProductsApi.add(article.id, { ...body, section_type: sectionType }),
    onSuccess,
  })

  const updateMut = useMutation({
    mutationFn: ({ assignmentId, quantite }: { assignmentId: number; quantite: number }) =>
      articleSectionProductsApi.updateQuantite(article.id, assignmentId, quantite),
    onSuccess,
  })

  const removeMut = useMutation({
    mutationFn: (assignmentId: number) => articleSectionProductsApi.remove(article.id, assignmentId),
    onSuccess,
  })

  const assignments = grouped?.[sectionType] ?? []

  function handleAdd(productId: number) {
    if (addMut.isPending) return
    addMut.mutate({ product_article_id: productId, quantite: 1 })
    setShowPicker(false)
    setSearch('')
  }

  function handleQuickAdd() {
    if (addMut.isPending) return
    addMut.mutate({ product_article_id: article.id, quantite: 1 })
  }

  function handleQtyChange(assignmentId: number, raw: string) {
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 1) return
    updateMut.mutate({ assignmentId, quantite: n })
  }

  function handleRemove(assignmentId: number) {
    if (removeMut.isPending) return
    removeMut.mutate(assignmentId)
  }

  function openPicker() {
    setShowPicker(true)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  const isPending = addMut.isPending || removeMut.isPending
  const errorMsg =
    (addMut.isError ? (addMut.error as Error).message : null) ||
    (removeMut.isError ? (removeMut.error as Error).message : null) ||
    (updateMut.isError ? (updateMut.error as Error).message : null)

  if (isLoading) {
    return <p className="text-muted article-section-products__loading">Chargement des produits…</p>
  }

  return (
    <div className="card dossier-tab-panel article-section-products">
      <div className="article-section-products__head">
        <h4 className="article-actions-add__title">Produits</h4>
        <span className="badge">{assignments.length}</span>
      </div>

      {assignments.length > 0 && (
        <table className="article-section-products__table">
          <thead>
            <tr>
              <th>Produit</th>
              <th style={{ width: '90px' }}>Qté</th>
              {canEdit && <th style={{ width: '36px' }} />}
            </tr>
          </thead>
          <tbody>
            {assignments.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className="article-section-products__label">
                    {row.product ? (
                      <>
                        <code className="code-badge">{row.product.code}</code>
                        <Link to={`/catalogue/articles/${row.product_article_id}`} className="link-inline">
                          {row.product.libelle}
                        </Link>
                      </>
                    ) : (
                      <span className="text-muted">#{row.product_article_id}</span>
                    )}
                  </span>
                </td>
                <td>
                  {canEdit ? (
                    <input
                      type="number"
                      min={1}
                      defaultValue={row.quantite}
                      className="input-sm"
                      style={{ width: '70px' }}
                      disabled={updateMut.isPending}
                      onBlur={(e) => handleQtyChange(row.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                    />
                  ) : (
                    <span>{row.quantite}</span>
                  )}
                </td>
                {canEdit && (
                  <td>
                    <button
                      type="button"
                      className="article-section-products__remove-btn"
                      title="Supprimer"
                      disabled={isPending}
                      onClick={() => handleRemove(row.id)}
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {assignments.length === 0 && (
        <p className="dossier-tab-empty text-muted">Aucun produit dans ce profil.</p>
      )}

      {canEdit && (
        <div className="article-section-products__actions">
          {article.kind === 'product' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={isPending}
              onClick={handleQuickAdd}
            >
              + Ajouter « {article.libelle} »
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={isPending}
            onClick={openPicker}
          >
            + Ajouter un produit
          </button>
        </div>
      )}

      {showPicker && (
        <div className="article-section-products__picker">
          <div className="article-section-products__picker-header">
            <input
              ref={searchRef}
              type="text"
              placeholder="Rechercher un produit…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-sm"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="article-section-products__remove-btn"
              onClick={() => { setShowPicker(false); setSearch('') }}
            >
              ×
            </button>
          </div>

          {search.trim().length >= 2 && searchResults && searchResults.length > 0 && (
            <ul className="article-section-products__picker-list">
              {searchResults.slice(0, 15).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="article-section-products__picker-item"
                    onClick={() => handleAdd(p.id)}
                  >
                    <code className="code-badge">{p.code}</code>
                    <span>{p.libelle}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {search.trim().length >= 2 && searchResults && searchResults.length === 0 && (
            <p className="text-muted" style={{ padding: '0.5rem' }}>Aucun produit trouvé.</p>
          )}

          {search.trim().length > 0 && search.trim().length < 2 && (
            <p className="text-muted" style={{ padding: '0.5rem' }}>Saisissez au moins 2 caractères.</p>
          )}
        </div>
      )}

      {errorMsg && <p className="error">{errorMsg}</p>}
    </div>
  )
}
