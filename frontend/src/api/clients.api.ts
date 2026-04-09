import { api } from './client';

export interface Client {
  id: number;
  name: string;
  slug: string;
  ad_account: string | null;
  status: 'active' | 'paused' | 'churned';
  payment_method: string | null;
  objectives: string[];
  monthly_budget: number | null;
  saldo_pix_enabled: boolean;
  saldo_pix_amount: number | null;
  saldo_pix_threshold: number | null;
  created_at: string;
  kpis?: ClientKpi[];
}

export interface ClientKpi {
  id: number;
  client_id: number;
  kpi_name: string;
  target_value: number;
  min_value: number | null;
  max_value: number | null;
  weight: number;
  kpi_type: 'lower_is_better' | 'higher_is_better' | 'range';
}

export const clientsApi = {
  list: () => api.get<Client[]>('/clients').then(r => r.data),
  get: (id: number) => api.get<Client>(`/clients/${id}`).then(r => r.data),
  create: (data: Partial<Client>) => api.post<Client>('/clients', data).then(r => r.data),
  update: (id: number, data: Partial<Client>) => api.put<Client>(`/clients/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/clients/${id}`),
  getKpis: (id: number) => api.get<ClientKpi[]>(`/clients/${id}/kpis`).then(r => r.data),
  upsertKpis: (id: number, kpis: Partial<ClientKpi>[]) =>
    api.put<ClientKpi[]>(`/clients/${id}/kpis`, { kpis }).then(r => r.data),
  seedMock: (id: number) => api.post(`/ingestion/${id}/meta-ads/mock`).then(r => r.data),
  checkAlerts: (id: number) => api.post(`/clients/${id}/alerts/check`).then(r => r.data),
};
