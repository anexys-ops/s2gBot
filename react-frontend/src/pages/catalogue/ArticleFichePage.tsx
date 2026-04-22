import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { catalogueApi, type RefArticleRow } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import FicheArticle from '../../components/Catalogue/FicheArticle'
import { useAuth } from '../../contexts/AuthContext'

function ArticleProlabEditor({ article, onUpdated }: { article: RefArticleRow; onUpdated: () => void }) {
  const [form, setForm] = useState({
    libelle: article.libelle,
    description: article.description ?? '',
    unite: article.unite,
    prix_unitaire_ht: Number(article.prix_unitaire_ht),
    tva_rate: Number(article.tva_rate),
    duree_estimee: article.duree_estimee,
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
      unite: article.unite,
      prix_unitaire_ht: Number(article.prix_unitaire_ht),
      tva_rate: Number(article.tva_rate),
      duree_estimee: article.duree_estimee,
      normes: article.normes ?? '',
      actif: article.actif,
    })
  }, [article])

  return (
    <section className="card" style={{ marginTop: '1.5rem', maxWidth: 640 }}>
      <h2 className="h2" style={{ fontSize: '1.05rem' }}>
        Édition (laboratoire)
      </h2>
      <p className="text-muted" style={{ fontSize: '0.85rem' }}>Mise à jour de l’article en base (champs commerciaux &amp; pédagogiques).</p>
      <form
        className="quote-form-grid"
        style={{ marginTop: '0.75rem' }}
        onSubmit={(e) => {
          e.preventDefault()
          mut.mutate({
            libelle: form.libelle,
            description: form.description || null,
            unite: form.unite || null,
            prix_unitaire_ht: form.prix_unitaire_ht,
            tva_rate: form.tva_rate,
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
          Prix unitaire HT
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.prix_unitaire_ht}
            onChange={(e) => setForm((f) => ({ ...f, prix_unitaire_ht: Number(e.target.value) }))}
          />
        </label>
        <label>
          TVA (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.tva_rate}
            onChange={(e) => setForm((f) => ({ ...f, tva_rate: Number(e.target.value) }))}
          />
        </label>
        <label>
          Durée estimée (min)
          <input
            type="number"
            min={0}
            value={form.duree_estimee}
            onChange={(e) => setForm((f) => ({ ...f, duree_estimee: parseInt(e.target.value, 10) || 0 }))}
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
      title={article.code}
      subtitle={article.libelle}
      actions={
        <Link to="/catalogue" className="btn btn-secondary btn-sm">
          ← Liste
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
