import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { catalogueApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import FicheArticle from '../../components/Catalogue/FicheArticle'
import { useAuth } from '../../contexts/AuthContext'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'
import ArticleAgencyVisibilityPanel from '../../components/catalogue/ArticleAgencyVisibilityPanel'
import ArticleActionsPanel from '../../components/Catalogue/ArticleActionsPanel'
import ArticleCompositionEditor from '../../components/Catalogue/ArticleCompositionEditor'
import JalonProductsPanel from '../../components/Catalogue/JalonProductsPanel'
import ProductJalonsPanel from '../../components/Catalogue/ProductJalonsPanel'
import ArticleProlabEditor, { type ArticleProlabEditorSection } from '../../components/Catalogue/ArticleProlabEditor'
import ArticleS2gEditor, { type ArticleS2gEditorSection } from '../../components/Catalogue/ArticleS2gEditor'
import ConfirmDialog from '../../components/ConfirmDialog'

const ARTICLE_EDIT_FORM_ID = 'article-catalogue-edit-form'

type ArticleTab = 'fiche' | 'descriptions' | 'tables' | 'composition' | 'actions' | 'extrafields'

const TAB_DEFS: { id: ArticleTab; label: string; labOnly?: boolean }[] = [
  { id: 'fiche', label: 'Fiche' },
  { id: 'descriptions', label: 'Descriptions' },
  { id: 'tables', label: 'Tables' },
  { id: 'composition', label: 'Composition' },
  { id: 'actions', label: 'Actions & matériel', labOnly: true },
  { id: 'extrafields', label: 'Champs personnalisés', labOnly: true },
]

function parseTab(raw: string | null): ArticleTab {
  if (raw === 'descriptions' || raw === 'tables' || raw === 'composition' || raw === 'actions' || raw === 'extrafields') {
    return raw
  }
  return 'fiche'
}

function editorSectionForTab(tab: ArticleTab): ArticleS2gEditorSection | ArticleProlabEditorSection {
  if (tab === 'fiche') return 'overview'
  if (tab === 'descriptions') return 'descriptions'
  return 'none'
}

export default function ArticleFichePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const articleId = Number(id)
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'lab_admin'
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const tab = parseTab(searchParams.get('tab'))
  const isEditing = searchParams.get('edit') === '1' && isLab
  const [savePending, setSavePending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['catalogue-article', articleId],
    queryFn: () => catalogueApi.article(articleId),
    enabled: Number.isFinite(articleId) && articleId > 0,
  })

  const invalidateArticle = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['catalogue-article', articleId] })
    void queryClient.invalidateQueries({ queryKey: ['catalogue'] })
    void queryClient.invalidateQueries({ queryKey: ['catalogue-arbre'] })
    void queryClient.invalidateQueries({ queryKey: ['catalogue-articles'] })
    void queryClient.invalidateQueries({ queryKey: ['catalogue-articles-flat'] })
  }, [articleId, queryClient])

  const deleteMut = useMutation({
    mutationFn: () => catalogueApi.deleteArticle(articleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['catalogue-articles-flat'] })
      void queryClient.invalidateQueries({ queryKey: ['catalogue-arbre'] })
      navigate('/catalogue')
    },
  })

  const visibleTabs = useMemo(() => TAB_DEFS.filter((t) => !t.labOnly || isLab), [isLab])

  const setTab = (next: ArticleTab) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    if (isEditing) params.set('edit', '1')
    else params.delete('edit')
    setSearchParams(params, { replace: true })
  }

  const startEdit = () => {
    const params = new URLSearchParams(searchParams)
    params.set('edit', '1')
    setSearchParams(params, { replace: true })
  }

  const stopEdit = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('edit')
    setSearchParams(params, { replace: true })
  }

  const submitEditForm = () => {
    const form = document.getElementById(ARTICLE_EDIT_FORM_ID) as HTMLFormElement | null
    form?.requestSubmit()
  }

  const editorSection = editorSectionForTab(tab)
  const showMainEditor = tab === 'fiche' || tab === 'descriptions'

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
        <div className="crud-actions">
          <Link to="/catalogue" className="btn btn-secondary btn-sm">
            ← Liste
          </Link>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/catalogue', { state: { openCreate: true } })}
            >
              Nouveau
            </button>
          )}
          {isLab && !isEditing && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={startEdit}>
              Modifier
            </button>
          )}
          {isLab && isEditing && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savePending}
                onClick={submitEditForm}
              >
                {savePending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={savePending} onClick={stopEdit}>
                Annuler
              </button>
            </>
          )}
          {isAdmin && (
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-danger-outline"
              disabled={deleteMut.isPending}
              onClick={() => setConfirmDelete(true)}
            >
              Supprimer
            </button>
          )}
        </div>
      }
    >
      <div className="module-shell__tabs-wrap article-fiche-page__tabs">
        <nav className="module-shell__tabs" role="tablist" aria-label="Sections fiche article">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`module-shell__tab${tab === t.id ? ' module-shell__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {isEditing && isLab && (
        (article.kind === 'jalon' || article.kind === 'product') ? (
          <ArticleS2gEditor
            article={article}
            section={showMainEditor ? editorSection : 'none'}
            hideActions
            formId={ARTICLE_EDIT_FORM_ID}
            onUpdated={() => {
              invalidateArticle()
              stopEdit()
            }}
            onPendingChange={setSavePending}
          />
        ) : (
          <ArticleProlabEditor
            article={article}
            section={showMainEditor ? editorSection : 'none'}
            hideActions
            formId={ARTICLE_EDIT_FORM_ID}
            onUpdated={() => {
              invalidateArticle()
              stopEdit()
            }}
            onPendingChange={setSavePending}
          />
        )
      )}

      {!isEditing && tab === 'fiche' && (
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
      {!isEditing && tab === 'descriptions' && <FicheArticle article={article} section="descriptions" showBackLink={false} />}
      {!isEditing && tab === 'tables' && <FicheArticle article={article} section="tables" showBackLink={false} />}
      {tab === 'composition' && <ArticleCompositionEditor articleId={articleId} canEdit={isLab && isEditing} />}
      {tab === 'actions' && isLab && (
        <ArticleActionsPanel article={article} canEdit={isEditing && user?.role === 'lab_admin'} />
      )}
      {tab === 'extrafields' && isLab && (
        <>
          <ArticleAgencyVisibilityPanel
            articleId={article.id}
            isMultiSite={article.is_multi_site ?? true}
            visibleLabAgencies={article.visible_lab_agencies}
            canEdit={isEditing && user?.role === 'lab_admin'}
          />
          <ExtrafieldsForm
            entityType="article"
            entityId={article.id}
            canEdit={isEditing}
            title="Champs personnalisés article"
          />
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Supprimer l'article"
          message={`Supprimer définitivement « ${article.code} — ${article.libelle} » ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </ModuleEntityShell>
  )
}
