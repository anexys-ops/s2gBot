import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import {
  articleSectionProductsApi,
  catalogueApi,
  type RefArticleRow,
  type RefQualificationTagRow,
} from '../../api/client'
import { collectSectionProducts } from '../../lib/s2gDevisCatalogue'
import { formatMoney } from '../../lib/appLocale'

export type S2gCatalogueProductPick = Pick<
  RefArticleRow,
  'id' | 'code' | 'libelle' | 'prix_unitaire_ht' | 'tva_rate' | 'kind' | 'unite' | 'actif'
>

export type S2gCataloguePickResult = {
  jalon: RefArticleRow
  products: S2gCatalogueProductPick[]
}

type Props = {
  onClose: () => void
  onPick: (result: S2gCataloguePickResult) => void | Promise<void>
}

type Step = 'qualification' | 'jalon' | 'products'

type ProductCandidate = S2gCatalogueProductPick & { source?: 'section' | 'jalon' }

function stepIndex(step: Step): number {
  if (step === 'qualification') return 0
  if (step === 'jalon') return 1
  return 2
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

export default function S2gCataloguePickerModal({ onClose, onPick }: Props) {
  const [step, setStep] = useState<Step>('qualification')
  const [qualification, setQualification] = useState<RefQualificationTagRow | null>(null)
  const [jalon, setJalon] = useState<RefArticleRow | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(() => new Set())
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAddedLabel, setLastAddedLabel] = useState<string | null>(null)

  const { data: qualificationTags = [], isLoading: loadingTags } = useQuery({
    queryKey: ['catalogue-qualification-tags'],
    queryFn: () => catalogueApi.qualificationTags(),
  })

  const { data: jalons = [], isLoading: loadingJalons } = useQuery({
    queryKey: ['catalogue', 's2g', 'jalon', 'by-qualif', qualification?.code ?? ''],
    queryFn: () =>
      catalogueApi.articles({
        kind: 'jalon',
        qualification_tag_code: qualification?.code,
      }),
    enabled: step !== 'qualification' && Boolean(qualification?.code),
  })

  const {
    data: productBundle,
    isLoading: loadingProducts,
    error: productsError,
  } = useQuery({
    queryKey: ['catalogue', 's2g', 'jalon-products', jalon?.id ?? 0],
    queryFn: async () => {
      if (!jalon) return { products: [] as ProductCandidate[] }
      const [detail, grouped] = await Promise.all([
        catalogueApi.article(jalon.id),
        articleSectionProductsApi.list(jalon.id).catch(() => null),
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
        jalonDetail: detail,
      }
    },
    enabled: step === 'products' && jalon != null,
  })

  const products = productBundle?.products ?? []

  useEffect(() => {
    if (step !== 'products') return
    // Default: nothing checked — user picks only what they need.
    setSelectedProductIds(new Set())
  }, [step, jalon?.id])

  const filteredTags = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = [...qualificationTags].sort((a, b) =>
      a.display_label.localeCompare(b.display_label, 'fr'),
    )
    if (!q) return list
    return list.filter(
      (t) =>
        t.display_label.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.groupe.toLowerCase().includes(q),
    )
  }, [qualificationTags, search])

  const filteredJalons = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = [...jalons].sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
    if (!q) return list
    return list.filter(
      (a) =>
        a.libelle.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.code_interne ?? '').toLowerCase().includes(q),
    )
  }, [jalons, search])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) => p.libelle.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    )
  }, [products, search])

  const searchPlaceholder =
    step === 'qualification'
      ? 'Rechercher une qualification…'
      : step === 'jalon'
        ? 'Rechercher un jalon…'
        : 'Rechercher un article…'

  function goQualification() {
    setStep('qualification')
    setJalon(null)
    setSelectedProductIds(new Set())
    setSearch('')
    setError(null)
  }

  function goJalon(next: RefQualificationTagRow) {
    setQualification(next)
    setJalon(null)
    setSelectedProductIds(new Set())
    setStep('jalon')
    setSearch('')
    setError(null)
  }

  function goProducts(next: RefArticleRow) {
    setJalon(next)
    setSelectedProductIds(new Set())
    setStep('products')
    setSearch('')
    setError(null)
  }

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

  function clearSelection() {
    setSelectedProductIds(new Set())
  }

  async function confirmAdd() {
    if (!jalon) return
    const selected = products.filter((p) => selectedProductIds.has(p.id))
    if (selected.length === 0) {
      setError('Sélectionnez au moins un article pour ce jalon.')
      return
    }
    setAdding(true)
    setError(null)
    try {
      await onPick({ jalon, products: selected })
      setLastAddedLabel(`${jalon.libelle} · ${selected.length} article${selected.length !== 1 ? 's' : ''}`)
      setQualification(null)
      setJalon(null)
      setSelectedProductIds(new Set())
      setStep('qualification')
      setSearch('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’ajouter la sélection.')
    } finally {
      setAdding(false)
    }
  }

  const idx = stepIndex(step)

  return (
    <Modal title="Catalogue S2G" onClose={onClose}>
      <p className="text-muted s2g-picker__intro">
        Parcours guidé : <strong>Qualification → Jalon → Articles</strong>. Vous pouvez enchaîner plusieurs
        ajouts.
      </p>

      <ol className="s2g-picker__steps" aria-label="Étapes du parcours">
        <li className={idx === 0 ? 'is-active' : idx > 0 ? 'is-done' : undefined}>1. Qualification</li>
        <li className={idx === 1 ? 'is-active' : idx > 1 ? 'is-done' : undefined}>2. Jalon</li>
        <li className={idx === 2 ? 'is-active' : undefined}>3. Articles</li>
      </ol>

      {lastAddedLabel ? (
        <p className="s2g-picker__success" role="status">
          Ajouté : {lastAddedLabel}. Continuez pour un autre, ou fermez.
        </p>
      ) : null}

      <div className="s2g-picker__crumbs">
        {qualification ? (
          <button type="button" className="s2g-picker__crumb" onClick={goQualification}>
            {qualification.display_label}
          </button>
        ) : (
          <span className="s2g-picker__crumb s2g-picker__crumb--muted">Qualification</span>
        )}
        <span className="s2g-picker__crumb-sep" aria-hidden>
          →
        </span>
        {jalon ? (
          <button
            type="button"
            className="s2g-picker__crumb"
            onClick={() => {
              setStep('jalon')
              setJalon(null)
              setSelectedProductIds(new Set())
              setSearch('')
            }}
          >
            {jalon.libelle}
          </button>
        ) : (
          <span className="s2g-picker__crumb s2g-picker__crumb--muted">Jalon</span>
        )}
        <span className="s2g-picker__crumb-sep" aria-hidden>
          →
        </span>
        <span className={`s2g-picker__crumb${step === 'products' ? '' : ' s2g-picker__crumb--muted'}`}>
          Articles
        </span>
      </div>

      <input
        type="search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: '0.75rem' }}
        autoFocus
      />

      {step === 'qualification' && (
        <>
          {loadingTags ? (
            <p>Chargement des qualifications…</p>
          ) : (
            <div className="catalog-picker-list">
              {filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="catalog-picker-row"
                  onClick={() => goJalon(tag)}
                >
                  <span className="catalog-picker-row__name">{tag.display_label}</span>
                  <span className="catalog-picker-row__meta">
                    {tag.code}
                    {tag.groupe ? ` · ${tag.groupe}` : ''}
                  </span>
                </button>
              ))}
              {filteredTags.length === 0 && (
                <p className="text-muted">Aucune qualification disponible dans le catalogue.</p>
              )}
            </div>
          )}
        </>
      )}

      {step === 'jalon' && qualification && (
        <>
          <div className="s2g-picker__toolbar">
            <button type="button" className="btn btn-secondary btn-sm" onClick={goQualification}>
              ← Qualifications
            </button>
          </div>
          {loadingJalons ? (
            <p>Chargement des jalons…</p>
          ) : (
            <div className="catalog-picker-list">
              {filteredJalons.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="catalog-picker-row"
                  onClick={() => goProducts(a)}
                >
                  <span className="catalog-picker-row__name">{a.libelle}</span>
                  <span className="catalog-picker-row__meta">{a.code}</span>
                </button>
              ))}
              {filteredJalons.length === 0 && (
                <p className="text-muted">
                  Aucun jalon pour la qualification « {qualification.display_label} ».
                </p>
              )}
            </div>
          )}
        </>
      )}

      {step === 'products' && jalon && (
        <>
          <div className="s2g-picker__toolbar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setStep('jalon')
                setJalon(null)
                setSelectedProductIds(new Set())
                setSearch('')
              }}
            >
              ← Jalons
            </button>
            <div className="s2g-picker__toolbar-right">
              <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllVisible} disabled={filteredProducts.length === 0}>
                Tout sélectionner
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearSelection} disabled={selectedProductIds.size === 0}>
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
                  Aucun article rattaché à ce jalon (catalogue / Actions &amp; matériel).
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
                Terminer
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void confirmAdd()}
                disabled={adding || selectedProductIds.size === 0}
              >
                {adding ? 'Ajout…' : 'Ajouter au devis'}
              </button>
            </div>
          </div>
        </>
      )}

      {step !== 'products' ? (
        <div className="s2g-picker__footer s2g-picker__footer--end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      ) : null}
    </Modal>
  )
}
