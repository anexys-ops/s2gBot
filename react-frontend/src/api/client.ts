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
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message || `Erreur ${res.status}`)
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
  logout: () => api('/logout', { method: 'POST' }),
  user: () => api<User>('/user'),
}

export const clientsApi = {
  list: (params?: { search?: string }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
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

export interface DocumentPdfTemplateRow {
  id: number
  document_type: string
  slug: string
  name: string
  blade_view: string
  is_default: boolean
}

export const clientAddressesApi = {
  list: (clientId: number) => api<ClientAddress[]>(`/clients/${clientId}/addresses`),
  create: (clientId: number, body: Partial<ClientAddress>) =>
    api<ClientAddress>(`/clients/${clientId}/addresses`, { method: 'POST', body: JSON.stringify(body) }),
  update: (addressId: number, body: Partial<ClientAddress>) =>
    api<ClientAddress>(`/client-addresses/${addressId}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (addressId: number) => api(`/client-addresses/${addressId}`, { method: 'DELETE' }),
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
  setDefault: (id: number, body: { is_default?: boolean; name?: string }) =>
    api<DocumentPdfTemplateRow>(`/document-pdf-templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
}

export interface ReportPdfTemplateRow {
  id: number
  slug: string
  name: string
  blade_view: string
  is_default: boolean
}

export const reportPdfTemplatesApi = {
  list: () => api<{ data: ReportPdfTemplateRow[] }>('/report-pdf-templates'),
  update: (id: number, body: { is_default?: boolean; name?: string }) =>
    api<ReportPdfTemplateRow>(`/report-pdf-templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
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
  list: (params?: { status?: string; search?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.search) q.set('search', params.search)
    if (params?.page) q.set('page', String(params.page))
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

export const samplesApi = {
  get: (id: number) => api<Sample>(`/samples/${id}`),
  create: (body: { order_item_id: number; reference: string; notes?: string }) =>
    api<Sample>('/samples', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Sample>) => api<Sample>(`/samples/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/samples/${id}`, { method: 'DELETE' }),
  results: (sampleId: number, results: Array<{ test_type_param_id: number; value: string }>) =>
    api<Sample>(`/samples/${sampleId}/results`, { method: 'POST', body: JSON.stringify({ results }) }),
}

export const reportsApi = {
  sign: (reportId: number, body: { signer_name: string; signature_image_data?: string }) =>
    api<Report>(`/reports/${reportId}/sign`, { method: 'POST', body: JSON.stringify(body) }),
  download: async (reportId: number) => {
    const token = getToken()
    const res = await fetch(`${API_BASE}/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Téléchargement impossible')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rapport-${reportId}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },
}

export const invoicesApi = {
  list: (params?: { search?: string; status?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.status) q.set('status', params.status)
    if (params?.page) q.set('page', String(params.page))
    const s = q.toString()
    return api<LaravelPaginator<Invoice>>(`/invoices${s ? `?${s}` : ''}`)
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
}

export interface QuoteLine {
  id?: number
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
  site_id?: number
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
  client?: Client
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
  update: (id: number, body: Partial<QuoteCreateBody> & { status?: string }) =>
    api<Quote>(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/quotes/${id}`, { method: 'DELETE' }),
}

export interface QuoteCreateBody {
  client_id: number
  site_id?: number
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
  role: string
  client_id?: number
  site_id?: number
  client?: Client
  site?: Site
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

export interface Client {
  id: number
  name: string
  address?: string
  email?: string
  phone?: string
  siret?: string
  sites?: Site[]
}

export interface Site {
  id: number
  client_id: number
  name: string
  address?: string
  reference?: string
  travel_fee_quote_ht?: number
  travel_fee_invoice_ht?: number
  travel_fee_label?: string
  client?: Client
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
  order_item?: OrderItem
  test_results?: TestResult[]
}

export interface TestResult {
  id: number
  sample_id: number
  test_type_param_id: number
  value: string
  test_type_param?: TestTypeParam
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
  pdf_template?: ReportPdfTemplateRow
  signed_by_user?: { id: number; name: string }
}

export interface Invoice {
  id: number
  number: string
  client_id: number
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
  client?: Client
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
