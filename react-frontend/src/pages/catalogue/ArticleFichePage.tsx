import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { catalogueApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import FicheArticle from '../../components/Catalogue/FicheArticle'
import { useAuth } from '../../contexts/AuthContext'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'
import ArticleActionsPanel from '../../components/Catalogue/ArticleActionsPanel'
import ArticleCompositionEditor from '../../components/Catalogue/ArticleCompositionEditor'
import JalonProductsPanel from '../../components/Catalogue/JalonProductsPanel'
import ProductJalonsPanel from '../../components/Catalogue/ProductJalonsPanel'
import ArticleProlabEditor from '../../components/Catalogue/ArticleProlabEditor'
import ArticleS2gEditor from '../../components/Catalogue/ArticleS2gEditor'

export default function ArticleFichePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const articleId = Number(id)
  const queryClient = useQueryClient()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [tab, setTab] = useState<'overview' | 'descriptions' | 'tables' | 'edit' | 'actions' | 'extrafields' | 'composition'>('overview')

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
          {article.kind === 'jalon' ? (
            <span className="status-pill status-pill--info">Jalon S2G</span>
          ) : article.kind === 'product' ? (
            <span className="status-pill status-pill--muted">Produit S2G</span>
          ) : null}
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
          { id: 'composition', label: 'Composition' },
          ...(isLab ? [{ id: 'actions', label: 'Actions & matériel' }, { id: 'edit', label: 'Modifier' }, { id: 'extrafields', label: 'Champs personnalisés' }] : []),
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

      {tab === 'overview' && (
        <>
          <FicheArticle article={article} section="overview" showBackLink={false} />
          {article.kind === 'jalon' && article.jalon_products && (
            <div style={{ marginTop: '1rem' }}>
              <JalonProductsPanel products={article.jalon_products} />
            </div>
          )}
          {article.kind === 'product' && article.product_jalons && (
            <div style={{ marginTop: '1rem' }}>
              <ProductJalonsPanel jalons={article.product_jalons} />
            </div>
          )}
        </>
      )}
      {tab === 'descriptions' && <FicheArticle article={article} section="descriptions" showBackLink={false} />}
      {tab === 'tables' && <FicheArticle article={article} section="tables" showBackLink={false} />}
      {tab === 'composition' && (
        <ArticleCompositionEditor articleId={articleId} canEdit={isLab} />
      )}
      {tab === 'actions' && isLab && (
        <ArticleActionsPanel articleId={articleId} />
      )}
      {tab === 'edit' && isLab && (
        article.kind === 'jalon' || article.kind === 'product' ? (
          <ArticleS2gEditor
            article={article}
            onUpdated={() => {
              void queryClient.invalidateQueries({ queryKey: ['catalogue-article', articleId] })
              void queryClient.invalidateQueries({ queryKey: ['catalogue'] })
              void queryClient.invalidateQueries({ queryKey: ['catalogue-arbre'] })
              void queryClient.invalidateQueries({ queryKey: ['catalogue-articles'] })
              void queryClient.invalidateQueries({ queryKey: ['catalogue-articles-flat'] })
            }}
          />
        ) : (
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
        )
      )}
      {tab === 'extrafields' && isLab && (
        <ExtrafieldsForm entityType="article" entityId={article.id} canEdit title="Champs personnalisés article" />
      )}
    </ModuleEntityShell>
  )
}
