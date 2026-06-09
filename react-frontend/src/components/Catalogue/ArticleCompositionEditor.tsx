/**
 * ArticleCompositionEditor
 *
 * Composition d'un article : articles enfants, quantités, optionnel, ordre.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { articleCompositionApi, type ArticleComposition } from '../../api/articleCompositionApi'
import { catalogueApi } from '../../api/client'
import ConfirmDialog from '../ConfirmDialog'
import { formatMoney } from '../../lib/appLocale'

type Props = {
  articleId: number
  canEdit?: boolean
}

function childLabel(comp: ArticleComposition): string {
  const child = comp.child
  if (child?.libelle) return child.libelle
  if (child?.code) return child.code
  return `#${comp.child_article_id}`
}

function childPrice(comp: ArticleComposition): string {
  const raw = comp.child?.prix_unitaire_ht
  if (raw == null || String(raw).trim() === '') return '—'
  const n = Number(raw)
  return Number.isFinite(n) ? formatMoney(n) : '—'
}

function CompositionRow({
  comp,
  articleId,
  canEdit,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  comp: ArticleComposition
  articleId: number
  canEdit: boolean
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  const qc = useQueryClient()
  const [qty, setQty] = useState(comp.qty_per_unit)
  const [optional, setOptional] = useState(comp.is_optional)
  const [dirty, setDirty] = useState(false)

  const updateMut = useMutation({
    mutationFn: (body: { qty_per_unit?: number; is_optional?: boolean }) =>
      articleCompositionApi.update(articleId, comp.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-compositions', articleId] })
      setDirty(false)
    },
  })

  const child = comp.child
  const label = childLabel(comp)
  const code = child?.code ?? '—'
  const unite = child?.unite?.trim() || null
  const childId = child?.id ?? comp.child_article_id

  return (
    <tr>
      <td>
        <code className="code-badge">{code}</code>
      </td>
      <td>
        <Link to={`/catalogue/articles/${childId}`} className="link-inline">
          {label}
        </Link>
        {unite ? <span className="text-muted article-composition__unite"> / {unite}</span> : null}
      </td>
      <td className="article-composition__col-amount">{childPrice(comp)}</td>
      <td className="article-composition__col-qty">
        {canEdit ? (
          <input
            type="number"
            min={1}
            step={1}
            className="article-composition__qty-input"
            value={qty}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              setQty(Number.isFinite(v) && v > 0 ? v : 1)
              setDirty(true)
            }}
          />
        ) : (
          comp.qty_per_unit
        )}
      </td>
      <td className="article-composition__col-center">
        {canEdit ? (
          <input
            type="checkbox"
            checked={optional}
            onChange={(e) => {
              setOptional(e.target.checked)
              setDirty(true)
            }}
          />
        ) : optional ? (
          <span className="status-pill status-pill--muted">Oui</span>
        ) : (
          '—'
        )}
      </td>
      {canEdit ? (
        <>
          <td className="article-composition__col-actions">
            {dirty ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={updateMut.isPending}
                onClick={() => updateMut.mutate({ qty_per_unit: qty, is_optional: optional })}
              >
                {updateMut.isPending ? '…' : 'Sauver'}
              </button>
            ) : null}
            {updateMut.isError ? (
              <span className="error article-composition__row-error">{(updateMut.error as Error).message}</span>
            ) : null}
          </td>
          <td className="article-composition__col-order">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onMoveUp}
              disabled={isFirst}
              title="Monter"
              aria-label="Monter"
            >
              ▲
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onMoveDown}
              disabled={isLast}
              title="Descendre"
              aria-label="Descendre"
            >
              ▼
            </button>
          </td>
          <td>
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-danger-outline"
              title="Supprimer"
              onClick={onDelete}
            >
              ✕
            </button>
          </td>
        </>
      ) : null}
    </tr>
  )
}

function AddCompositionForm({ articleId }: { articleId: number }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedLabel, setSelectedLabel] = useState('')
  const [qty, setQty] = useState(1)
  const [isOptional, setIsOptional] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const { data: articles = [] } = useQuery({
    queryKey: ['catalogue-articles', 'picker'],
    queryFn: () => catalogueApi.articles({ with_inactif: false }),
    staleTime: 120_000,
  })

  const filtered =
    search.trim().length >= 1
      ? articles
          .filter(
            (a) =>
              a.id !== articleId &&
              (a.code.toLowerCase().includes(search.toLowerCase()) ||
                a.libelle.toLowerCase().includes(search.toLowerCase())),
          )
          .slice(0, 20)
      : []

  const createMut = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error('Sélectionner un article')
      return articleCompositionApi.add(articleId, {
        child_article_id: selectedId,
        qty_per_unit: qty,
        is_optional: isOptional,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-compositions', articleId] })
      setSearch('')
      setSelectedId(null)
      setSelectedLabel('')
      setQty(1)
      setIsOptional(false)
      setShowPicker(false)
    },
  })

  return (
    <section className="card article-composition-add">
      <h3 className="ds-form-section__title">Ajouter un composant</h3>
      <p className="article-composition-add__intro text-muted">
        Recherchez un article du catalogue à inclure dans la composition (prestation regroupée, kit, etc.).
      </p>
      <form
        className="article-composition-add__form"
        onSubmit={(e) => {
          e.preventDefault()
          createMut.mutate()
        }}
      >
        <label className="article-composition-add__field article-composition-add__field--picker">
          Article *
          <input
            value={selectedId ? selectedLabel : search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedId(null)
              setSelectedLabel('')
              setShowPicker(true)
            }}
            onFocus={() => setShowPicker(true)}
            onBlur={() => {
              window.setTimeout(() => setShowPicker(false), 150)
            }}
            placeholder="Rechercher par code ou libellé…"
            autoComplete="off"
          />
          {showPicker && filtered.length > 0 ? (
            <ul className="article-composition-picker" role="listbox">
              {filtered.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelectedId(a.id)
                      setSelectedLabel(`${a.code} — ${a.libelle}`)
                      setSearch('')
                      setShowPicker(false)
                    }}
                  >
                    <code>{a.code}</code>
                    <span>{a.libelle}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </label>

        <label className="article-composition-add__field">
          Qté / unité
          <input
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              setQty(Number.isFinite(v) && v > 0 ? v : 1)
            }}
          />
        </label>

        <label className="article-composition-add__field article-composition-add__field--checkbox">
          <input type="checkbox" checked={isOptional} onChange={(e) => setIsOptional(e.target.checked)} />
          Optionnel
        </label>

        <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending || !selectedId}>
          {createMut.isPending ? 'Ajout…' : '+ Ajouter'}
        </button>

        {createMut.isError ? <p className="error article-composition-add__error">{(createMut.error as Error).message}</p> : null}
      </form>
    </section>
  )
}

export default function ArticleCompositionEditor({ articleId, canEdit = true }: Props) {
  const qc = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<ArticleComposition | null>(null)

  const { data: compositions = [], isLoading, error } = useQuery({
    queryKey: ['article-compositions', articleId],
    queryFn: () => articleCompositionApi.list(articleId),
    staleTime: 60_000,
  })

  const sorted = compositions.slice().sort((a, b) => a.ordre - b.ordre)

  const reorderMut = useMutation({
    mutationFn: (ids: number[]) => articleCompositionApi.reorder(articleId, ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-compositions', articleId] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => articleCompositionApi.remove(articleId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-compositions', articleId] })
      setDeleteTarget(null)
    },
  })

  function handleMove(index: number, direction: 'up' | 'down') {
    const newSorted = [...sorted]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[newSorted[index], newSorted[swapIndex]] = [newSorted[swapIndex], newSorted[index]]
    reorderMut.mutate(newSorted.map((c) => c.id))
  }

  if (isLoading) {
    return (
      <div className="article-composition">
        <p className="text-muted">Chargement de la composition…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="article-composition">
        <p className="error">{(error as Error).message}</p>
      </div>
    )
  }

  return (
    <div className="article-composition">
      <section className="card dossier-tab-panel">
        <h2 className="ds-form-section__title">Composition</h2>
        <p className="dossier-tab-panel__intro">
          Articles composant cette prestation (kits, regroupements, sous-essais). La quantité indique le nombre
          d&apos;unités de l&apos;article enfant par unité de l&apos;article parent.
        </p>
        <span className="badge">
          {sorted.length} composant{sorted.length !== 1 ? 's' : ''}
        </span>
        {reorderMut.isPending ? <span className="text-muted article-composition__reorder-hint">Réordonnancement…</span> : null}
      </section>

      <section className="card dossier-tab-panel dossier-tab-panel--table">
        <div className="dossier-tab-panel__header">
          <h2 className="ds-form-section__title">Composants</h2>
        </div>
        {sorted.length === 0 ? (
          <p className="dossier-tab-empty">
            {canEdit
              ? 'Aucun composant — cet article est une prestation simple. Ajoutez des articles ci-dessous.'
              : 'Aucun composant — cet article est une prestation simple.'}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--compact article-composition-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Désignation</th>
                  <th className="article-composition__col-amount">Prix unit. HT</th>
                  <th className="article-composition__col-qty">Qté / unité</th>
                  <th className="article-composition__col-center">Optionnel</th>
                  {canEdit ? (
                    <>
                      <th />
                      <th>Ordre</th>
                      <th />
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sorted.map((comp, idx) => (
                  <CompositionRow
                    key={comp.id}
                    comp={comp}
                    articleId={articleId}
                    canEdit={canEdit}
                    isFirst={idx === 0}
                    isLast={idx === sorted.length - 1}
                    onMoveUp={() => handleMove(idx, 'up')}
                    onMoveDown={() => handleMove(idx, 'down')}
                    onDelete={() => setDeleteTarget(comp)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canEdit ? <AddCompositionForm articleId={articleId} /> : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Supprimer le composant"
          message={
            <>
              Retirer <strong>{childLabel(deleteTarget)}</strong> de la composition ?
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          error={deleteMut.isError ? (deleteMut.error as Error).message : null}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          onCancel={() => {
            if (!deleteMut.isPending) setDeleteTarget(null)
          }}
        />
      ) : null}
    </div>
  )
}
