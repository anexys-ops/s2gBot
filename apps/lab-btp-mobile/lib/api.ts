import { API_BASE } from './config';
import { clearStoredToken, getStoredToken } from './tokenStorage';
import type { Client, Order, Paginated, User } from './types';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    await clearStoredToken();
  }
  if (!res.ok) {
    const msg = typeof data.message === 'string' ? data.message : `Erreur ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: User; token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => api<{ message: string }>('/logout', { method: 'POST' }),
  user: () => api<User>('/user'),
};

export const ordersApi = {
  list: (params?: { page?: number; search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    const s = q.toString();
    return api<Paginated<Order>>(`/orders${s ? `?${s}` : ''}`);
  },
  get: (id: number) => api<Order>(`/orders/${id}`),
};

export const clientsApi = {
  list: (params?: { search?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    const s = q.toString();
    return api<Client[]>(`/clients${s ? `?${s}` : ''}`);
  },
};
