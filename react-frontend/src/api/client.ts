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
  list: () => api<Client[]>('/clients'),
  get: (id: number) => api<Client>(`/clients/${id}`),
  create: (body: Partial<Client>) => api<Client>('/clients', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Client>) => api<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/clients/${id}`, { method: 'DELETE' }),
}

export const sitesApi = {
  list: () => api<Site[]>('/sites'),
  get: (id: number) => api<Site>(`/sites/${id}`),
  create: (body: Partial<Site>) => api<Site>('/sites', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Site>) => api<Site>(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/sites/${id}`, { method: 'DELETE' }),
}

export const testTypesApi = {
  list: () => api<TestType[]>('/test-types'),
  get: (id: number) => api<TestType>(`/test-types/${id}`),
  create: (body: Partial<TestType> & { params?: Array<{ name: string; unit?: string; expected_type?: string }> }) =>
    api<TestType>('/test-types', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<TestType>) =>
    api<TestType>(`/test-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/test-types/${id}`, { method: 'DELETE' }),
}

export const ordersApi = {
  list: (params?: { status?: string }) => {
    const q = params?.status ? `?status=${params.status}` : ''
    return api<{ data: Order[] }>(`/orders${q}`)
  },
  get: (id: number) => api<Order>(`/orders/${id}`),
  create: (body: OrderCreateBody) => api<Order>('/orders', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Order>) => api<Order>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/orders/${id}`, { method: 'DELETE' }),
  samples: (orderId: number) => api<Sample[]>(`/orders/${orderId}/samples`),
  reports: (orderId: number) => api<Report[]>(`/orders/${orderId}/reports`),
  results: (orderId: number) => api<Sample[]>(`/orders/${orderId}/results`),
  generateReport: (orderId: number) => api<Report>(`/orders/${orderId}/reports`, { method: 'POST' }),
}

export const samplesApi = {
  get: (id: number) => api<Sample>(`/samples/${id}`),
  update: (id: number, body: Partial<Sample>) => api<Sample>(`/samples/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  results: (sampleId: number, results: Array<{ test_type_param_id: number; value: string }>) =>
    api<Sample>(`/samples/${sampleId}/results`, { method: 'POST', body: JSON.stringify({ results }) }),
}

export const reportsApi = {
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
  list: () => api<{ data: Invoice[] }>('/invoices'),
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
  total?: number
}

export interface Quote {
  id: number
  number: string
  client_id: number
  site_id?: number
  quote_date: string
  valid_until?: string
  amount_ht: number
  amount_ttc: number
  tva_rate: number
  status: string
  notes?: string
  client?: Client
  site?: Site
  quote_lines?: QuoteLine[]
}

export const quotesApi = {
  list: () => api<{ data: Quote[] }>('/quotes'),
  get: (id: number) => api<Quote>(`/quotes/${id}`),
  create: (body: QuoteCreateBody) => api<Quote>('/quotes', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<QuoteCreateBody>) =>
    api<Quote>(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => api(`/quotes/${id}`, { method: 'DELETE' }),
}

export interface QuoteCreateBody {
  client_id: number
  site_id?: number
  quote_date: string
  valid_until?: string
  tva_rate?: number
  notes?: string
  lines: Array<{ description: string; quantity: number; unit_price: number }>
}

export const pdfApi = {
  templates: () => api<{ data: PdfTemplate[] }>('/pdf/templates'),
  generate: async (type: string, id: number) => {
    const token = getToken()
    const res = await fetch(`${API_BASE}/pdf/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ type, id }),
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
  file_path: string
  filename: string
  generated_at: string
}

export interface Invoice {
  id: number
  number: string
  client_id: number
  invoice_date: string
  due_date?: string
  amount_ht: number
  amount_ttc: number
  tva_rate: number
  status: string
  client?: Client
  orders?: Order[]
  invoice_lines?: InvoiceLine[]
}

export interface InvoiceLine {
  id: number
  description: string
  quantity: number
  unit_price: number
  total: number
}
