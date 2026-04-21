export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  client_id?: number | null;
  site_id?: number | null;
  client?: { id: number; name: string };
  site?: { id: number; name: string };
}

export interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  siret?: string;
}

export interface Site {
  id: number;
  client_id: number;
  name: string;
  reference?: string;
  status?: string | null;
  created_at?: string;
}

export interface Order {
  id: number;
  reference: string;
  client_id: number;
  site_id?: number;
  status: string;
  order_date: string;
  client?: Client;
  site?: Site;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}
