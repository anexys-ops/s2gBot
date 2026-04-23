import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { catalogueApi, type RefArticleRow } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import FicheArticle from '../../components/Catalogue/FicheArticle'
import { useAuth } from '../../contexts/AuthContext'

function safeNum(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function ArticleProlabEditor({ article, onUpdated }: { article: RefArticleRow; onUpdated: () => void }) {
  const [form, setForm] = useState({
    libelle: article.libelle,
    description: article.description ?? '',
    unite: article.unite ?? '',
    prix_unitaire_ht: safeNum(article.prix_unitaire_ht, 0),
    tva_rate: safeNum(article.tva_rate, 20),
    duree_estimee: article.duree_estimee ?? 0,
    normes: article.normes ?? '',
    actif: article.actif,
  })
  const mut = useMutation({
    mutationFn: (body: Record<string, unknown>) => catalogueApi.updateArticle(article.id, body),
    onSuccess: () => onUpdated(),
  })

  useEffect(() => {
    setForm({
      libelle: article.libelle,
      description: article.description ?? '',
      unite: article.unite ?? '',
      prix_unitaire_ht: safeNum(article.prix_unitaire_ht, 0),
      tva_rate: safeNum(article.tva_rate, 20),
      duree_estimee: article.duree_estimee ?? 0,
      normes: article.normes ?? '',
      actif: article.actif,
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
          mut.mutate({
            libelle: form.libelle,
            description: form.description || null,
            unite: form.unite || null,
            prix_unitaire_ht: Number.isFinite(prix) ? prix : 0,
            tva_rate: Number.isFinite(tva) ? tva : 20,
            duree_estimee: form.duree_estimee,
            normes: form.normes || null,
            actif: form.actif,
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
          Unité
          <input value={form.unite} onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))} />
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
          Description
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
      shellClassName="module-shell--crm"
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
      <FicheArticle article={article} />
      {isLab && (
        <ArticleProlabEditor
          article={article}
          onUpdated={() => {
            void queryClient.invalidateQueries({ queryKey: ['catalogue-article', articleId] })
            void queryClient.invalidateQueries({ queryKey: ['catalogue'] })
            void queryClient.invalidateQueries({ queryKey: ['catalogue-arbre'] })
          }}
        />
      )}
    </ModuleEntityShell>
  )
}
