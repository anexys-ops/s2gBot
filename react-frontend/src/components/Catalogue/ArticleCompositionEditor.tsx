/**
 * ArticleCompositionEditor
 *
 * Éditeur de composition d'un article : liste des composants (articles enfants),
 * ajout, modification inline (qté / optionnel), réordonnancement et suppression.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { articleCompositionApi, type ArticleComposition } from '../../api/articleCompositionApi'
import { catalogueApi } from '../../api/client'

// ─── Row inline editing ──────────────────────────────────────────────────────

function CompositionRow({
  comp,
  articleId,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  comp: ArticleComposition
  articleId: number
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
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

  const deleteMut = useMutation({
    mutationFn: () => articleCompositionApi.remove(articleId, comp.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-compositions', articleId] })
    },
  })

  const child = comp.child
  const designation = child?.designation ?? `#${comp.child_article_id}`
  const code = child?.code ?? '—'
  const unite = child?.unite ?? '—'
  const prix = child?.prix_unitaire

  function handleSave() {
    updateMut.mutate({ qty_per_unit: qty, is_optional: optional })
  }

  return (
    <tr>
      <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{code}</td>
      <td>
        {designation}
        {unite && unite !== '—' && (
          <span className="text-muted" style={{ marginLeft: '0.4rem', fontSize: '0.8rem' }}>
            / {unite}
          </span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        {prix != null ? (
          <span style={{ fontSize: '0.85rem' }}>
            {Number(prix).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} DH
          </span>
        ) : (
          '—'
        )}
      </td>
      <td>
        <input
          type="number"
          min={1}
          step={1}
          value={qty}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            setQty(Number.isFinite(v) && v > 0 ? v : 1)
            setDirty(true)
          }}
          style={{ width: 64, textAlign: 'right' }}
        />
      </td>
      <td style={{ textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={optional}
          onChange={(e) => {
            setOptional(e.target.checked)
            setDirty(true)
          }}
        />
      </td>
      <td>
        {dirty && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={updateMut.isPending}
            onClick={handleSave}
            style={{ marginRight: '0.25rem' }}
          >
            {updateMut.isPending ? '…' : 'Sauver'}
          </button>
        )}
        {updateMut.isError && (
          <span className="error" style={{ fontSize: '0.75rem' }}>
            {(updateMut.error as Error).message}
          </span>
        )}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Monter"
          style={{ padding: '0.15rem 0.35rem' }}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onMoveDown}
          disabled={isLast}
          title="Descendre"
          style={{ padding: '0.15rem 0.35rem', marginLeft: '0.2rem' }}
        >
          <ChevronDown size={14} />
        </button>
      </td>
      <td>
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-danger-outline"
          disabled={deleteMut.isPending}
          title="Supprimer"
          onClick={() => {
            if (window.confirm(`Supprimer "${designation}" de la composition ?`)) {
              deleteMut.mutate()
            }
          }}
        >
          {deleteMut.isPending ? '…' : <Trash2 size={14} />}
        </button>
      </td>
    </tr>
  )
}

// ─── Add form ────────────────────────────────────────────────────────────────

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

  const filtered = search.trim().length >= 1
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
    <tfoot>
      <tr>
        <td colSpan={8} style={{ paddingTop: '0.75rem' }}>
          <form
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              padding: '0.75rem',
              background: 'var(--color-surface)',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
            }}
            onSubmit={(e) => {
              e.preventDefault()
              createMut.mutate()
            }}
          >
            {/* Article picker */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem', position: 'relative' }}>
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
                placeholder="Rechercher un article…"
                style={{ minWidth: 220 }}
                autoComplete="off"
              />
              {showPicker && filtered.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 100,
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    minWidth: 280,
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}
                >
                  {filtered.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '0.4rem 0.75rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                      onMouseDown={() => {
                        setSelectedId(a.id)
                        setSelectedLabel(`${a.code} — ${a.libelle}`)
                        setSearch('')
                        setShowPicker(false)
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', marginRight: '0.5rem', color: 'var(--color-text-muted)' }}>
                        {a.code}
                      </span>
                      {a.libelle}
                    </div>
                  ))}
                </div>
              )}
            </label>

            {/* Qty */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
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
                style={{ width: 72 }}
              />
            </label>

            {/* Optional */}
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.82rem' }}>
              <input
                type="checkbox"
                checked={isOptional}
                onChange={(e) => setIsOptional(e.target.checked)}
              />
              Optionnel
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={createMut.isPending || !selectedId}
            >
              {createMut.isPending ? 'Ajout…' : '+ Ajouter'}
            </button>

            {createMut.isError && (
              <span className="error" style={{ fontSize: '0.82rem' }}>
                {(createMut.error as Error).message}
              </span>
            )}
          </form>
        </td>
      </tr>
    </tfoot>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ArticleCompositionEditor({ articleId }: { articleId: number }) {
  const qc = useQueryClient()

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

  function handleMove(index: number, direction: 'up' | 'down') {
    const newSorted = [...sorted]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[newSorted[index], newSorted[swapIndex]] = [newSorted[swapIndex], newSorted[index]]
    reorderMut.mutate(newSorted.map((c) => c.id))
  }

  if (isLoading) {
    return <p className="text-muted">Chargement de la composition…</p>
  }

  if (error) {
    return <p className="error">{(error as Error).message}</p>
  }

  return (
    <section className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Composition</h3>
        <span className="badge">
          {sorted.length} composant{sorted.length !== 1 ? 's' : ''}
        </span>
        {reorderMut.isPending && (
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            Réordonnancement…
          </span>
        )}
      </div>

      {sorted.length === 0 && (
        <p className="text-muted" style={{ fontSize: '0.88rem', marginBottom: '1rem', fontStyle: 'italic' }}>
          Aucun composant — cet article est une prestation simple.
        </p>
      )}

      <div className="table-wrap">
        <table className="data-table data-table--compact">
          {sorted.length > 0 && (
            <thead>
              <tr>
                <th>Code</th>
                <th>Désignation</th>
                <th style={{ textAlign: 'right' }}>Prix unit.</th>
                <th style={{ textAlign: 'right' }}>Qté / unité</th>
                <th style={{ textAlign: 'center' }}>Optionnel</th>
                <th></th>
                <th style={{ whiteSpace: 'nowrap' }}>Ordre</th>
                <th></th>
              </tr>
            </thead>
          )}
          {sorted.length > 0 && (
            <tbody>
              {sorted.map((comp, idx) => (
                <CompositionRow
                  key={comp.id}
                  comp={comp}
                  articleId={articleId}
                  isFirst={idx === 0}
                  isLast={idx === sorted.length - 1}
                  onMoveUp={() => handleMove(idx, 'up')}
                  onMoveDown={() => handleMove(idx, 'down')}
                />
              ))}
            </tbody>
          )}
          <AddCompositionForm articleId={articleId} />
        </table>
      </div>
    </section>
  )
}
