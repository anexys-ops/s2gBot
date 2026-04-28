import { enqueueOfflineRequest } from '../lib/offlineQueue'

const API_BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('token')
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const method = (options.method ?? 'GET').toUpperCase()
  if (typeof navigator !== 'undefined' && !navigator.onLine && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const bodyStr = typeof options.body === 'string' ? options.body : null
    enqueueOfflineRequest(`${API_BASE}${path}`, method, bodyStr)
    throw new Error(
      'Hors ligne : la requête est en file d’attente locale. Elle pourra être rejouée manuellement ou après reconnexion (fonction expérimentale).',
    )
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg =
      typeof data.message === 'string' && data.message.trim() !== ''
        ? data.message
        : `Erreur ${res.status}`
    if (data.errors && typeof data.errors === 'object') {
      const parts = Object.values(data.errors)
        .flat(2)
        .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      if (parts.length) {
        msg = parts.join(' ')
      }
    }
    throw new Error(msg)
  }
  return data as T
}

export type LaravelPaginator<T> = {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: User; token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (body: RegisterBody) =>
    api<{ user: User; token: string }>('/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Clients / chantiers pour le formulaire d'inscription (sans token). */
  registerClients: () => api<Array<{ id: number; name: string }>>('/register/clients'),
  registerSites: (clientId: number) =>
    api<Array<{ id: number; name: string; client_id: number }>>(
      `/register/sites?client_id=${encodeURIComponent(String(clientId))}`,
    ),
  registerAgencies: (clientId: number) =>
    api<AgencyRow[]>(`/register/agencies?client_id=${encodeURIComponent(String(clientId))}`),
  logout: () => api('/logout', { method: 'POST' }),
  user: () => api<User>('/user'),
}

export interface ApiTokenRow {
  id: number
  name: string
  last_used_at: string | null
  created_at: string
  is_spa: boolean
}

export interface AccessGroupRow {
  id: number
  name: string
  slug: string
  description?: string | null
  permissions?: string[] | null
  users_count?: number
}

export const accountApi = {
  updateProfile: (body: { name?: string; email?: string; phone?: string | null }) =>
    api<User>('/user/profile', { method: 'PUT', body: JSON.stringify(body) }),
  updatePassword: (body: { current_password: string; password: string; password_confirmation: string }) =>
    api<{ message: string }>('/user/password', { method: 'PUT', body: JSON.stringify(body) }),
  listApiTokens: () => api<{ data: ApiTokenRow[] }>('/user/api-tokens'),
  createApiToken: (name: string) =>
    api<{ token: string; token_type: string; name: string; message: string }>('/user/api-tokens', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  revokeApiToken: (tokenId: number) => api(`/user/api-tokens/${tokenId}`, { method: 'DELETE' }),
}

export const permissionsCatalogApi = {
  get: () => api<{ permissions: Record<string, string> }>('/permissions/catalog'),
}

export const adminUsersApi = {
  list: (params?: { search?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.page) q.set('page', String(params.page))
    const s = q.toString()
    return api<LaravelPaginator<User>>(`/admin/users${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<User>(`/admin/users/${id}`),
  create: (body: {
    name: string
    email: string
    password: string
    phone?: string | null
    role: string
    client_id?: number | null
    site_id?: number | null
    access_group_ids?: number[]
    agency_ids?: number[]
  }) => api<User>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (
    id: number,
    body: Partial<{
      name: string
      email: string
      password: string
      phone: string | null
      role: string
      client_id: number | null
      site_id: number | null
      access_group_ids: number[]
      agency_ids: number[]
    }>,
  ) => api<User>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/admin/users/${id}`, { method: 'DELETE' }),
}

export const accessGroupsApi = {
  list: () => api<{ data: AccessGroupRow[] }>('/admin/access-groups'),
  get: (id: number) => api<AccessGroupRow & { users?: Pick<User, 'id' | 'name' | 'email' | 'role'>[] }>(
    `/admin/access-groups/${id}`,
  ),
  create: (body: { name: string; slug?: string; description?: string | null; permissions?: string[] }) =>
    api<AccessGroupRow>('/admin/access-groups', { method: 'POST', body: JSON.stringify(body) }),
  update: (
    id: number,
    body: Partial<{ name: string; slug: string; description: string | null; permissions: string[] }>,
  ) => api<AccessGroupRow>(`/admin/access-groups/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/admin/access-groups/${id}`, { method: 'DELETE' }),
}

export interface AgencyRow {
  id: number
  client_id: number
  name: string
  code?: string | null
  is_headquarters?: boolean
}

export const agenciesApi = {
  listForClient: (clientId: number) => api<AgencyRow[]>(`/clients/${clientId}/agencies`),
}

export const clientsApi = {
  list: (params?: { search?: string; commercial_id?: number; with_gps?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.commercial_id) q.set('commercial_id', String(params.commercial_id))
    if (params?.with_gps) q.set('with_gps', '1')
    const s = q.toString()
    return api<Client[]>(`/clients${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<Client>(`/clients/${id}`),
  create: (body: Partial<Client>) => api<Client>('/clients', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Client>) => api<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/clients/${id}`, { method: 'DELETE' }),
  commercialOverview: (id: number) => api<ClientCommercialOverview>(`/clients/${id}/commercial-overview`),
}

export interface ClientAddress {
  id: number
  client_id: number
  type: string
  label?: string
  line1: string
  line2?: string
  postal_code?: string
  city?: string
  country?: string
  is_default?: boolean
}

export interface Attachment {
  id: number
  path: string
  original_filename: string
  mime_type?: string
  size_bytes: number
  uploaded_by?: number
}

export interface CommercialDocumentLink {
  id: number
  source_type: string
  source_id: number
  target_type: string
  target_id: number
  relation: string
}

/** Mise en page PDF (rapports / documents) — aligné sur `AppBranding::defaultLayoutConfig`. */
export type PdfLayoutConfig = Record<string, unknown>

export interface DocumentPdfTemplateRow {
  id: number
  document_type: string
  slug: string
  name: string
  blade_view: string
  is_default: boolean
  layout_config?: PdfLayoutConfig
}

export const clientAddressesApi = {
  list: (clientId: number) => api<ClientAddress[]>(`/clients/${clientId}/addresses`),
  create: (clientId: number, body: Partial<ClientAddress>) =>
    api<ClientAddress>(`/clients/${clientId}/addresses`, { method: 'POST', body: JSON.stringify(body) }),
  update: (addressId: number, body: Partial<ClientAddress>) =>
    api<ClientAddress>(`/client-addresses/${addressId}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (addressId: number) => api(`/client-addresses/${addressId}`, { method: 'DELETE' }),
}

export interface ClientContactRow {
  id: number
  client_id: number
  client?: Pick<Client, 'id' | 'name' | 'email' | 'phone' | 'city'>
  contact_type?: 'facturation' | 'livraison' | 'technique' | 'chantier' | 'commercial' | 'autre' | null
  prenom: string
  nom: string
  poste?: string | null
  departement?: string | null
  email?: string | null
  telephone_direct?: string | null
  telephone_mobile?: string | null
  is_principal?: boolean
  notes?: string | null
}

export const clientContactsApi = {
  listAll: (params?: { search?: string }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    const s = q.toString()
    return api<ClientContactRow[]>(`/client-contacts${s ? `?${s}` : ''}`)
  },
  list: (clientId: number) => api<ClientContactRow[]>(`/clients/${clientId}/contacts`),
  create: (clientId: number, body: Partial<ClientContactRow> & { prenom: string; nom: string }) =>
    api<ClientContactRow>(`/clients/${clientId}/contacts`, { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<ClientContactRow>) =>
    api<ClientContactRow>(`/client-contacts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/client-contacts/${id}`, { method: 'DELETE' }),
}

export const attachmentsApi = {
  list: (attachableType: string, attachableId: number) =>
    api<Attachment[]>(`/attachments?attachable_type=${attachableType}&attachable_id=${attachableId}`),
  async upload(file: File, attachableType: string, attachableId: number): Promise<Attachment> {
    const token = getToken()
    const fd = new FormData()
    fd.append('file', file)
    fd.append('attachable_type', attachableType)
    fd.append('attachable_id', String(attachableId))
    const res = await fetch(`${API_BASE}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
      body: fd,
    })
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`)
    return data as Attachment
  },
  delete: (id: number) => api(`/attachments/${id}`, { method: 'DELETE' }),
  download: async (attachmentId: number, filename: string) => {
    const token = getToken()
    const res = await fetch(`${API_BASE}/attachments/${attachmentId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    if (!res.ok) throw new Error('Téléchargement impossible')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}

export const commercialLinksApi = {
  list: (documentType: string, documentId: number) =>
    api<CommercialDocumentLink[]>(`/commercial-links?document_type=${documentType}&document_id=${documentId}`),
  create: (body: {
    source_type: string
    source_id: number
    target_type: string
    target_id: number
    relation: string
  }) => api<CommercialDocumentLink>('/commercial-links', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/commercial-links/${id}`, { method: 'DELETE' }),
}

export const documentPdfTemplatesApi = {
  list: (documentType?: string) =>
    api<{ data: DocumentPdfTemplateRow[] }>(
      documentType ? `/document-pdf-templates?document_type=${documentType}` : '/document-pdf-templates'
    ),
  update: (
    id: number,
    body: { is_default?: boolean; name?: string; layout_config?: PdfLayoutConfig },
  ) => api<DocumentPdfTemplateRow>(`/document-pdf-templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
}

export type ExtrafieldEntityType =
  | 'client'
  | 'site'
  | 'order'
  | 'invoice'
  | 'quote'
  | 'article'
  | 'dossier'
  | 'bon_commande'
  | 'bon_livraison'
  | 'mission'
  | 'equipment'

export interface ExtrafieldSelectOption {
  value: string
  label: string
}

export interface ExtrafieldDefinitionRow {
  id: number
  entity_type: ExtrafieldEntityType
  code: string
  label: string
  field_type: string
  select_options?: ExtrafieldSelectOption[] | null
  sort_order: number
  required: boolean
}

export const extrafieldDefinitionsApi = {
  list: (entityType?: ExtrafieldEntityType) =>
    api<{ data: ExtrafieldDefinitionRow[] }>(
      entityType ? `/extrafield-definitions?entity_type=${entityType}` : '/extrafield-definitions',
    ),
  create: (body: {
    entity_type: ExtrafieldEntityType
    code: string
    label: string
    field_type: string
    select_options?: ExtrafieldSelectOption[]
    sort_order?: number
    required?: boolean
  }) => api<ExtrafieldDefinitionRow>('/extrafield-definitions', { method: 'POST', body: JSON.stringify(body) }),
  update: (
    id: number,
    body: Partial<{
      label: string
      field_type: string
      select_options: ExtrafieldSelectOption[] | null
      sort_order: number
      required: boolean
    }>,
  ) => api<ExtrafieldDefinitionRow>(`/extrafield-definitions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/extrafield-definitions/${id}`, { method: 'DELETE' }),
}

export const extrafieldValuesApi = {
  list: (entityType: ExtrafieldEntityType, entityId: number) =>
    api<{ data: { definition: ExtrafieldDefinitionRow; value: string | null }[] }>(
      `/extrafield-values?entity_type=${entityType}&entity_id=${entityId}`,
    ),
  sync: (body: { entity_type: ExtrafieldEntityType; entity_id: number; values: Record<string, unknown> }) =>
    api<{ data: { definition: ExtrafieldDefinitionRow; value: string | null }[] }>('/extrafield-values', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
}

export const moduleSettingsApi = {
  get: (moduleKey: string) =>
    api<{ module_key: string; settings: Record<string, unknown> }>(`/module-settings/${moduleKey}`),
  update: (moduleKey: string, settings: Record<string, unknown>) =>
    api<{ module_key: string; settings: Record<string, unknown> }>(`/module-settings/${moduleKey}`, {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    }),
}

export interface RefPackageRow {
  id: number
  ref_famille_package_id: number
  code: string
  libelle: string
  description?: string | null
  prix_ht: string
  prix_ht_formate?: string
  tva_rate: string
  actif: boolean
  famille_package?: RefFamillePackageRow & { article?: RefArticleRow }
}

export interface RefFamillePackageRow {
  id: number
  ref_article_id: number
  code: string
  libelle: string
  description?: string | null
  ordre: number
  actif: boolean
  packages?: RefPackageRow[]
}

export interface RefResultatRow {
  id: number
  ref_article_id: number
  code: string
  libelle: string
  norme?: string | null
  valeur_seuil?: string | null
}

export interface RefParametreEssaiRow {
  id: number
  ref_article_id: number
  code: string
  libelle: string
  unite?: string | null
  valeur_min?: string | null
  valeur_max?: string | null
  ordre: number
}

export interface RefArticleRow {
  id: number
  ref_famille_article_id: number
  ref_article_lie_id?: number | null
  code: string
  code_interne?: string | null
  sku?: string | null
  libelle: string
  description?: string | null
  description_commerciale?: string | null
  description_technique?: string | null
  /** Étiquettes métier (import HFSQL / manuel) */
  tags?: string[] | null
  unite: string
  /** Unité telle qu’importée / référence HFSQL (souvent alignée sur `unite`) */
  hfsql_unite?: string | null
  prix_unitaire_ht: string
  prix_revient_ht?: string | null
  prix_unitaire_ht_formate?: string
  tva_rate: string
  duree_estimee: number
  normes?: string | null
  actif: boolean
  famille?: RefFamilleArticleRow
  /** Article lié pour regroupement (PROLAB) */
  article_lie?: { id: number; code: string; libelle: string } | null
  famille_packages?: RefFamillePackageRow[]
  parametres_essai?: RefParametreEssaiRow[]
  resultats?: RefResultatRow[]
}

export interface RefFamilleArticleRow {
  id: number
  code: string
  libelle: string
  description?: string | null
  ordre: number
  actif: boolean
  articles?: RefArticleRow[]
}

export const catalogueApi = {
  familles: (params?: { with_inactif?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.with_inactif) q.set('with_inactif', '1')
    const s = q.toString()
    return api<RefFamilleArticleRow[]>(`/v1/catalogue/familles${s ? `?${s}` : ''}`)
  },
  arbre: (params?: { with_inactif?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.with_inactif) q.set('with_inactif', '1')
    const s = q.toString()
    return api<RefFamilleArticleRow[]>(`/v1/catalogue/arbre${s ? `?${s}` : ''}`)
  },
  articlesByFamille: (familleId: number, params?: { with_inactif?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.with_inactif) q.set('with_inactif', '1')
    const s = q.toString()
    return api<RefArticleRow[]>(`/v1/catalogue/familles/${familleId}/articles${s ? `?${s}` : ''}`)
  },
  articles: (params?: { ref_famille_article_id?: number; with_inactif?: boolean; q?: string }) => {
    const q = new URLSearchParams()
    if (params?.ref_famille_article_id) q.set('ref_famille_article_id', String(params.ref_famille_article_id))
    if (params?.with_inactif) q.set('with_inactif', '1')
    if (params?.q?.trim()) q.set('q', params.q.trim())
    const s = q.toString()
    return api<RefArticleRow[]>(`/v1/catalogue/articles${s ? `?${s}` : ''}`)
  },
  packages: (params?: { ref_article_id?: number; ref_famille_package_id?: number; with_inactif?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.ref_article_id) q.set('ref_article_id', String(params.ref_article_id))
    if (params?.ref_famille_package_id) q.set('ref_famille_package_id', String(params.ref_famille_package_id))
    if (params?.with_inactif) q.set('with_inactif', '1')
    const s = q.toString()
    return api<RefPackageRow[]>(`/v1/catalogue/packages${s ? `?${s}` : ''}`)
  },
  article: (id: number) => api<RefArticleRow>(`/v1/catalogue/articles/${id}`),
  createArticle: (body: Partial<RefArticleRow> & { ref_famille_article_id: number; code: string; libelle: string }) =>
    api<RefArticleRow>('/v1/catalogue/articles', { method: 'POST', body: JSON.stringify(body) }),
  updateArticle: (id: number, body: Partial<RefArticleRow>) =>
    api<RefArticleRow>(`/v1/catalogue/articles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteArticle: (id: number) => api<null>(`/v1/catalogue/articles/${id}`, { method: 'DELETE' }),
}

export type DossierStatut = 'brouillon' | 'en_cours' | 'cloture' | 'archive'

export type DossierCreateInput = {
  titre: string
  client_id: number
  site_id: number
  statut: DossierStatut
  date_debut: string
  mission_id?: number | null
  date_fin_prevue?: string | null
  maitre_ouvrage?: string | null
  entreprise_chantier?: string | null
  notes?: string | null
  reference?: string | null
  contacts?: DossierContactInput[]
  contact_id?: number | null
}

export interface DossierContactInput {
  id?: number
  nom: string
  prenom?: string | null
  email?: string | null
  telephone?: string | null
  role?: string | null
}

export interface DossierRow {
  id: number
  reference: string
  titre: string
  client_id: number
  site_id: number
  mission_id?: number | null
  statut: DossierStatut
  date_debut: string
  date_fin_prevue?: string | null
  maitre_ouvrage?: string | null
  entreprise_chantier?: string | null
  notes?: string | null
  created_by: number
  /** Contact client S2G (technique) — FK client_contacts */
  contact_id?: number | null
  clientContact?: ClientContactRow | null
  client?: Client
  site?: Site
  createur?: Pick<User, 'id' | 'name' | 'email'>
  mission?: { id: number; reference: string; title?: string | null } | null
  contacts?: DossierContactRow[]
  missions?: { id: number; reference: string; title?: string | null; dossier_id?: number | null }[]
  quotes?: Quote[]
  attachments?: Attachment[]
}

export interface DossierContactRow {
  id: number
  dossier_id: number
  nom: string
  prenom?: string | null
  email?: string | null
  telephone?: string | null
  role?: string | null
}

export type BcLignePlanningAffectation = {
  id: number
  bon_commande_ligne_id: number
  user_id: number
  date_debut: string
  date_fin: string
  notes?: string | null
  created_by?: number | null
  user?: { id: number; name: string; email: string; role: string }
}

export type BonCommandeLigne = {
  id: number
  libelle: string
  quantite: string | number
  prix_unitaire_ht: string | number
  tva_rate: string | number
  montant_ht: string | number
  ref_article_id?: number | null
  date_debut_prevue?: string | null
  date_fin_prevue?: string | null
  technicien_id?: number | null
  date_livraison?: string | null
  notes_ligne?: string | null
  technicien?: { id: number; name: string } | null
  planning_affectations?: BcLignePlanningAffectation[]
}

export type BonCommande = {
  id: number
  numero: string
  quote_id: number | null
  dossier_id: number
  client_id: number
  contact_id?: number | null
  statut: string
  date_commande: string
  date_livraison_prevue?: string | null
  montant_ht: string | number
  montant_ttc: string | number
  tva_rate: string | number
  notes?: string | null
  lignes?: BonCommandeLigne[]
  client?: { id: number; name: string }
  clientContact?: ClientContactRow
  dossier?: DossierRow
}

export type BonLivraisonLigne = {
  id: number
  libelle: string
  quantite_livree: string | number
  ref_article_id?: number | null
  bon_commande_ligne_id?: number | null
}

export type BonLivraison = {
  id: number
  numero: string
  bon_commande_id: number | null
  dossier_id: number
  client_id: number
  contact_id?: number | null
  statut: string
  date_livraison: string
  notes?: string | null
  lignes?: BonLivraisonLigne[]
  client?: { id: number; name: string }
  clientContact?: ClientContactRow
  dossier?: DossierRow
}

export const dossiersApi = {
  list: (params?: {
    client_id?: number
    statut?: DossierStatut
    site_id?: number
    date_debut_from?: string
    date_debut_to?: string
  }) => {
    const q = new URLSearchParams()
    if (params?.client_id) q.set('client_id', String(params.client_id))
    if (params?.statut) q.set('statut', params.statut)
    if (params?.site_id) q.set('site_id', String(params.site_id))
    if (params?.date_debut_from) q.set('date_debut_from', params.date_debut_from)
    if (params?.date_debut_to) q.set('date_debut_to', params.date_debut_to)
    const s = q.toString()
    return api<DossierRow[]>(`/v1/dossiers${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<DossierRow>(`/v1/dossiers/${id}`),
  create: (body: DossierCreateInput) => api<DossierRow>('/v1/dossiers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<DossierCreateInput>) =>
    api<DossierRow>(`/v1/dossiers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api<null>(`/v1/dossiers/${id}`, { method: 'DELETE' }),
  devis: (id: number) => api<Quote[]>(`/v1/dossiers/${id}/devis`),
  bons: (id: number) =>
    api<{ bons_commande: BonCommande[]; bons_livraison: BonLivraison[] }>(`/v1/dossiers/${id}/bons`),
  addContact: (id: number, body: Omit<DossierContactInput, 'id'>) =>
    api<DossierContactRow>(`/v1/dossiers/${id}/contacts`, { method: 'POST', body: JSON.stringify(body) }),
}

export const bonsCommandeApi = {
  list: (params?: { dossier_id?: number; client_id?: number; statut?: string }) => {
    const q = new URLSearchParams()
    if (params?.dossier_id) q.set('dossier_id', String(params.dossier_id))
    if (params?.client_id) q.set('client_id', String(params.client_id))
    if (params?.statut) q.set('statut', params.statut)
    const s = q.toString()
    return api<BonCommande[]>(`/v1/bons-commande${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<BonCommande>(`/v1/bons-commande/${id}`),
  update: (id: number, body: { notes?: string; date_livraison_prevue?: string; montant_ht?: number; montant_ttc?: number; contact_id?: number | null }) =>
    api<BonCommande>(`/v1/bons-commande/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api<null>(`/v1/bons-commande/${id}`, { method: 'DELETE' }),
  confirmer: (id: number) => api<BonCommande>(`/v1/bons-commande/${id}/confirmer`, { method: 'POST' }),
  transformerBl: (id: number) => api<BonLivraison>(`/v1/bons-commande/${id}/transformer-bl`, { method: 'POST' }),
  updateLigne: (
    bcId: number,
    ligneId: number,
    body: { date_debut_prevue?: string | null; date_fin_prevue?: string | null; technicien_id?: number | null; date_livraison?: string | null; notes_ligne?: string | null }
  ) =>
    api<BonCommandeLigne>(`/v1/bons-commande/${bcId}/lignes/${ligneId}`, { method: 'PUT', body: JSON.stringify(body) }),
}

/** Réponse list GET planning-terrain (affectation + relations). */
export type PlanningTerrainAffectationRow = BcLignePlanningAffectation & {
  bon_commande_ligne?: {
    id: number
    libelle: string
    date_debut_prevue?: string | null
    date_fin_prevue?: string | null
    bon_commande?: {
      id: number
      numero: string
      dossier_id: number
      client?: { id: number; name: string }
    }
  }
}

export const planningTerrainApi = {
  techniciens: () => api<Array<{ id: number; name: string; email: string; role: string }>>(`/v1/planning-terrain/techniciens`),
  list: (params: { from: string; to: string; user_id?: number }) => {
    const q = new URLSearchParams()
    q.set('from', params.from)
    q.set('to', params.to)
    if (params.user_id) q.set('user_id', String(params.user_id))
    return api<PlanningTerrainAffectationRow[]>(`/v1/planning-terrain?${q.toString()}`)
  },
  create: (body: {
    bon_commande_ligne_id: number
    user_id: number
    date_debut: string
    date_fin: string
    notes?: string | null
  }) => api<BcLignePlanningAffectation>('/v1/planning-terrain', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<{ user_id: number; date_debut: string; date_fin: string; notes: string | null }>) =>
    api<BcLignePlanningAffectation>(`/v1/planning-terrain/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api<null>(`/v1/planning-terrain/${id}`, { method: 'DELETE' }),
}

export const bonsLivraisonApi = {
  list: (params?: { dossier_id?: number; client_id?: number; statut?: string }) => {
    const q = new URLSearchParams()
    if (params?.dossier_id) q.set('dossier_id', String(params.dossier_id))
    if (params?.client_id) q.set('client_id', String(params.client_id))
    if (params?.statut) q.set('statut', params.statut)
    const s = q.toString()
    return api<BonLivraison[]>(`/v1/bons-livraison${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<BonLivraison>(`/v1/bons-livraison/${id}`),
  update: (
    id: number,
    body: { notes?: string; date_livraison?: string; contact_id?: number | null; lignes?: { id: number; quantite_livree: number }[] },
  ) => api<BonLivraison>(`/v1/bons-livraison/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  valider: (id: number) => api<BonLivraison>(`/v1/bons-livraison/${id}/valider`, { method: 'POST' }),
  delete: (id: number) => api<null>(`/v1/bons-livraison/${id}`, { method: 'DELETE' }),
}

export type GlobalSearchResult = { id: number; type: string; label: string; sub: string; url: string }

export const globalSearchApi = {
  search: (q: string): Promise<{ results: GlobalSearchResult[] }> =>
    api<{ results: GlobalSearchResult[] }>(`/v1/global-search?q=${encodeURIComponent(q)}`),
}

export const tagsApi = {
  list: () => api<Array<{ id: number; name: string; color?: string }>>('/v1/tags'),
  create: (body: { name: string; color?: string }) =>
    api<{ id: number; name: string; color?: string }>('/v1/tags', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: { name?: string; color?: string }) =>
    api<{ id: number; name: string; color?: string }>(`/v1/tags/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api<null>(`/v1/tags/${id}`, { method: 'DELETE' }),
}

export const devisV1Api = {
  /** Devis (quote) → Bon de commande (lab uniquement) */
  transformerBc: (quoteId: number) => api<BonCommande>(`/v1/devis/${quoteId}/transformer-bc`, { method: 'POST' }),
}

export type Reglement = {
  id: number
  numero: string
  client_id: number
  invoice_id: number | null
  amount_ttc: string | number
  payment_mode: string
  payment_date: string
  notes?: string | null
}

export type SituationTravauxRow = {
  id: number
  numero: string
  dossier_id: number
  label: string
  percent_complete: string | number
  amount_ht: string | number
  status: string
}

export type InvoiceCredit = {
  id: number
  numero: string
  client_id: number
  source_invoice_id: number
  amount_ttc: string | number
  status: string
  reason?: string | null
}

export const comptaV1Api = {
  reglements: {
    list: (params?: { client_id?: number; invoice_id?: number }) => {
      const q = new URLSearchParams()
      if (params?.client_id) q.set('client_id', String(params.client_id))
      if (params?.invoice_id) q.set('invoice_id', String(params.invoice_id))
      const s = q.toString()
      return api<Reglement[]>(`/v1/reglements${s ? `?${s}` : ''}`)
    },
    get: (id: number) => api<Reglement>(`/v1/reglements/${id}`),
    create: (body: {
      client_id: number
      invoice_id?: number | null
      bon_livraison_id?: number | null
      amount_ttc: number
      payment_mode?: string
      payment_date: string
      notes?: string | null
    }) => api<Reglement>('/v1/reglements', { method: 'POST', body: JSON.stringify(body) }),
  },
  situations: {
    list: (params?: { dossier_id?: number }) => {
      const q = new URLSearchParams()
      if (params?.dossier_id) q.set('dossier_id', String(params.dossier_id))
      const s = q.toString()
      return api<SituationTravauxRow[]>(`/v1/situations-travaux${s ? `?${s}` : ''}`)
    },
    get: (id: number) => api<SituationTravauxRow>(`/v1/situations-travaux/${id}`),
    create: (body: {
      dossier_id: number
      invoice_id?: number | null
      label: string
      percent_complete?: number
      amount_ht?: number
      status?: string
    }) => api<SituationTravauxRow>('/v1/situations-travaux', { method: 'POST', body: JSON.stringify(body) }),
  },
  avoirs: {
    list: (params?: { client_id?: number; source_invoice_id?: number }) => {
      const q = new URLSearchParams()
      if (params?.client_id) q.set('client_id', String(params.client_id))
      if (params?.source_invoice_id) q.set('source_invoice_id', String(params.source_invoice_id))
      const s = q.toString()
      return api<InvoiceCredit[]>(`/v1/invoice-credits${s ? `?${s}` : ''}`)
    },
    get: (id: number) => api<InvoiceCredit>(`/v1/invoice-credits/${id}`),
    create: (body: {
      client_id: number
      source_invoice_id: number
      amount_ttc: number
      reason?: string | null
      status?: string
    }) => api<InvoiceCredit>('/v1/invoice-credits', { method: 'POST', body: JSON.stringify(body) }),
  },
}

export const brandingApi = {
  get: () => api<{ logo_url: string | null }>('/branding'),
  async uploadLogo(file: File): Promise<{ logo_url: string | null; logo_public_path?: string }> {
    const token = getToken()
    const fd = new FormData()
    fd.append('logo', file)
    const res = await fetch(`${API_BASE}/branding/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
      body: fd,
    })
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      let msg =
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : `Erreur ${res.status}`
      if (data.errors && typeof data.errors === 'object') {
        const parts = Object.values(data.errors)
          .flat(2)
          .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        if (parts.length) msg = parts.join(' ')
      }
      throw new Error(msg)
    }
    return data as { logo_url: string | null; logo_public_path?: string }
  },
  deleteLogo: () => api<{ logo_url: null }>('/branding/logo', { method: 'DELETE' }),
}

export interface ReportPdfTemplateRow {
  id: number
  slug: string
  name: string
  blade_view: string
  is_default: boolean
  layout_config?: PdfLayoutConfig
}

export const reportPdfTemplatesApi = {
  list: () => api<{ data: ReportPdfTemplateRow[] }>('/report-pdf-templates'),
  update: (
    id: number,
    body: { is_default?: boolean; name?: string; layout_config?: PdfLayoutConfig },
  ) => api<ReportPdfTemplateRow>(`/report-pdf-templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
}

export interface ReportFormFieldDef {
  key: string
  label: string
  type: string
}

export interface ReportFormDefinitionRow {
  id: number
  slug: string
  name: string
  service_key?: string | null
  fields: ReportFormFieldDef[]
  active: boolean
}

export const reportFormDefinitionsApi = {
  list: (serviceKey?: string) => {
    const q = serviceKey ? `?service_key=${encodeURIComponent(serviceKey)}` : ''
    return api<{ data: ReportFormDefinitionRow[] }>(`/report-form-definitions${q}`)
  },
}

export const sitesApi = {
  list: (params?: { search?: string }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    const s = q.toString()
    return api<Site[]>(`/sites${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<Site>(`/sites/${id}`),
  create: (body: Partial<Site>) => api<Site>('/sites', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Site>) => api<Site>(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/sites/${id}`, { method: 'DELETE' }),
}

export type TestTypeParamInput = { id?: number; name: string; unit?: string; expected_type?: string }

export interface CalibrationRow {
  id: number
  equipment_id: number
  calibration_date: string
  next_due_date?: string | null
  certificate_path?: string | null
  provider?: string | null
  result: 'ok' | 'ok_with_reserve' | 'failed'
  notes?: string | null
}

export interface EquipmentRow {
  id: number
  name: string
  code: string
  /** Numéro d’inventaire (parc matériel) */
  numero_inventaire?: string | null
  type?: string | null
  brand?: string | null
  model?: string | null
  serial_number?: string | null
  location?: string | null
  agency_id?: number | null
  purchase_date?: string | null
  status: string
  meta?: Record<string, unknown> | null
  agency?: { id: number; name: string } | null
  test_types?: Array<{ id: number; name: string }>
  calibrations?: CalibrationRow[]
}

export const equipmentsApi = {
  list: (params?: { status?: string; due_within?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.due_within != null) q.set('due_within', String(params.due_within))
    const s = q.toString()
    return api<EquipmentRow[]>(`/equipments${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<EquipmentRow>(`/equipments/${id}`),
  create: (body: {
    name: string
    code: string
    type?: string | null
    brand?: string | null
    model?: string | null
    serial_number?: string | null
    location?: string | null
    agency_id?: number | null
    purchase_date?: string | null
    status?: string
    meta?: Record<string, unknown> | null
    test_type_ids?: number[]
  }) => api<EquipmentRow>('/equipments', { method: 'POST', body: JSON.stringify(body) }),
  update: (
    id: number,
    body: Partial<{
      name: string
      code: string
      type: string | null
      brand: string | null
      model: string | null
      serial_number: string | null
      location: string | null
      agency_id: number | null
      purchase_date: string | null
      status: string
      meta: Record<string, unknown> | null
      test_type_ids: number[]
    }>,
  ) => api<EquipmentRow>(`/equipments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/equipments/${id}`, { method: 'DELETE' }),
  listCalibrations: (equipmentId: number) =>
    api<CalibrationRow[]>(`/equipments/${equipmentId}/calibrations`),
  createCalibration: (
    equipmentId: number,
    body: {
      calibration_date: string
      next_due_date?: string | null
      certificate_path?: string | null
      provider?: string | null
      result: string
      notes?: string | null
    },
  ) =>
    api<CalibrationRow>(`/equipments/${equipmentId}/calibrations`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCalibration: (
    equipmentId: number,
    calibrationId: number,
    body: Partial<{
      calibration_date: string
      next_due_date: string | null
      certificate_path: string | null
      provider: string | null
      result: string
      notes: string | null
    }>,
  ) =>
    api<CalibrationRow>(`/equipments/${equipmentId}/calibrations/${calibrationId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteCalibration: (equipmentId: number, calibrationId: number) =>
    api(`/equipments/${equipmentId}/calibrations/${calibrationId}`, { method: 'DELETE' }),
}

export type NonConformityRow = {
  id: number
  reference: string
  detected_at: string
  detected_by: number
  sample_id: number | null
  equipment_id: number | null
  order_id: number | null
  severity: string
  description: string
  status: string
  meta?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  detected_by_user?: { id: number; name: string; email: string }
  sample?: { id: number; reference: string } | null
  equipment?: { id: number; name: string; code: string } | null
  order?: { id: number; reference: string } | null
  corrective_actions?: CorrectiveActionRow[]
}

export type CorrectiveActionRow = {
  id: number
  non_conformity_id: number
  title: string
  responsible_user_id: number | null
  due_date: string | null
  status: string
  verification_notes: string | null
  created_at: string
  updated_at: string
  responsible_user?: { id: number; name: string; email: string } | null
}

export const nonConformitiesApi = {
  stats: () => api<{ open: number; closed: number; avg_resolution_days: number | null }>('/non-conformities/stats'),
  list: (params?: { status?: string; severity?: string }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.severity) q.set('severity', params.severity)
    const s = q.toString()
    return api<NonConformityRow[]>(`/non-conformities${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<NonConformityRow>(`/non-conformities/${id}`),
  create: (body: {
    detected_at: string
    detected_by: number
    sample_id?: number | null
    equipment_id?: number | null
    order_id?: number | null
    severity: string
    description: string
    status: string
    meta?: Record<string, unknown> | null
  }) => api<NonConformityRow>('/non-conformities', { method: 'POST', body: JSON.stringify(body) }),
  update: (
    id: number,
    body: Partial<{
      detected_at: string
      detected_by: number
      sample_id: number | null
      equipment_id: number | null
      order_id: number | null
      severity: string
      description: string
      status: string
      meta: Record<string, unknown> | null
    }>,
  ) => api<NonConformityRow>(`/non-conformities/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/non-conformities/${id}`, { method: 'DELETE' }),
  createAction: (
    ncId: number,
    body: {
      title: string
      responsible_user_id?: number | null
      due_date?: string | null
      status: string
      verification_notes?: string | null
    },
  ) =>
    api<CorrectiveActionRow>(`/non-conformities/${ncId}/corrective-actions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAction: (
    id: number,
    body: Partial<{
      title: string
      responsible_user_id: number | null
      due_date: string | null
      status: string
      verification_notes: string | null
    }>,
  ) => api<CorrectiveActionRow>(`/corrective-actions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
}

export const testTypesApi = {
  list: () => api<TestType[]>('/test-types'),
  get: (id: number) => api<TestType>(`/test-types/${id}`),
  create: (body: {
    name: string
    norm?: string
    unit?: string
    unit_price: number
    thresholds?: Record<string, number>
    params?: TestTypeParamInput[]
  }) => api<TestType>('/test-types', { method: 'POST', body: JSON.stringify(body) }),
  update: (
    id: number,
    body: {
      name?: string
      norm?: string
      unit?: string
      unit_price?: number
      thresholds?: Record<string, number>
      params?: TestTypeParamInput[]
    },
  ) => api<TestType>(`/test-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/test-types/${id}`, { method: 'DELETE' }),
}

export const ordersApi = {
  list: (params?: { status?: string; search?: string; page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.search) q.set('search', params.search)
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    const s = q.toString()
    return api<LaravelPaginator<Order>>(`/orders${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<Order>(`/orders/${id}`),
  create: (body: OrderCreateBody) => api<Order>('/orders', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Order>) => api<Order>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/orders/${id}`, { method: 'DELETE' }),
  samples: (orderId: number) => api<Sample[]>(`/orders/${orderId}/samples`),
  reports: (orderId: number) => api<Report[]>(`/orders/${orderId}/reports`),
  results: (orderId: number) => api<Sample[]>(`/orders/${orderId}/results`),
  generateReport: (orderId: number, body?: { pdf_template_id?: number; form_data?: Record<string, unknown> }) =>
    api<Report>(`/orders/${orderId}/reports`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
}

export type SampleWriteBody = {
  order_item_id: number
  reference: string
  notes?: string
  borehole_id?: number | null
  depth_top_m?: number | null
  depth_bottom_m?: number | null
}

export const samplesApi = {
  get: (id: number) => api<Sample>(`/samples/${id}`),
  create: (body: SampleWriteBody) => api<Sample>('/samples', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<SampleWriteBody> & Partial<Pick<Sample, 'status'>>) =>
    api<Sample>(`/samples/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/samples/${id}`, { method: 'DELETE' }),
  results: (
    sampleId: number,
    results: Array<{ test_type_param_id: number; value: string; equipment_id?: number | null }>,
  ) => api<Sample>(`/samples/${sampleId}/results`, { method: 'POST', body: JSON.stringify({ results }) }),
}

export const reportsApi = {
  sign: (reportId: number, body: { signer_name: string; signature_image_data?: string }) =>
    api<Report>(`/reports/${reportId}/sign`, { method: 'POST', body: JSON.stringify(body) }),
  submitReview: (reportId: number) =>
    api<Report>(`/reports/${reportId}/submit-review`, { method: 'POST', body: '{}' }),
  approveReview: (reportId: number) =>
    api<Report>(`/reports/${reportId}/approve-review`, { method: 'POST', body: '{}' }),
  /** Lien signé (15 min) — ouvre le PDF dans un nouvel onglet (lab + client). */
  download: async (reportId: number) => {
    const { url } = await api<{ url: string }>(`/reports/${reportId}/pdf-link`)
    window.open(url, '_blank', 'noopener,noreferrer')
  },
}

export const invoicesApi = {
  list: (params?: { search?: string; status?: string | string[]; page?: number; client_id?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.status) {
      if (Array.isArray(params.status)) {
        for (const st of params.status) q.append('status[]', st)
      } else {
        q.set('status', params.status)
      }
    }
    if (params?.page) q.set('page', String(params.page))
    if (params?.client_id) q.set('client_id', String(params.client_id))
    const s = q.toString()
    return api<LaravelPaginator<Invoice>>(`/invoices${s ? `?${s}` : ''}`)
  },
  listUnpaid: (params?: { search?: string; page?: number; client_id?: number; status?: string | string[] }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.page) q.set('page', String(params.page))
    if (params?.client_id) q.set('client_id', String(params.client_id))
    if (params?.status) {
      if (Array.isArray(params.status)) {
        for (const st of params.status) q.append('status[]', st)
      } else {
        q.set('status', params.status)
      }
    }
    const s = q.toString()
    return api<LaravelPaginator<Invoice> & { total_amount_due_ttc: string }>(
      `/invoices/unpaid${s ? `?${s}` : ''}`,
    )
  },
  getPdfLink: (id: number) => api<{ url: string }>(`/invoices/${id}/pdf-link`),
  openInvoicePdf: async (id: number) => {
    const { url } = await api<{ url: string }>(`/invoices/${id}/pdf-link`)
    window.open(url, '_blank', 'noopener,noreferrer')
  },
  get: (id: number) => api<Invoice>(`/invoices/${id}`),
  fromOrders: (orderIds: number[], clientId?: number) =>
    api<Invoice>('/invoices/from-orders', {
      method: 'POST',
      body: JSON.stringify({ order_ids: orderIds, client_id: clientId }),
    }),
  update: (id: number, body: Partial<Invoice>) =>
    api<Invoice>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/invoices/${id}`, { method: 'DELETE' }),
}

export interface CadragePayload {
  types_essais_demarrage?: string[]
  normes_referentiels?: string[]
  perimetre?: string | null
  tracabilite_iso17025?: { audit_trail?: boolean; signatures?: boolean; etalonnages?: boolean }
  checklist_done?: Record<string, boolean>
  options?: CadrageOptions
}

export interface CadrageOptions {
  types_essais_demarrage: Array<{ value: string; label: string }>
  normes_referentiels: Array<{ value: string; label: string }>
  perimetre: Array<{ value: string; label: string }>
}

export const cadrageApi = {
  get: () => api<CadragePayload>('/cadrage'),
  update: (body: Partial<CadragePayload>) =>
    api<CadragePayload>('/cadrage', { method: 'PUT', body: JSON.stringify(body) }),
}

export interface BtpExempleCalcul {
  id: string
  titre: string
  norme: string
  formule: string
  description: string
  exemple_entree: unknown
  exemple_sortie: number | null
  unite: string
}

export const btpCalculationsApi = {
  exemples: () => api<BtpExempleCalcul[]>('/btp-calculations/exemples'),
  calculer: (id: string, valeurs: Record<string, unknown>) =>
    api<{ resultat: number }>('/btp-calculations/calculer', {
      method: 'POST',
      body: JSON.stringify({ id, valeurs }),
    }),
  granulometry: (points: Array<{ opening_mm: number; passing_percent: number }>) =>
    api<GranulometryResult>('/btp-calculations/granulometry', {
      method: 'POST',
      body: JSON.stringify({ points }),
    }),
}

export interface GranulometryResult {
  d10: number | null
  d30: number | null
  d60: number | null
  cu: number | null
  cc: number | null
}

export interface ActivityLogRow {
  id: number
  user_id?: number | null
  action: string
  subject_type?: string | null
  subject_id?: number | null
  properties?: Record<string, unknown> | null
  ip_address?: string | null
  created_at: string
  user?: { id: number; name: string }
}

export const activityLogsApi = {
  list: (params?: { subject_type?: string; subject_id?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.subject_type) q.set('subject_type', params.subject_type)
    if (params?.subject_id != null) q.set('subject_id', String(params.subject_id))
    if (params?.limit) q.set('limit', String(params.limit))
    const s = q.toString()
    return api<ActivityLogRow[]>(`/activity-logs${s ? `?${s}` : ''}`)
  },
}

export interface StatsEssaisParType {
  test_type_id: number
  test_type_name: string
  norm?: string
  count_essais: number
  count_resultats: number
  valeurs_par_param: Record<string, { values: number[]; unit?: string; min?: number; max?: number; moyenne?: number; count: number }>
  dernieres_valeurs: number[]
}

export interface StatsEssaisRecent {
  id: number
  date?: string
  order_reference: string
  sample_reference: string
  test_type_name: string
  param_name: string
  value: string
  unit?: string
}

export interface StatsEssaisPayload {
  par_type: StatsEssaisParType[]
  recent_results: StatsEssaisRecent[]
  evolution: Array<{ mois: string; count: number }>
}

export const statsApi = {
  essais: () => api<StatsEssaisPayload>('/stats/essais'),
  dashboard: () => api<DashboardStatsPayload>('/stats/dashboard'),
}

/** Métadonnées métier : indicateurs (valeurs suivies) et champs libres. */
export type EntityMetaPayload = {
  indicateurs?: Record<string, string>
  champs_perso?: Record<string, string>
  /** Ordre d’affichage : enchaîner lignes et jalons (produit, jalon, produit, …). */
  devis_parcours?: Array<{ kind: 'ligne' | 'jalon'; id: string }>
  /** Jalons devis (optionnel) : libellé, montant, lien offre ou article PROLAB */
  devis_jalons?: Array<{
    id?: string
    libelle: string
    montant_ht?: number
    ref_article_id?: number | null
    commercial_offering_id?: number | null
  }>
  /** Tarif forfaitaire lorsqu’il n’y a pas de lignes article (optionnel) */
  tarif_global_hors_lignes_ht?: number
  /** Un booléen par ligne (même ordre) : ne pas afficher le prix sur le PDF */
  ligne_masque_prix_pdf?: boolean[]
  /** Frais complémentaires (brouillon / PDF — le recalcul API n’intègre que port & déplacement) */
  frais_supplementaires?: Array<{
    id?: string
    description: string
    montant_ht: number
    tva_rate: number
  }>
}

export interface DashboardStatsPayload {
  counts: {
    clients: number
    sites: number
    orders: number
    orders_by_status: Record<string, number>
    quotes: number
    quotes_by_status: Record<string, number>
    invoices: number
    invoices_by_status: Record<string, number>
    reports_total: number
    reports_pending_review: number
    reports_approved: number
    samples_total: number
    samples_by_status: Record<string, number>
  }
  amounts: {
    invoices_ttc_total: number
    invoices_ttc_paid: number
    invoices_ttc_unpaid: number
    quotes_open_ttc: number
  }
  delays: {
    order_to_first_report_days_avg: number | null
    order_to_first_report_days_median: number | null
    order_to_first_report_sample_size: number
    order_delivery_cycle_days_avg: number | null
    order_delivery_cycle_days_median: number | null
    order_delivery_cycle_sample_size: number
    quote_to_site_delivery_days_avg: number | null
    quote_to_site_delivery_days_median: number | null
    quote_planning_sample_size: number
    sample_reception_days_avg: number | null
    sample_reception_days_median: number | null
    sample_reception_sample_size: number
  }
  ca_par_mois: Array<{ mois: string; ca_ttc: number }>
}

export interface CommercialOffering {
  id: number
  code: string | null
  name: string
  description: string | null
  kind: 'product' | 'service'
  unit: string | null
  purchase_price_ht: number
  sale_price_ht: number
  default_tva_rate: number
  stock_quantity: number
  track_stock: boolean
  active: boolean
  /** Lien optionnel vers une fiche matériel (inventaire) */
  equipment_id?: number | null
  equipment?: Pick<EquipmentRow, 'id' | 'name' | 'code' | 'numero_inventaire' | 'serial_number'> | null
}

export const commercialOfferingsApi = {
  list: (params?: { search?: string; kind?: string; active_only?: boolean; per_page?: number; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.kind) q.set('kind', params.kind)
    if (params?.active_only) q.set('active_only', '1')
    if (params?.per_page) q.set('per_page', String(params.per_page))
    if (params?.page) q.set('page', String(params.page))
    const s = q.toString()
    return api<LaravelPaginator<CommercialOffering>>(`/commercial-offerings${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<CommercialOffering>(`/commercial-offerings/${id}`),
  create: (body: Partial<CommercialOffering> & { name: string; kind: 'product' | 'service' }) =>
    api<CommercialOffering>('/commercial-offerings', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<CommercialOffering>) =>
    api<CommercialOffering>(`/commercial-offerings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/commercial-offerings/${id}`, { method: 'DELETE' }),
}

export interface QuoteLine {
  id?: number
  commercial_offering_id?: number | null
  commercial_offering?: CommercialOffering | null
  ref_article_id?: number | null
  ref_package_id?: number | null
  /** libre | catalogue | commentaire */
  type_ligne?: string | null
  line_code?: string | null
  description: string
  quantity: number
  unit_price: number
  tva_rate?: number
  discount_percent?: number
  total?: number
}

export interface Quote {
  id: number
  number: string
  client_id: number
  contact_id?: number | null
  site_id?: number
  dossier_id?: number | null
  quote_date: string
  order_date?: string
  site_delivery_date?: string
  valid_until?: string
  amount_ht: number
  amount_ttc: number
  tva_rate: number
  discount_percent?: number
  discount_amount?: number
  shipping_amount_ht?: number
  shipping_tva_rate?: number
  travel_fee_ht?: number
  travel_fee_tva_rate?: number
  billing_address_id?: number
  delivery_address_id?: number
  pdf_template_id?: number
  status: string
  notes?: string
  meta?: EntityMetaPayload | null
  client?: Client
  client_contact?: ClientContactRow
  site?: Site
  billing_address?: ClientAddress
  delivery_address?: ClientAddress
  quote_lines?: QuoteLine[]
}

export const quotesApi = {
  list: (params?: { search?: string; status?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.status) q.set('status', params.status)
    if (params?.page) q.set('page', String(params.page))
    const s = q.toString()
    return api<LaravelPaginator<Quote>>(`/quotes${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<Quote>(`/quotes/${id}`),
  create: (body: QuoteCreateBody) => api<Quote>('/quotes', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<QuoteCreateBody> & { status?: string; meta?: EntityMetaPayload | null }) =>
    api<Quote>(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/quotes/${id}`, { method: 'DELETE' }),
}

export interface QuoteCreateBody {
  client_id: number
  contact_id?: number | null
  site_id?: number
  dossier_id?: number | null
  meta?: EntityMetaPayload | null
  quote_date: string
  order_date?: string
  site_delivery_date?: string
  valid_until?: string
  tva_rate?: number
  discount_percent?: number
  discount_amount?: number
  shipping_amount_ht?: number
  shipping_tva_rate?: number
  travel_fee_ht?: number
  travel_fee_tva_rate?: number
  apply_site_travel?: boolean
  billing_address_id?: number
  delivery_address_id?: number
  pdf_template_id?: number
  notes?: string
  lines: Array<{
    commercial_offering_id?: number | null
    ref_article_id?: number | null
    ref_package_id?: number | null
    type_ligne?: string
    line_code?: string | null
    description: string
    quantity: number
    unit_price: number
    tva_rate?: number
    discount_percent?: number
  }>
}

export const pdfApi = {
  templates: () => api<{ data: PdfTemplate[] }>('/pdf/templates'),
  downloadExample: async (slug: string) => {
    const token = getToken()
    const res = await fetch(`${API_BASE}/pdf/examples/${slug}`, {
      headers: {
        Accept: 'application/pdf',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || 'Téléchargement impossible')
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `exemple-${slug}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },
  generate: async (type: string, id: number, templateId?: number) => {
    const token = getToken()
    const res = await fetch(`${API_BASE}/pdf/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/pdf,*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ type, id, template_id: templateId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || 'Erreur génération PDF')
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `document-${type}-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },
}

export interface PdfTemplate {
  id: string
  label: string
  resource: string
}

export interface MailTemplate {
  id: number
  name: string
  subject: string
  body: string
  description?: string
}

export interface MailLog {
  id: number
  to: string
  subject: string
  template_name?: string
  status: string
  error_message?: string
  sent_at: string
  user?: { id: number; name: string }
}

export const mailApi = {
  templates: () => api<{ data: MailTemplate[] }>('/mail/templates'),
  logs: (page?: number) =>
    api<{ data: MailLog[]; current_page: number; last_page: number }>(
      page ? `/mail/logs?page=${page}` : '/mail/logs'
    ),
  send: (body: { to: string; subject: string; body: string; template_name?: string }) =>
    api<{ message: string }>('/mail/send', { method: 'POST', body: JSON.stringify(body) }),
}

export const mailTemplatesApi = {
  list: () => api<{ data: MailTemplate[] }>('/mail-templates'),
  create: (body: { name: string; subject: string; body: string; description?: string }) =>
    api<MailTemplate>('/mail-templates', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<{ name: string; subject: string; body: string; description: string }>) =>
    api<MailTemplate>(`/mail-templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/mail-templates/${id}`, { method: 'DELETE' }),
}

export interface User {
  id: number
  name: string
  email: string
  phone?: string | null
  role: string
  client_id?: number
  site_id?: number
  client?: Client
  site?: Site
  access_groups?: AccessGroupRow[]
  agencies?: AgencyRow[]
  effective_permissions?: string[]
}

export interface RegisterBody {
  name: string
  email: string
  password: string
  password_confirmation: string
  role: 'client' | 'site_contact'
  client_id?: number
  site_id?: number
}

export interface ClientReferent {
  id: number
  name: string
  email?: string
}

export interface Client {
  id: number
  name: string
  /** Code tiers import PROLAB (ex. TI0002) */
  prolab_code?: string | null
  country?: string | null
  address?: string
  city?: string | null
  postal_code?: string | null
  email?: string
  phone?: string
  whatsapp?: string | null
  siret?: string
  /** Maroc — Identifiant Commun de l’Entreprise */
  ice?: string | null
  rc?: string | null
  patente?: string | null
  if_number?: string | null
  legal_form?: string | null
  cnss_employer?: string | null
  capital_social?: number | string | null
  meta?: EntityMetaPayload | null
  // Référents S2G
  commercial_id?: number | null
  responsable_technique_id?: number | null
  responsable_facturation_id?: number | null
  responsable_recouvrement_id?: number | null
  commercial?: ClientReferent | null
  responsable_technique?: ClientReferent | null
  responsable_facturation?: ClientReferent | null
  responsable_recouvrement?: ClientReferent | null
  // GPS
  lat?: number | null
  lng?: number | null
  sites?: Site[]
  addresses?: ClientAddress[]
  contacts?: ClientContactRow[]
}

export interface Site {
  id: number
  client_id: number
  name: string
  address?: string
  latitude?: number | string | null
  longitude?: number | string | null
  reference?: string
  /** Workflow chantier : not_started | in_progress | blocked | delivered | archived */
  status?: string | null
  travel_fee_quote_ht?: number
  travel_fee_invoice_ht?: number
  travel_fee_label?: string
  meta?: EntityMetaPayload | null
  client?: Client
  created_at?: string
  updated_at?: string
}

/** Mission géotechnique sur un chantier (terrain / forages). */
export interface Mission {
  id: number
  site_id: number
  dossier_id?: number | null
  bon_commande_id?: number | null
  reference?: string | null
  title?: string | null
  mission_status?: string | null
  maitre_ouvrage_name?: string | null
  maitre_ouvrage_email?: string | null
  maitre_ouvrage_phone?: string | null
  notes?: string | null
  meta?: EntityMetaPayload | null
  site?: Site
  dossier?: DossierRow
  bon_commande?: BonCommande
  created_at?: string
  updated_at?: string
}

export interface Borehole {
  id: number
  mission_id: number
  code?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  ground_level_m?: number | string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface LithologyLayer {
  id: number
  borehole_id: number
  depth_from_m?: number | string | null
  depth_to_m?: number | string | null
  description?: string | null
  rqd?: number | string | null
  sort_order?: number | null
  created_at?: string
  updated_at?: string
}

export const missionsApi = {
  listAll: (params?: { dossier_id?: number; bon_commande_id?: number }) => {
    const q = new URLSearchParams()
    if (params?.dossier_id) q.set('dossier_id', String(params.dossier_id))
    if (params?.bon_commande_id) q.set('bon_commande_id', String(params.bon_commande_id))
    const s = q.toString()
    return api<Mission[]>(`/missions${s ? `?${s}` : ''}`)
  },
  createGlobal: (body: Partial<Mission> & { source_type: 'dossier' | 'bon_commande'; source_id: number }) =>
    api<Mission>('/missions', { method: 'POST', body: JSON.stringify(body) }),
  list: (siteId: number) => api<Mission[]>(`/sites/${siteId}/missions`),
  create: (siteId: number, body: Partial<Mission>) =>
    api<Mission>(`/sites/${siteId}/missions`, { method: 'POST', body: JSON.stringify(body) }),
  get: (id: number) => api<Mission>(`/missions/${id}`),
  update: (id: number, body: Partial<Mission>) =>
    api<Mission>(`/missions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/missions/${id}`, { method: 'DELETE' }),
}

export const boreholesApi = {
  list: (missionId: number) => api<Borehole[]>(`/missions/${missionId}/boreholes`),
  create: (missionId: number, body: Partial<Borehole>) =>
    api<Borehole>(`/missions/${missionId}/boreholes`, { method: 'POST', body: JSON.stringify(body) }),
  get: (id: number) => api<Borehole>(`/boreholes/${id}`),
  update: (id: number, body: Partial<Borehole>) =>
    api<Borehole>(`/boreholes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/boreholes/${id}`, { method: 'DELETE' }),
}

export const lithologyLayersApi = {
  list: (boreholeId: number) => api<LithologyLayer[]>(`/boreholes/${boreholeId}/lithology-layers`),
  create: (boreholeId: number, body: Partial<LithologyLayer>) =>
    api<LithologyLayer>(`/boreholes/${boreholeId}/lithology-layers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  get: (id: number) => api<LithologyLayer>(`/lithology-layers/${id}`),
  update: (id: number, body: Partial<LithologyLayer>) =>
    api<LithologyLayer>(`/lithology-layers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/lithology-layers/${id}`, { method: 'DELETE' }),
}

export interface TestTypeParam {
  id: number
  name: string
  unit?: string
  expected_type: string
}

export interface TestType {
  id: number
  name: string
  norm?: string
  unit?: string
  unit_price: number
  thresholds?: Record<string, number>
  params?: TestTypeParam[]
}

export interface OrderItem {
  id: number
  order_id: number
  test_type_id: number
  quantity: number
  test_type?: TestType
  samples?: Sample[]
}

export interface Order {
  id: number
  reference: string
  client_id: number
  site_id?: number
  status: string
  order_date: string
  delivery_date?: string
  billing_address_id?: number
  delivery_address_id?: number
  notes?: string
  meta?: EntityMetaPayload | null
  client?: Client
  site?: Site
  order_items?: OrderItem[]
  reports?: Report[]
}

export interface OrderCreateBody {
  client_id: number
  site_id?: number
  order_date: string
  notes?: string
  items: Array<{ test_type_id: number; quantity: number }>
}

export interface Sample {
  id: number
  order_item_id: number
  reference: string
  received_at?: string
  status: string
  notes?: string
  borehole_id?: number | null
  depth_top_m?: number | string | null
  depth_bottom_m?: number | string | null
  order_item?: OrderItem
  test_results?: TestResult[]
  borehole?: Borehole
}

export interface TestResult {
  id: number
  sample_id: number
  test_type_param_id: number
  equipment_id?: number | null
  value: string
  test_type_param?: TestTypeParam
  equipment?: Pick<EquipmentRow, 'id' | 'name' | 'code' | 'status'>
}

export interface Report {
  id: number
  order_id: number
  pdf_template_id?: number
  file_path: string
  filename: string
  generated_at: string
  form_data?: Record<string, unknown>
  signed_at?: string | null
  signer_name?: string | null
  signature_image_data?: string | null
  signed_by_user_id?: number | null
  review_status?: string | null
  reviewed_at?: string | null
  reviewed_by_user_id?: number | null
  pdf_template?: ReportPdfTemplateRow
  signed_by_user?: { id: number; name: string }
  reviewed_by_user?: { id: number; name: string }
}

export interface Invoice {
  id: number
  number: string
  client_id: number
  contact_id?: number | null
  invoice_date: string
  order_date?: string
  site_delivery_date?: string
  due_date?: string
  amount_ht: number
  amount_ttc: number
  tva_rate: number
  discount_percent?: number
  discount_amount?: number
  shipping_amount_ht?: number
  shipping_tva_rate?: number
  travel_fee_ht?: number
  travel_fee_tva_rate?: number
  billing_address_id?: number
  delivery_address_id?: number
  pdf_template_id?: number
  status: string
  meta?: EntityMetaPayload | null
  client?: Client
  client_contact?: ClientContactRow
  orders?: Order[]
  invoice_lines?: InvoiceLine[]
  billing_address?: ClientAddress
  delivery_address?: ClientAddress
}

export interface InvoiceLine {
  id: number
  description: string
  quantity: number
  unit_price: number
  tva_rate?: number
  discount_percent?: number
  total: number
}

export interface ClientCommercialOverview {
  client: Client & { addresses?: ClientAddress[]; attachments?: Attachment[] }
  quotes: Quote[]
  invoices: Invoice[]
  stats: {
    quotes_by_status: Record<string, number>
    invoices_by_status: Record<string, number>
    amount_due_ttc: number
    total_invoiced_ttc: number
    total_quotes_ttc: number
    open_quotes_count: number
  }
  document_links: CommercialDocumentLink[]
}

// ── Ordres de mission ─────────────────────────────────────────────────────────

export interface ArticleAction {
  id: number
  ref_article_id: number
  type: 'technicien' | 'ingenieur' | 'labo'
  libelle: string
  description?: string | null
  duree_heures: number
  ordre: number
  created_at?: string
  updated_at?: string
}

export interface ArticleEquipmentRequirement {
  id: number
  ref_article_id: number
  equipment_id: number
  quantite: number
  notes?: string | null
  equipment?: { id: number; name: string; code?: string; type?: string }
}

export interface OrdreMissionLigne {
  id: number
  ordre_mission_id: number
  bon_commande_ligne_id?: number | null
  ref_article_id?: number | null
  article_action_id?: number | null
  libelle: string
  quantite: number
  statut: 'a_faire' | 'en_cours' | 'realise' | 'annule'
  assigned_user_id?: number | null
  equipment_id?: number | null
  date_prevue?: string | null
  date_realisation?: string | null
  duree_reelle_heures?: number | null
  notes?: string | null
  ordre: number
  assignedUser?: { id: number; name: string } | null
  equipment?: { id: number; name: string; code?: string } | null
  articleAction?: ArticleAction | null
  article?: { id: number; code: string; libelle: string } | null
}

export interface OrdreMission {
  id: number
  numero: string
  bon_commande_id: number
  dossier_id?: number | null
  client_id: number
  site_id?: number | null
  type: 'labo' | 'technicien' | 'ingenieur'
  statut: 'brouillon' | 'planifie' | 'en_cours' | 'termine' | 'annule'
  date_prevue?: string | null
  date_debut?: string | null
  date_fin?: string | null
  responsable_id?: number | null
  notes?: string | null
  created_at?: string
  client?: { id: number; name: string } | null
  site?: { id: number; name: string } | null
  responsable?: { id: number; name: string } | null
  bonCommande?: { id: number; numero: string } | null
  lignes?: OrdreMissionLigne[]
}

export interface FraisDeplacement {
  id: number
  ordre_mission_id: number
  user_id: number
  date: string
  lieu_depart?: string | null
  lieu_arrivee?: string | null
  distance_km: number
  taux_km: number
  montant: number
  type_transport: string
  notes?: string | null
  statut: 'draft' | 'valide' | 'rembourse'
  user?: { id: number; name: string } | null
}

export const articleActionsApi = {
  list: (articleId: number) =>
    api<ArticleAction[]>(`/articles/${articleId}/actions`),
  create: (articleId: number, body: Partial<ArticleAction>) =>
    api<ArticleAction>(`/articles/${articleId}/actions`, { method: 'POST', body: JSON.stringify(body) }),
  update: (articleId: number, id: number, body: Partial<ArticleAction>) =>
    api<ArticleAction>(`/articles/${articleId}/actions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (articleId: number, id: number) =>
    api<void>(`/articles/${articleId}/actions/${id}`, { method: 'DELETE' }),
  equipmentList: (articleId: number) =>
    api<ArticleEquipmentRequirement[]>(`/articles/${articleId}/equipment-requirements`),
  equipmentAdd: (articleId: number, body: { equipment_id: number; quantite?: number; notes?: string }) =>
    api<ArticleEquipmentRequirement>(`/articles/${articleId}/equipment-requirements`, { method: 'POST', body: JSON.stringify(body) }),
  equipmentRemove: (articleId: number, reqId: number) =>
    api<void>(`/articles/${articleId}/equipment-requirements/${reqId}`, { method: 'DELETE' }),
}

export const ordresMissionApi = {
  list: (params?: { type?: string; statut?: string; bon_commande_id?: number; date_from?: string; date_to?: string }) => {
    const s = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : ''
    return api<OrdreMission[]>(`/ordres-mission${s ? `?${s}` : ''}`)
  },
  get: (id: number) => api<OrdreMission>(`/ordres-mission/${id}`),
  update: (id: number, body: Partial<OrdreMission>) =>
    api<OrdreMission>(`/ordres-mission/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) =>
    api<void>(`/ordres-mission/${id}`, { method: 'DELETE' }),
  generateFromBC: (bcId: number) =>
    api<OrdreMission[]>(`/bons-commande/${bcId}/generate-ordres-mission`, { method: 'POST' }),
  updateLigne: (omId: number, ligneId: number, body: Partial<OrdreMissionLigne>) =>
    api<OrdreMissionLigne>(`/ordres-mission/${omId}/lignes/${ligneId}`, { method: 'PUT', body: JSON.stringify(body) }),
  planning: (params?: { type?: string; from?: string; to?: string }) => {
    const s = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : ''
    return api<OrdreMission[]>(`/ordres-mission/planning${s ? `?${s}` : ''}`)
  },
  fraisList: (omId: number) => api<FraisDeplacement[]>(`/ordres-mission/${omId}/frais`),
  fraisCreate: (omId: number, body: Partial<FraisDeplacement>) =>
    api<FraisDeplacement>(`/ordres-mission/${omId}/frais`, { method: 'POST', body: JSON.stringify(body) }),
  fraisUpdate: (omId: number, fraisId: number, body: Partial<FraisDeplacement>) =>
    api<FraisDeplacement>(`/ordres-mission/${omId}/frais/${fraisId}`, { method: 'PUT', body: JSON.stringify(body) }),
  fraisDelete: (omId: number, fraisId: number) =>
    api<void>(`/ordres-mission/${omId}/frais/${fraisId}`, { method: 'DELETE' }),
}
