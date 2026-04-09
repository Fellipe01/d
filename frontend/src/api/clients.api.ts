import { api } from './client';

export interface Client {
  id: number;
  name: string;
  slug: string;
  ad_account: string | null;
  rdstation_token: string | null;
  rd_fonte_field: string | null;
  rd_campanha_field: string | null;
  rd_criativo_field: string | null;
  rd_pipeline_id: string | null;
  rd_mql_stage: string | null;
  rd_sql_stage: string | null;
  rd_venda_stage: string | null;
  status: 'active' | 'paused' | 'churned';
  payment_method: string | null;
  objectives: string[];
  monthly_budget: number | null;
  last_meta_sync_at: string | null;
  last_rd_sync_at: string | null;
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
  syncMetaAds: (id: number) => api.post(`/ingestion/${id}/meta-ads/sync`).then(r => r.data),
  syncRdStation: (id: number) => api.post(`/ingestion/${id}/rd-station/sync`).then(r => r.data),
  checkAlerts: (id: number) => api.post(`/clients/${id}/alerts/check`).then(r => r.data),
};
