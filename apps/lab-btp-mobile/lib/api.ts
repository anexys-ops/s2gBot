import { API_BASE, API_ORIGIN } from './config';
import { clearStoredToken, getStoredToken } from './tokenStorage';
import type { Client, Order, Paginated, User } from './types';

/** Erreur API (HTTP ou réseau). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly payload?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function networkFailureHint(): string {
  return (
    `Impossible de joindre l'API. URL utilisée : ${API_BASE}. ` +
    `Vérifiez la connexion Internet. Sur téléphone : ouvrez ${API_ORIGIN}/api/version dans le navigateur. ` +
    `API locale sur PC : définissez EXPO_PUBLIC_API_URL avec l'IP du PC (ex. http://192.168.1.10:8000), puis redémarrez Expo (npx expo start -c). ` +
    `Émulateur Android + serveur sur la machine hôte : http://10.0.2.2:8000 (sans /api dans EXPO_PUBLIC_API_URL).`
  );
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new ApiError(networkFailureHint(), undefined, err);
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    await clearStoredToken();
  }
  if (!res.ok) {
    const msg = typeof data.message === 'string' ? data.message : `Erreur ${res.status}`;
    throw new ApiError(msg, res.status, data);
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
