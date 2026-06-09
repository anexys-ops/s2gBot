import { api } from './client'

export interface ArticleCompositionChild {
  id: number
  code: string
  libelle: string
  prix_unitaire_ht: number | string | null
  unite: string | null
}

export interface ArticleComposition {
  id: number
  parent_article_id: number
  child_article_id: number
  qty_per_unit: number
  is_optional: boolean
  ordre: number
  child?: ArticleCompositionChild
}

export interface ArticleCompositionCreateBody {
  child_article_id: number
  qty_per_unit: number
  is_optional: boolean
}

export interface ArticleCompositionUpdateBody {
  qty_per_unit?: number
  is_optional?: boolean
  ordre?: number
}

export const articleCompositionApi = {
  list: (articleId: number) =>
    api<ArticleComposition[]>(`/articles/${articleId}/compositions`),

  add: (articleId: number, body: ArticleCompositionCreateBody) =>
    api<ArticleComposition>(`/articles/${articleId}/compositions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (articleId: number, id: number, body: ArticleCompositionUpdateBody) =>
    api<ArticleComposition>(`/articles/${articleId}/compositions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  remove: (articleId: number, id: number) =>
    api<void>(`/articles/${articleId}/compositions/${id}`, {
      method: 'DELETE',
    }),

  reorder: (articleId: number, ids: number[]) =>
    api<void>(`/articles/${articleId}/compositions/reorder`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
}
