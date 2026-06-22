import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  catalogueApi,
  type RefArticleRow,
  type RefQualificationTagRow,
} from '../../api/client'
import CatalogueMultiPicker, { shortCatalogueOptionLabel } from './CatalogueMultiPicker'

type Props = {
  article: RefArticleRow
  onUpdated: () => void
}

function safeNum(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

type FormState = {
  libelle: string
  familleLabel: string
  codeInterne: string
  sku: string
  unite: string
  prixUnitaireHt: string
  tvaRate: string
  actif: boolean
  descriptionCommerciale: string
  descriptionTechnique: string
  normes: string
  qualificationTagIds: number[]
  productArticleIds: number[]
  jalonArticleIds: number[]
}

function tagIdsFromArticle(article: RefArticleRow): number[] {
  return (article.qualification_tags ?? []).map((t) => t.id)
}

function productIdsFromArticle(article: RefArticleRow): number[] {
  return (article.jalon_products ?? [])
    .map((row) => row.product?.id)
    .filter((id): id is number => id != null)
}

function jalonIdsFromArticle(article: RefArticleRow): number[] {
  return (article.product_jalons ?? [])
    .map((row) => row.jalon?.id)
    .filter((id): id is number => id != null)
}

function formFromArticle(article: RefArticleRow): FormState {
  return {
    libelle: article.libelle,
    familleLabel: article.famille_label ?? '',
    codeInterne: article.code_interne ?? '',
    sku: article.sku ?? '',
    unite: article.unite ?? 'U',
    prixUnitaireHt: String(safeNum(article.prix_unitaire_ht, 0)),
    tvaRate: String(safeNum(article.tva_rate, 20)),
    actif: article.actif,
    descriptionCommerciale: article.description_commerciale ?? '',
    descriptionTechnique: article.description_technique ?? '',
    normes: article.normes ?? '',
    qualificationTagIds: tagIdsFromArticle(article),
    productArticleIds: productIdsFromArticle(article),
    jalonArticleIds: jalonIdsFromArticle(article),
  }
}

export default function ArticleS2gEditor({ article, onUpdated }: Props) {
  const isJalon = article.kind === 'jalon'
  const isProduct = article.kind === 'product'
  const [form, setForm] = useState<FormState>(() => formFromArticle(article))
  const [saved, setSaved] = useState(false)
  const [productFilter, setProductFilter] = useState('')
  const [jalonFilter, setJalonFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const { data: qualificationTags = [] } = useQuery({
    queryKey: ['catalogue-qualification-tags'],
    queryFn: () => catalogueApi.qualificationTags(),
    enabled: isJalon,
  })

  const { data: productArticles = [] } = useQuery({
    queryKey: ['catalogue-articles', 'product-pick'],
    queryFn: () => catalogueApi.articles({ kind: 'product', with_inactif: true }),
    enabled: isJalon,
  })

  const { data: jalonArticles = [] } = useQuery({
    queryKey: ['catalogue-articles', 'jalon-pick'],
    queryFn: () => catalogueApi.articles({ kind: 'jalon', with_inactif: true }),
    enabled: isProduct,
  })

  const tagItems = useMemo(
    () =>
      [...qualificationTags]
        .sort((a, b) => a.groupe.localeCompare(b.groupe, 'fr') || a.code.localeCompare(b.code, 'fr'))
        .map((tag: RefQualificationTagRow) => ({
          id: tag.id,
          label: tag.display_label || `${tag.code} — ${tag.label}`,
        })),
    [qualificationTags],
  )

  const productItems = useMemo(
    () =>
      [...productArticles]
        .filter((a) => a.id !== article.id)
        .sort((a, b) => a.code.localeCompare(b.code, 'fr'))
        .map((a) => ({ id: a.id, label: shortCatalogueOptionLabel(a.code, a.libelle) })),
    [productArticles, article.id],
  )

  const jalonItems = useMemo(
    () =>
      [...jalonArticles]
        .filter((a) => a.id !== article.id)
        .sort((a, b) => a.code.localeCompare(b.code, 'fr'))
        .map((a) => ({ id: a.id, label: shortCatalogueOptionLabel(a.code, a.libelle) })),
    [jalonArticles, article.id],
  )

  const mut = useMutation({
    mutationFn: () =>
      catalogueApi.updateArticle(article.id, {
        libelle: form.libelle.trim(),
        famille_label: isJalon ? form.familleLabel.trim() || null : undefined,
        code_interne: form.codeInterne.trim() || null,
        sku: form.sku.trim() || null,
        unite: form.unite.trim() || 'U',
        prix_unitaire_ht: form.prixUnitaireHt.trim() !== '' ? form.prixUnitaireHt : '0',
        tva_rate: form.tvaRate.trim() !== '' ? form.tvaRate : '20',
        actif: form.actif,
        description_commerciale: form.descriptionCommerciale.trim() || null,
        description_technique: form.descriptionTechnique.trim() || null,
        normes: form.normes.trim() || null,
        qualification_tag_ids: isJalon ? form.qualificationTagIds : undefined,
        product_article_ids: isJalon ? form.productArticleIds : undefined,
        jalon_article_ids: isProduct ? form.jalonArticleIds : undefined,
      }),
    onSuccess: () => {
      setSaved(true)
      onUpdated()
      window.setTimeout(() => setSaved(false), 4000)
    },
  })

  useEffect(() => {
    setForm(formFromArticle(article))
  }, [article])

  return (
    <div className="article-edit">
      <section className="card dossier-tab-panel">
        <h2 className="ds-form-section__title">Modifier l&apos;article S2G</h2>
        <p className="dossier-tab-panel__intro">
          Mise à jour du libellé, des tarifs, des descriptions et des liens catalogue. Le code et la famille ne sont pas
          modifiables ici.
        </p>
        <dl className="article-edit__meta">
          <div>
            <dt>Type</dt>
            <dd>
              {isJalon ? (
                <span className="status-pill status-pill--info">Jalon S2G</span>
              ) : (
                <span className="status-pill status-pill--muted">Produit S2G</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Code article</dt>
            <dd>
              <code className="code-badge">{article.code}</code>
            </dd>
          </div>
          <div>
            <dt>Famille</dt>
            <dd>
              {article.famille ? (
                <>
                  <span className="article-edit__family-code">{article.famille.code}</span>
                  <span className="text-muted"> — {article.famille.libelle}</span>
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card dossier-tab-panel article-edit__form-panel">
        <form
          className="catalogue-article-new-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.libelle.trim()) return
            mut.mutate()
          }}
        >
          <section className="catalogue-article-new-form__section">
            <h3 className="catalogue-article-new-form__section-title">Identité</h3>
            <div className="catalogue-article-new-form__grid">
              <label className="catalogue-article-new-form__col-12">
                Libellé *
                <input
                  value={form.libelle}
                  onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
                  required
                />
              </label>
              {isJalon && (
                <label className="catalogue-article-new-form__col-12">
                  Famille S2G (libellé)
                  <input
                    value={form.familleLabel}
                    onChange={(e) => setForm((f) => ({ ...f, familleLabel: e.target.value }))}
                    placeholder="Ex. Béton, Géotechnique…"
                    maxLength={255}
                  />
                </label>
              )}
              <label className="catalogue-article-new-form__col-4">
                Code interne
                <input
                  value={form.codeInterne}
                  onChange={(e) => setForm((f) => ({ ...f, codeInterne: e.target.value }))}
                  maxLength={64}
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                SKU
                <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} maxLength={64} />
              </label>
              <label className="catalogue-article-new-form__col-4 catalogue-article-new-form__checkbox-field">
                <span>Statut</span>
                <span className="catalogue-article-new-form__checkbox-control">
                  <input
                    type="checkbox"
                    checked={form.actif}
                    onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))}
                  />
                  <span>Article actif</span>
                </span>
              </label>
            </div>
          </section>

          {isJalon && (
            <section className="catalogue-article-new-form__section">
              <h3 className="catalogue-article-new-form__section-title">Qualification & produits liés</h3>
              <div className="catalogue-article-new-form__grid">
                <div className="catalogue-article-new-form__col-6 catalogue-article-new-form__field">
                  <span className="catalogue-article-new-form__field-label">Tags de qualification (0 ou plusieurs)</span>
                  <CatalogueMultiPicker
                    items={tagItems}
                    selectedIds={form.qualificationTagIds}
                    onChange={(ids) => setForm((f) => ({ ...f, qualificationTagIds: ids }))}
                    filter={tagFilter}
                    onFilterChange={setTagFilter}
                    emptyLabel="Aucun tag ne correspond au filtre."
                  />
                </div>
                <div className="catalogue-article-new-form__col-6 catalogue-article-new-form__field">
                  <span className="catalogue-article-new-form__field-label">Produits rattachés (0 ou plusieurs)</span>
                  <CatalogueMultiPicker
                    items={productItems}
                    selectedIds={form.productArticleIds}
                    onChange={(ids) => setForm((f) => ({ ...f, productArticleIds: ids }))}
                    filter={productFilter}
                    onFilterChange={setProductFilter}
                    emptyLabel="Aucun produit ne correspond au filtre."
                  />
                </div>
              </div>
            </section>
          )}

          {isProduct && (
            <section className="catalogue-article-new-form__section">
              <h3 className="catalogue-article-new-form__section-title">Jalons liés</h3>
              <div className="catalogue-article-new-form__grid">
                <div className="catalogue-article-new-form__col-12 catalogue-article-new-form__field">
                  <span className="catalogue-article-new-form__field-label">Jalons (0 ou plusieurs)</span>
                  <CatalogueMultiPicker
                    items={jalonItems}
                    selectedIds={form.jalonArticleIds}
                    onChange={(ids) => setForm((f) => ({ ...f, jalonArticleIds: ids }))}
                    filter={jalonFilter}
                    onFilterChange={setJalonFilter}
                    emptyLabel="Aucun jalon ne correspond au filtre."
                  />
                </div>
              </div>
            </section>
          )}

          <section className="catalogue-article-new-form__section">
            <h3 className="catalogue-article-new-form__section-title">Tarification & unités</h3>
            <div className="catalogue-article-new-form__grid">
              <label className="catalogue-article-new-form__col-4">
                Unité
                <input
                  value={form.unite}
                  onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))}
                  placeholder="U, m², forfait…"
                  maxLength={32}
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                Prix unitaire HT
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.prixUnitaireHt}
                  onChange={(e) => setForm((f) => ({ ...f, prixUnitaireHt: e.target.value }))}
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                TVA (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.tvaRate}
                  onChange={(e) => setForm((f) => ({ ...f, tvaRate: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="catalogue-article-new-form__section">
            <h3 className="catalogue-article-new-form__section-title">Descriptions & normes</h3>
            <div className="catalogue-article-new-form__grid">
              <label className="catalogue-article-new-form__col-12">
                Description commerciale
                <textarea
                  rows={3}
                  value={form.descriptionCommerciale}
                  onChange={(e) => setForm((f) => ({ ...f, descriptionCommerciale: e.target.value }))}
                />
              </label>
              <label className="catalogue-article-new-form__col-12">
                Description technique
                <textarea
                  rows={4}
                  value={form.descriptionTechnique}
                  onChange={(e) => setForm((f) => ({ ...f, descriptionTechnique: e.target.value }))}
                />
              </label>
              <label className="catalogue-article-new-form__col-12">
                Normes
                <input value={form.normes} onChange={(e) => setForm((f) => ({ ...f, normes: e.target.value }))} />
              </label>
            </div>
          </section>

          {mut.isError ? <p className="error">{(mut.error as Error).message}</p> : null}
          {saved ? <p className="article-edit__saved text-muted">Modifications enregistrées.</p> : null}

          <div className="crud-actions catalogue-article-new-form__actions article-edit__actions">
            <button type="submit" className="btn btn-primary" disabled={mut.isPending || !form.libelle.trim()}>
              {mut.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={mut.isPending}
              onClick={() => setForm(formFromArticle(article))}
            >
              Annuler les modifications
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
