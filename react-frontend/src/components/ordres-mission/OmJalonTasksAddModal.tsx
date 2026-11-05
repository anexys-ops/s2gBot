import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { catalogueApi, ordresMissionApi, type OrdreMission } from '../../api/client'
import Modal from '../Modal'

type Props = {
  om: OrdreMission
  jalon: { id: string; label: string; code?: string | null }
  onClose: () => void
  onCreated: () => void
}

/**
 * Ajout de tâches sous un jalon : tous les produits du catalogue, sélection multiple et
 * quantité par produit — chaque produit coché devient une tâche du jalon.
 */
export default function OmJalonTasksAddModal({ om, jalon, onClose, onCreated }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<number, string>>({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['catalogue-products-om-jalon'],
    queryFn: () => catalogueApi.articles({ kind: 'product' }),
    staleTime: 60_000,
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr')
    if (!term) return articles
    return articles.filter((a) =>
      `${a.code ?? ''} ${a.libelle ?? ''}`.toLocaleLowerCase('fr').includes(term))
  }, [articles, search])

  const selectedIds = Object.keys(selected).map(Number)

  function toggle(id: number) {
    setSelected((prev) => {
      const next = { ...prev }
      if (id in next) delete next[id]
      else next[id] = '1'
      return next
    })
  }

  async function submit() {
    setError('')
    const items = selectedIds.map((id) => ({
      ref_article_id: id,
      quantite: Number(String(selected[id]).replace(',', '.')),
    }))
    if (items.length === 0) {
      setError('Sélectionnez au moins un produit.')
      return
    }
    if (items.some((i) => !Number.isFinite(i.quantite) || i.quantite <= 0)) {
      setError('Chaque produit sélectionné doit avoir une quantité supérieure à 0.')
      return
    }
    setPending(true)
    try {
      await ordresMissionApi.createLignesBatch(om.id, { devis_jalon_id: jalon.id, items })
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’ajouter les tâches.')
    } finally {
      setPending(false)
    }
  }

  const jalonTitle = `${jalon.code ? `${jalon.code} — ` : ''}${jalon.label}`

  return (
    <Modal title={`Ajouter des tâches — ${jalonTitle}`} onClose={pending ? () => {} : onClose} size="wide">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un produit (code, libellé)…"
        style={{ width: '100%', marginBottom: '0.75rem' }}
        autoFocus
      />
      <div className="table-wrap" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        {isLoading ? (
          <p className="text-muted">Chargement des produits…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted">Aucun produit.</p>
        ) : (
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th style={{ width: '2rem' }} />
                <th>Code</th>
                <th>Produit</th>
                <th className="data-table__num">Quantité</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const checked = a.id in selected
                return (
                  <tr key={a.id} onClick={() => toggle(a.id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(a.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Sélectionner ${a.libelle}`}
                      />
                    </td>
                    <td><code className="code-badge">{a.code}</code></td>
                    <td>{a.libelle}</td>
                    <td className="data-table__num" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={selected[a.id] ?? ''}
                        disabled={!checked}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        style={{ width: '6rem' }}
                        aria-label={`Quantité pour ${a.libelle}`}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {error ? <p className="error" style={{ marginTop: '0.75rem' }}>{error}</p> : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
        <span className="text-muted">{selectedIds.length} produit(s) sélectionné(s)</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={pending || selectedIds.length === 0}>
            {pending ? 'Ajout…' : `Ajouter ${selectedIds.length || ''} tâche(s)`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
