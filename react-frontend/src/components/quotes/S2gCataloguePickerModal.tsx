import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import {
  articleSectionProductsApi,
  catalogueApi,
  commercialOfferingsApi,
  type RefArticleRow,
  type RefQualificationTagRow,
} from '../../api/client'
import { formatMoney } from '../../lib/appLocale'
import {
  buildJalonCountByQualificationCode,
  buildStockByArticleCode,
  formatProductCount,
  formatStockBadge,
  groupQualificationTags,
  groupeTone,
  hasPrice,
  sectionLabel,
  sortJalons,
  stockBadgeClass,
  tagChipTone,
  type ProductSectionKind,
  type S2gPickerSort,
} from '../../lib/s2gCataloguePickerUtils'

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

type ProductCandidate = S2gCatalogueProductPick & {
  source?: 'section' | 'jalon'
  section?: ProductSectionKind
}

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
  section?: ProductSectionKind,
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
    section: section ?? (source === 'jalon' ? 'jalon' : undefined),
  }
}

function SortSelect({
  value,
  onChange,
  showCount,
}: {
  value: S2gPickerSort
  onChange: (v: S2gPickerSort) => void
  showCount?: boolean
}) {
  return (
    <label className="s2g-picker__sort">
      <span className="s2g-picker__sort-label">Tri</span>
      <select value={value} onChange={(e) => onChange(e.target.value as S2gPickerSort)}>
        <option value="name-asc">Nom A → Z</option>
        <option value="name-desc">Nom Z → A</option>
        {showCount ? <option value="count-desc">Nombre ↓</option> : null}
      </select>
    </label>
  )
}

export default function S2gCataloguePickerModal({ onClose, onPick }: Props) {
  const [step, setStep] = useState<Step>('qualification')
  const [qualification, setQualification] = useState<RefQualificationTagRow | null>(null)
  const [jalon, setJalon] = useState<RefArticleRow | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(() => new Set())
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<S2gPickerSort>('name-asc')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAddedLabel, setLastAddedLabel] = useState<string | null>(null)

  const { data: qualificationTags = [], isLoading: loadingTags } = useQuery({
    queryKey: ['catalogue-qualification-tags'],
    queryFn: () => catalogueApi.qualificationTags(),
  })

  const { data: allJalons = [] } = useQuery({
    queryKey: ['catalogue', 's2g', 'jalon', 'all-for-counts'],
    queryFn: () => catalogueApi.articles({ kind: 'jalon', with_products_count: true }),
    staleTime: 60_000,
  })

  const jalonCountByCode = useMemo(() => buildJalonCountByQualificationCode(allJalons), [allJalons])

  const { data: jalons = [], isLoading: loadingJalons } = useQuery({
    queryKey: ['catalogue', 's2g', 'jalon', 'by-qualif', qualification?.code ?? ''],
    queryFn: () =>
      catalogueApi.articles({
        kind: 'jalon',
        qualification_tag_code: qualification?.code,
        with_products_count: true,
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
      const id = jalon?.id
      if (!id) return { products: [] as ProductCandidate[], jalonDetail: null as RefArticleRow | null }
      const [detail, grouped] = await Promise.all([
        catalogueApi.article(id),
        articleSectionProductsApi.list(id).catch(() => null),
      ])
      const byId = new Map<number, ProductCandidate>()
      for (const section of ['technicien', 'ingenieur', 'labo'] as const) {
        for (const row of grouped?.[section] ?? []) {
          if (!row.product || byId.has(row.product.id)) continue
          byId.set(row.product.id, toProductCandidate(row.product, 'section', section))
        }
      }
      for (const link of detail.jalon_products ?? []) {
        if (!link.product || byId.has(link.product.id)) continue
        byId.set(link.product.id, toProductCandidate(link.product, 'jalon', 'jalon'))
      }
      return {
        products: [...byId.values()].sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr')),
        jalonDetail: detail as RefArticleRow,
      }
    },
    enabled: step === 'products' && jalon != null,
  })

  const { data: stockOfferingsPage } = useQuery({
    queryKey: ['commercial-offerings', 'stock-picker'],
    queryFn: () => commercialOfferingsApi.list({ track_stock: true, per_page: 500, page: 1 }),
    enabled: step === 'products',
    staleTime: 120_000,
  })

  const stockByCode = useMemo(
    () => buildStockByArticleCode(stockOfferingsPage?.data ?? []),
    [stockOfferingsPage?.data],
  )

  const products = productBundle?.products ?? []

  useEffect(() => {
    if (step !== 'products') return
    setSelectedProductIds(new Set())
  }, [step, jalon?.id])

  const filteredTags = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return qualificationTags
    return qualificationTags.filter(
      (t) =>
        t.display_label.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.groupe.toLowerCase().includes(q),
    )
  }, [qualificationTags, search])

  const qualificationGroups = useMemo(
    () => groupQualificationTags(filteredTags, jalonCountByCode, sort),
    [filteredTags, jalonCountByCode, sort],
  )

  const filteredJalons = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = sortJalons(jalons, sort)
    if (!q) return list
    return list.filter(
      (a) =>
        a.libelle.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.code_interne ?? '').toLowerCase().includes(q) ||
        (a.famille_label ?? '').toLowerCase().includes(q),
    )
  }, [jalons, search, sort])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = [...products].sort((a, b) => {
      if (sort === 'name-desc') return b.libelle.localeCompare(a.libelle, 'fr')
      return a.libelle.localeCompare(b.libelle, 'fr')
    })
    if (!q) return list
    return list.filter(
      (p) => p.libelle.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    )
  }, [products, search, sort])

  const productsBySection = useMemo(() => {
    const sections = new Map<ProductSectionKind, ProductCandidate[]>()
    for (const p of filteredProducts) {
      const key = p.section ?? 'jalon'
      const list = sections.get(key) ?? []
      list.push(p)
      sections.set(key, list)
    }
    const order: ProductSectionKind[] = ['technicien', 'ingenieur', 'labo', 'jalon']
    return order
      .filter((k) => (sections.get(k)?.length ?? 0) > 0)
      .map((k) => ({ section: k, products: sections.get(k)! }))
  }, [filteredProducts])

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
    const activeJalon = jalon ?? productBundle?.jalonDetail
    if (!activeJalon) return
    const selected = products.filter((p) => selectedProductIds.has(p.id))
    if (selected.length === 0) {
      setError('Sélectionnez au moins un article pour ce jalon.')
      return
    }
    setAdding(true)
    setError(null)
    try {
      await onPick({ jalon: activeJalon, products: selected })
      setLastAddedLabel(
        `${activeJalon.libelle} · ${selected.length} article${selected.length !== 1 ? 's' : ''}`,
      )
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
  const productsReady = step === 'products' && jalon != null

  function renderProductRow(p: ProductCandidate) {
    const checked = selectedProductIds.has(p.id)
    const stockOffering = stockByCode.get(p.code.trim().toLowerCase())
    const stockLabel = formatStockBadge(stockOffering)
    const priceNum = Number(p.prix_unitaire_ht)
    const showPrice = hasPrice(p.prix_unitaire_ht)

    return (
      <label
        key={p.id}
        className={`catalog-picker-row catalog-picker-row--check catalog-picker-row--rich${checked ? ' is-selected' : ''}`}
      >
        <input type="checkbox" checked={checked} onChange={() => toggleProduct(p.id)} />
        <span className="catalog-picker-row__check-body">
          <span className="catalog-picker-row__head">
            <span className="catalog-picker-row__name">{p.libelle}</span>
            <span className="catalog-picker-row__badges">
              {showPrice ? (
                <span className="s2g-picker__price">{formatMoney(priceNum)} HT</span>
              ) : (
                <span className="s2g-picker__price s2g-picker__price--muted">Prix —</span>
              )}
              {stockLabel ? (
                <span className={stockBadgeClass(stockOffering)}>{stockLabel}</span>
              ) : null}
            </span>
          </span>
          <span className="catalog-picker-row__meta">
            <code className="catalog-picker-row__code">{p.code}</code>
            {p.unite ? ` · ${p.unite}` : ''}
            {p.tva_rate != null ? ` · TVA ${Number(p.tva_rate).toFixed(0)} %` : ''}
          </span>
          {p.section ? (
            <span className="catalog-picker-row__tags">
              <span className={`catalogue-prolab-tag ${tagChipTone(0)}`}>{sectionLabel(p.section)}</span>
            </span>
          ) : null}
        </span>
      </label>
    )
  }

  return (
    <Modal title="Catalogue S2G" onClose={onClose}>
      <div className="s2g-picker-modal">
      <p className="text-muted s2g-picker__intro">
        Parcours guidé : <strong>Qualification → Jalon → Articles</strong>. Vous pouvez enchaîner plusieurs ajouts.
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

      <div className="s2g-picker__filters">
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="s2g-picker__search"
          autoFocus
        />
        <SortSelect value={sort} onChange={setSort} showCount={step === 'qualification' || step === 'jalon'} />
      </div>

      {step === 'qualification' && (
        <>
          {loadingTags ? (
            <p>Chargement des qualifications…</p>
          ) : (
            <div className="s2g-picker__groups">
              {qualificationGroups.map((group) => {
                const tone = groupeTone(group.groupe)
                return (
                  <section
                    key={group.groupe}
                    className="s2g-picker__group"
                    style={{
                      ['--s2g-group-bg' as string]: tone.bg,
                      ['--s2g-group-border' as string]: tone.border,
                      ['--s2g-group-text' as string]: tone.text,
                      ['--s2g-group-accent' as string]: tone.accent,
                    }}
                  >
                    <header className="s2g-picker__group-header">
                      <h3 className="s2g-picker__group-title">{group.groupe}</h3>
                      <span className="s2g-picker__group-count">
                        {formatProductCount(group.tags.length, 'qualification')}
                        {' · '}
                        {formatProductCount(group.jalonCount, 'jalon')}
                      </span>
                    </header>
                    <div className="catalog-picker-list">
                      {group.tags.map((tag, tagIdx) => {
                        const jalonCount = jalonCountByCode.get(tag.code) ?? 0
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            className="catalog-picker-row catalog-picker-row--rich"
                            onClick={() => goJalon(tag)}
                          >
                            <span className="catalog-picker-row__head">
                              <span className="catalog-picker-row__name">{tag.display_label}</span>
                              <span className="s2g-picker__count-badge">
                                {formatProductCount(jalonCount, 'jalon')}
                              </span>
                            </span>
                            <span className="catalog-picker-row__meta">
                              <span className={`catalogue-prolab-tag ${tagChipTone(tagIdx)}`}>{tag.code}</span>
                              {tag.label !== tag.display_label ? (
                                <span className="catalog-picker-row__meta-text">{tag.label}</span>
                              ) : null}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
              {qualificationGroups.length === 0 && (
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
            <span className="s2g-picker__context-tag">
              <span className={`catalogue-prolab-tag ${tagChipTone(0)}`}>{qualification.display_label}</span>
            </span>
          </div>
          {loadingJalons ? (
            <p>Chargement des jalons…</p>
          ) : (
            <div className="catalog-picker-list">
              {filteredJalons.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="catalog-picker-row catalog-picker-row--rich"
                  onClick={() => goProducts(a)}
                >
                  <span className="catalog-picker-row__head">
                    <span className="catalog-picker-row__name">{a.libelle}</span>
                    <span className="s2g-picker__count-badge">
                      {formatProductCount(a.products_count ?? 0, 'article')}
                    </span>
                  </span>
                  <span className="catalog-picker-row__meta">
                    <code className="catalog-picker-row__code">{a.code}</code>
                    {a.famille_label ? (
                      <span className={`catalogue-prolab-tag ${tagChipTone(1)}`}>{a.famille_label}</span>
                    ) : null}
                    {(a.qualification_tags ?? []).slice(0, 2).map((t, i) => (
                      <span key={t.id} className={`catalogue-prolab-tag ${tagChipTone(i + 2)}`}>
                        {t.code}
                      </span>
                    ))}
                  </span>
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

      {productsReady ? (
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
                onClick={clearSelection}
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
          ) : productsBySection.length > 1 ? (
            <div className="s2g-picker__groups s2g-picker__groups--products">
              {productsBySection.map(({ section, products: sectionProducts }) => {
                const tone = groupeTone(sectionLabel(section))
                return (
                  <section
                    key={section}
                    className="s2g-picker__group s2g-picker__group--compact"
                    style={{
                      ['--s2g-group-bg' as string]: tone.bg,
                      ['--s2g-group-border' as string]: tone.border,
                      ['--s2g-group-text' as string]: tone.text,
                      ['--s2g-group-accent' as string]: tone.accent,
                    }}
                  >
                    <header className="s2g-picker__group-header">
                      <h3 className="s2g-picker__group-title">{sectionLabel(section)}</h3>
                      <span className="s2g-picker__group-count">
                        {formatProductCount(sectionProducts.length, 'article')}
                      </span>
                    </header>
                    <div className="catalog-picker-list catalog-picker-list--checks">
                      {sectionProducts.map(renderProductRow)}
                    </div>
                  </section>
                )
              })}
              {filteredProducts.length === 0 && (
                <p className="text-muted">
                  Aucun article rattaché à ce jalon (catalogue / Actions & matériel).
                </p>
              )}
            </div>
          ) : (
            <div className="catalog-picker-list catalog-picker-list--checks">
              {filteredProducts.map(renderProductRow)}
              {filteredProducts.length === 0 && (
                <p className="text-muted">
                  Aucun article rattaché à ce jalon (catalogue / Actions & matériel).
                </p>
              )}
            </div>
          )}

          {error ? <p className="error">{error}</p> : null}

          <div className="s2g-picker__footer">
            <span className="text-muted s2g-picker__count">
              {selectedProductIds.size} sélectionné{selectedProductIds.size !== 1 ? 's' : ''}
              {filteredProducts.length > 0
                ? ` · ${filteredProducts.length} visible${filteredProducts.length !== 1 ? 's' : ''}`
                : ''}
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
      ) : null}

      {step !== 'products' ? (
        <div className="s2g-picker__footer s2g-picker__footer--end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      ) : null}
      </div>
    </Modal>
  )
}
