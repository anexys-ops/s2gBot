import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { catalogueApi, type RefArticleRow } from '../../api/client'

type Props = {
  article: RefArticleRow
  onUpdated: () => void
}

function safeNum(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function shortOptionLabel(code: string, label: string, max = 60) {
  const text = `${code} — ${label}`
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

type FormState = {
  libelle: string
  description: string
  description_commerciale: string
  description_technique: string
  tags: string
  code_interne: string
  sku: string
  unite: string
  hfsql_unite: string
  prix_unitaire_ht: number
  prix_revient_ht: number | undefined
  tva_rate: number
  duree_estimee: number
  normes: string
  actif: boolean
  ref_article_lie_id: string
}

function formFromArticle(article: RefArticleRow): FormState {
  return {
    libelle: article.libelle,
    description: article.description ?? '',
    description_commerciale: article.description_commerciale ?? '',
    description_technique: article.description_technique ?? '',
    tags: (article.tags ?? []).join(', '),
    code_interne: article.code_interne ?? '',
    sku: article.sku ?? '',
    unite: article.unite ?? '',
    hfsql_unite: article.hfsql_unite ?? '',
    prix_unitaire_ht: safeNum(article.prix_unitaire_ht, 0),
    prix_revient_ht:
      article.prix_revient_ht != null && String(article.prix_revient_ht).trim() !== ''
        ? safeNum(article.prix_revient_ht, 0)
        : undefined,
    tva_rate: safeNum(article.tva_rate, 20),
    duree_estimee: article.duree_estimee ?? 0,
    normes: article.normes ?? '',
    actif: article.actif,
    ref_article_lie_id: article.ref_article_lie_id != null ? String(article.ref_article_lie_id) : '',
  }
}

export default function ArticleProlabEditor({ article, onUpdated }: Props) {
  const [form, setForm] = useState<FormState>(() => formFromArticle(article))
  const [saved, setSaved] = useState(false)

  const { data: articlesLiePick = [] } = useQuery({
    queryKey: ['catalogue-articles', 'lie-pick'],
    queryFn: () => catalogueApi.articles({ with_inactif: true }),
  })

  const lieOptions = useMemo(
    () => articlesLiePick.filter((a) => a.id !== article.id).sort((a, b) => a.code.localeCompare(b.code, 'fr')),
    [articlesLiePick, article.id],
  )

  const mut = useMutation({
    mutationFn: (body: Record<string, unknown>) => catalogueApi.updateArticle(article.id, body),
    onSuccess: () => {
      setSaved(true)
      onUpdated()
      window.setTimeout(() => setSaved(false), 4000)
    },
  })

  useEffect(() => {
    setForm(formFromArticle(article))
  }, [article])

  function buildPayload() {
    const prix = Number(form.prix_unitaire_ht)
    const tva = Number(form.tva_rate)
    const tags = form.tags
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const pr = form.prix_revient_ht
    return {
      libelle: form.libelle,
      description: form.description || null,
      description_commerciale: form.description_commerciale?.trim() || null,
      description_technique: form.description_technique?.trim() || null,
      tags: tags.length ? tags : null,
      code_interne: form.code_interne?.trim() || null,
      sku: form.sku?.trim() || null,
      unite: form.unite || null,
      hfsql_unite: form.hfsql_unite?.trim() || null,
      prix_unitaire_ht: Number.isFinite(prix) ? prix : 0,
      prix_revient_ht: pr != null && Number.isFinite(pr) && pr >= 0 ? pr : null,
      tva_rate: Number.isFinite(tva) ? tva : 20,
      duree_estimee: form.duree_estimee,
      normes: form.normes || null,
      actif: form.actif,
      ref_article_lie_id: form.ref_article_lie_id ? Number(form.ref_article_lie_id) : null,
    }
  }

  return (
    <div className="article-edit">
      <section className="card dossier-tab-panel">
        <h2 className="ds-form-section__title">Modifier l&apos;article</h2>
        <p className="dossier-tab-panel__intro">
          Mise à jour des champs commerciaux, tarifaires et pédagogiques. Le code article et la famille ne sont pas
          modifiables ici.
        </p>
        <dl className="article-edit__meta">
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
          <div>
            <dt>Statut</dt>
            <dd>
              {article.actif ? (
                <span className="status-pill status-pill--ok">Actif</span>
              ) : (
                <span className="status-pill status-pill--muted">Inactif</span>
              )}
            </dd>
          </div>
          {article.article_lie ? (
            <div>
              <dt>Regroupement actuel</dt>
              <dd>
                <Link to={`/catalogue/articles/${article.article_lie.id}`} className="link-inline">
                  {article.article_lie.code} — {article.article_lie.libelle}
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="card dossier-tab-panel article-edit__form-panel">
        <form
          className="catalogue-article-new-form"
          onSubmit={(e) => {
            e.preventDefault()
            mut.mutate(buildPayload())
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
                  maxLength={255}
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                Code interne
                <input
                  value={form.code_interne}
                  onChange={(e) => setForm((f) => ({ ...f, code_interne: e.target.value }))}
                  placeholder="Réf. interne labo"
                  maxLength={64}
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                SKU
                <input
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  maxLength={64}
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                Regroupement
                <select
                  value={form.ref_article_lie_id}
                  onChange={(e) => setForm((f) => ({ ...f, ref_article_lie_id: e.target.value }))}
                >
                  <option value="">— Aucun —</option>
                  {lieOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {shortOptionLabel(a.code, a.libelle)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="catalogue-article-new-form__col-12">
                Tags (séparés par virgules)
                <input
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="Béton, Urgent, Dalle…"
                />
              </label>
            </div>
          </section>

          <section className="catalogue-article-new-form__section">
            <h3 className="catalogue-article-new-form__section-title">Tarification &amp; unités</h3>
            <div className="catalogue-article-new-form__grid">
              <label className="catalogue-article-new-form__col-4">
                Unité (cotation)
                <input
                  value={form.unite}
                  onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))}
                  placeholder="U, m², forfait…"
                  maxLength={32}
                  title="Unité utilisée dans les devis et cotations."
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                Unité HFSQL
                <input
                  value={form.hfsql_unite}
                  onChange={(e) => setForm((f) => ({ ...f, hfsql_unite: e.target.value }))}
                  placeholder="ex. m³, u, h"
                  maxLength={64}
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                Durée estimée (min)
                <input
                  type="number"
                  min={0}
                  value={form.duree_estimee ?? 0}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    setForm((f) => ({ ...f, duree_estimee: Number.isFinite(n) ? n : 0 }))
                  }}
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                Prix unitaire HT
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={Number.isFinite(form.prix_unitaire_ht) ? form.prix_unitaire_ht : ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '') {
                      setForm((f) => ({ ...f, prix_unitaire_ht: 0 }))
                      return
                    }
                    const n = Number(v)
                    setForm((f) => ({ ...f, prix_unitaire_ht: Number.isFinite(n) ? n : 0 }))
                  }}
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                Prix de revient HT
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.prix_revient_ht === undefined ? '' : form.prix_revient_ht}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '') {
                      setForm((f) => ({ ...f, prix_revient_ht: undefined }))
                      return
                    }
                    const n = Number(v)
                    setForm((f) => ({ ...f, prix_revient_ht: Number.isFinite(n) ? n : undefined }))
                  }}
                />
              </label>
              <label className="catalogue-article-new-form__col-4">
                TVA (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={Number.isFinite(form.tva_rate) ? form.tva_rate : ''}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setForm((f) => ({ ...f, tva_rate: Number.isFinite(n) ? n : 20 }))
                  }}
                />
              </label>
              <label className="catalogue-article-new-form__col-12 catalogue-article-new-form__checkbox">
                <input
                  type="checkbox"
                  checked={form.actif}
                  onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))}
                />
                <span>Article actif</span>
              </label>
            </div>
          </section>

          <section className="catalogue-article-new-form__section">
            <h3 className="catalogue-article-new-form__section-title">Descriptions &amp; normes</h3>
            <div className="catalogue-article-new-form__grid">
              <label className="catalogue-article-new-form__col-12">
                Description (legacy)
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="catalogue-article-new-form__col-12">
                Description commerciale
                <textarea
                  rows={3}
                  value={form.description_commerciale}
                  onChange={(e) => setForm((f) => ({ ...f, description_commerciale: e.target.value }))}
                />
              </label>
              <label className="catalogue-article-new-form__col-12">
                Description technique
                <textarea
                  rows={4}
                  value={form.description_technique}
                  onChange={(e) => setForm((f) => ({ ...f, description_technique: e.target.value }))}
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
            <button type="submit" className="btn btn-primary" disabled={mut.isPending}>
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
