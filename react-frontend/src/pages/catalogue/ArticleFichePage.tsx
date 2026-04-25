import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { catalogueApi, type RefArticleRow } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import FicheArticle from '../../components/Catalogue/FicheArticle'
import { useAuth } from '../../contexts/AuthContext'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'

function safeNum(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function shortOptionLabel(code: string, label: string, max = 60) {
  const text = `${code} — ${label}`
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function ArticleProlabEditor({ article, onUpdated }: { article: RefArticleRow; onUpdated: () => void }) {
  const [form, setForm] = useState({
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
    prix_revient_ht: article.prix_revient_ht != null && String(article.prix_revient_ht).trim() !== '' ? safeNum(article.prix_revient_ht, 0) : undefined as number | undefined,
    tva_rate: safeNum(article.tva_rate, 20),
    duree_estimee: article.duree_estimee ?? 0,
    normes: article.normes ?? '',
    actif: article.actif,
    ref_article_lie_id: article.ref_article_lie_id != null ? String(article.ref_article_lie_id) : '',
  })
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
    onSuccess: () => onUpdated(),
  })

  useEffect(() => {
    setForm({
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
      prix_revient_ht: article.prix_revient_ht != null && String(article.prix_revient_ht).trim() !== '' ? safeNum(article.prix_revient_ht, 0) : undefined,
      tva_rate: safeNum(article.tva_rate, 20),
      duree_estimee: article.duree_estimee ?? 0,
      normes: article.normes ?? '',
      actif: article.actif,
      ref_article_lie_id: article.ref_article_lie_id != null ? String(article.ref_article_lie_id) : '',
    })
  }, [article])

  return (
    <section className="card lab-article-editor">
      <h2 className="lab-article-editor__title">Édition (laboratoire)</h2>
      <p className="lab-article-editor__intro text-muted">
        Mise à jour de l’article en base (champs commerciaux &amp; pédagogiques).
      </p>
      <form
        className="quote-form-grid lab-article-editor__form"
        onSubmit={(e) => {
          e.preventDefault()
          const prix = Number(form.prix_unitaire_ht)
          const tva = Number(form.tva_rate)
          const tags = form.tags
            .split(/[,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
          const pr = form.prix_revient_ht
          mut.mutate({
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
          })
        }}
      >
        <label>
          Libellé *
          <input
            value={form.libelle}
            onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
            required
          />
        </label>
        <label>
          Code interne
          <input
            value={form.code_interne}
            onChange={(e) => setForm((f) => ({ ...f, code_interne: e.target.value }))}
            placeholder="Réf. interne labo"
          />
        </label>
        <label>
          SKU
          <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
        </label>
        <label>
          Unité (devis / cotation)
          <input
            value={form.unite}
            onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))}
            title="C’est cette unité qui alimente les devis. À aligner sur l’import HFSQL si besoin."
          />
        </label>
        <label>
          Unité HFSQL (telle qu’en base import)
          <input
            value={form.hfsql_unite}
            onChange={(e) => setForm((f) => ({ ...f, hfsql_unite: e.target.value }))}
            placeholder="ex. m³, u, h — copie HFSQL"
          />
        </label>
        <label>
          Regroupement (même offre, autre fiche)
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
        <label>
          Tags (séparés par virgules)
          <input
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="Béton, Urgent, Dalle…"
          />
        </label>
        <label>
          Prix unitaire HT (DH)
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
        <label>
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
        <label>
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
        <label>
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
        <label className="quote-form-checkbox-row">
          <input
            type="checkbox"
            checked={form.actif}
            onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))}
          />
          Article actif
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Description (legacy / alias)
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Description commerciale
          <textarea
            rows={3}
            value={form.description_commerciale}
            onChange={(e) => setForm((f) => ({ ...f, description_commerciale: e.target.value }))}
          />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Description technique
          <textarea
            rows={4}
            value={form.description_technique}
            onChange={(e) => setForm((f) => ({ ...f, description_technique: e.target.value }))}
          />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Normes
          <input value={form.normes} onChange={(e) => setForm((f) => ({ ...f, normes: e.target.value }))} />
        </label>
        {mut.isError && <p className="error">{(mut.error as Error).message}</p>}
        <div className="crud-actions">
          <button type="submit" className="btn btn-primary" disabled={mut.isPending}>
            {mut.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default function ArticleFichePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const articleId = Number(id)
  const queryClient = useQueryClient()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [tab, setTab] = useState<'overview' | 'descriptions' | 'tables' | 'edit' | 'extrafields'>('overview')

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['catalogue-article', articleId],
    queryFn: () => catalogueApi.article(articleId),
    enabled: Number.isFinite(articleId) && articleId > 0,
  })

  if (!Number.isFinite(articleId) || articleId <= 0) {
    return <p className="error">Article invalide.</p>
  }

  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Catalogue', to: '/catalogue' },
          { label: '…' },
        ]}
        moduleBarLabel="Catalogue"
        title="Chargement…"
      >
        <p className="text-muted">Chargement…</p>
      </ModuleEntityShell>
    )
  }

  if (error || !article) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Catalogue', to: '/catalogue' },
          { label: 'Erreur' },
        ]}
        moduleBarLabel="Catalogue"
        title="Article introuvable"
      >
        <p className="error">{(error as Error)?.message}</p>
        <Link to="/catalogue" className="link-inline">
          ← Retour catalogue
        </Link>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm module-shell--article-wide"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Catalogue', to: '/catalogue' },
        { label: article.code },
      ]}
      moduleBarLabel="Catalogue — Fiche article"
      title={article.libelle}
      subtitle={
        <div className="article-fiche__title-row">
          <code className="code-badge">{article.code}</code>
          {article.actif ? <span className="status-pill status-pill--ok">Actif</span> : <span className="status-pill status-pill--muted">Inactif</span>}
        </div>
      }
      actions={
        <Link to="/catalogue" className="btn btn-secondary btn-sm">
          ← Retour catalogue
        </Link>
      }
    >
      <div className="article-fiche-tabs" role="tablist" aria-label="Sections fiche article">
        {[
          { id: 'overview', label: 'Fiche' },
          { id: 'descriptions', label: 'Descriptions' },
          { id: 'tables', label: 'Tables' },
          ...(isLab ? [{ id: 'edit', label: 'Modifier' }, { id: 'extrafields', label: 'Champs personnalisés' }] : []),
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={`article-fiche-tabs__btn${tab === t.id ? ' article-fiche-tabs__btn--active' : ''}`}
            onClick={() => setTab(t.id as typeof tab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <FicheArticle article={article} section="overview" showBackLink={false} />}
      {tab === 'descriptions' && <FicheArticle article={article} section="descriptions" showBackLink={false} />}
      {tab === 'tables' && <FicheArticle article={article} section="tables" showBackLink={false} />}
      {tab === 'edit' && isLab && (
        <ArticleProlabEditor
          article={article}
          onUpdated={() => {
            void queryClient.invalidateQueries({ queryKey: ['catalogue-article', articleId] })
            void queryClient.invalidateQueries({ queryKey: ['catalogue'] })
            void queryClient.invalidateQueries({ queryKey: ['catalogue-arbre'] })
            void queryClient.invalidateQueries({ queryKey: ['catalogue-articles'] })
            void queryClient.invalidateQueries({ queryKey: ['catalogue-articles-flat'] })
          }}
        />
      )}
      {tab === 'extrafields' && isLab && (
        <ExtrafieldsForm entityType="article" entityId={article.id} canEdit title="Champs personnalisés article" />
      )}
    </ModuleEntityShell>
  )
}
