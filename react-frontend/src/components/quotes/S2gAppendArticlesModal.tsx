import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import { articleSectionProductsApi, catalogueApi, type RefArticleRow } from '../../api/client'
import { collectSectionProducts } from '../../lib/s2gDevisCatalogue'
import { formatMoney } from '../../lib/appLocale'
import type { S2gCataloguePickResult, S2gCatalogueProductPick } from './S2gCataloguePickerModal'

type ProductCandidate = S2gCatalogueProductPick & { source?: 'section' | 'jalon' }

type Props = {
  libelle: string
  refArticleId: number
  excludeProductIds?: number[]
  onClose: () => void
  onPick: (result: S2gCataloguePickResult) => void | Promise<void>
}

function toProductCandidate(
  p: Pick<RefArticleRow, 'id' | 'code' | 'libelle' | 'prix_unitaire_ht'> & {
    tva_rate?: string | number | null
    kind?: RefArticleRow['kind']
    unite?: string
    actif?: boolean
  },
  source: 'section' | 'jalon',
): ProductCandidate {
  return {
    id: p.id,
    code: p.code,
    libelle: p.libelle,
    prix_unitaire_ht: p.prix_unitaire_ht,
    tva_rate: p.tva_rate != null && p.tva_rate !== '' ? String(p.tva_rate) : '20',
    kind: p.kind ?? 'product',
    unite: p.unite ?? '',
    actif: p.actif ?? true,
    source,
  }
}

/** Modal dédié : ajouter des articles à un jalon déjà présent sur le devis. */
export default function S2gAppendArticlesModal({
  libelle,
  refArticleId,
  excludeProductIds = [],
  onClose,
  onPick,
}: Props) {
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(() => new Set())
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const excludeIds = useMemo(() => new Set(excludeProductIds), [excludeProductIds])

  const {
    data: productBundle,
    isLoading: loadingProducts,
    error: productsError,
  } = useQuery({
    queryKey: ['catalogue', 's2g', 'jalon-products-append', refArticleId],
    queryFn: async () => {
      const [detail, grouped] = await Promise.all([
        catalogueApi.article(refArticleId),
        articleSectionProductsApi.list(refArticleId).catch(() => null),
      ])
      const byId = new Map<number, ProductCandidate>()
      for (const row of collectSectionProducts(grouped ?? { technicien: [], ingenieur: [], labo: [] })) {
        if (!row.product) continue
        byId.set(row.product.id, toProductCandidate(row.product, 'section'))
      }
      for (const link of detail.jalon_products ?? []) {
        if (!link.product || byId.has(link.product.id)) continue
        byId.set(link.product.id, toProductCandidate(link.product, 'jalon'))
      }
      return {
        products: [...byId.values()].sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr')),
        jalonDetail: detail as RefArticleRow,
      }
    },
  })

  const products = productBundle?.products ?? []

  useEffect(() => {
    setSelectedProductIds(new Set())
  }, [refArticleId])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = products.filter((p) => !excludeIds.has(p.id))
    if (!q) return list
    return list.filter(
      (p) => p.libelle.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    )
  }, [products, search, excludeIds])

  const alreadyOnDevisCount = products.filter((p) => excludeIds.has(p.id)).length

  function toggleProduct(id: number) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      for (const p of filteredProducts) next.add(p.id)
      return next
    })
  }

  async function confirmAdd() {
    const jalon = productBundle?.jalonDetail
    if (!jalon) return
    const selected = products.filter((p) => selectedProductIds.has(p.id) && !excludeIds.has(p.id))
    if (selected.length === 0) {
      setError('Sélectionnez au moins un article pour ce jalon.')
      return
    }
    setAdding(true)
    setError(null)
    try {
      await onPick({ jalon, products: selected })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’ajouter la sélection.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Modal title={`Ajouter des articles — ${libelle}`} onClose={onClose}>
      <p className="text-muted s2g-picker__intro">
        Choisissez des articles du catalogue pour ce jalon déjà présent sur le devis
        {alreadyOnDevisCount > 0
          ? ` (${alreadyOnDevisCount} déjà sur le devis, masqué${alreadyOnDevisCount > 1 ? 's' : ''})`
          : ''}
        .
      </p>

      <input
        type="search"
        placeholder="Rechercher un article…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: '0.75rem' }}
        autoFocus
      />

      <div className="s2g-picker__toolbar">
        <div className="s2g-picker__toolbar-right" style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={selectAllVisible}
            disabled={filteredProducts.length === 0}
          >
            Tout sélectionner
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedProductIds(new Set())}
            disabled={selectedProductIds.size === 0}
          >
            Tout désélectionner
          </button>
        </div>
      </div>

      {loadingProducts ? (
        <p>Chargement des articles…</p>
      ) : productsError ? (
        <p className="error">{(productsError as Error).message}</p>
      ) : (
        <div className="catalog-picker-list catalog-picker-list--checks">
          {filteredProducts.map((p) => {
            const checked = selectedProductIds.has(p.id)
            return (
              <label
                key={p.id}
                className={`catalog-picker-row catalog-picker-row--check${checked ? ' is-selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleProduct(p.id)}
                />
                <span className="catalog-picker-row__check-body">
                  <span className="catalog-picker-row__name">{p.libelle}</span>
                  <span className="catalog-picker-row__meta">
                    {p.code}
                    {` · ${formatMoney(Number(p.prix_unitaire_ht))} (HT)`}
                    {p.tva_rate != null ? ` · TVA ${Number(p.tva_rate).toFixed(0)} %` : ''}
                  </span>
                </span>
              </label>
            )
          })}
          {filteredProducts.length === 0 && (
            <p className="text-muted">
              {alreadyOnDevisCount > 0
                ? 'Tous les articles catalogue de ce jalon sont déjà sur le devis.'
                : 'Aucun article rattaché à ce jalon (catalogue / Actions & matériel).'}
            </p>
          )}
        </div>
      )}

      {error ? <p className="error">{error}</p> : null}

      <div className="s2g-picker__footer">
        <span className="text-muted s2g-picker__count">
          {selectedProductIds.size} sélectionné{selectedProductIds.size !== 1 ? 's' : ''}
        </span>
        <div className="s2g-picker__footer-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={adding}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void confirmAdd()}
            disabled={adding || selectedProductIds.size === 0}
          >
            {adding ? 'Ajout…' : 'Ajouter au jalon'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
