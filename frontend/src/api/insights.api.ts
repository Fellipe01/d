import { api } from './client';

export interface Insight {
  id: number;
  client_id: number;
  generated_at: string;
  period_start: string;
  period_end: string;
  content: string;
  summary: string | null;
  impact_level: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  status: 'active' | 'archived' | 'actioned';
  triggered_by: string;
}

export const insightsApi = {
  list: (clientId: number, limit = 20) =>
    api.get<Insight[]>(`/clients/${clientId}/insights`, { params: { limit } }).then(r => r.data),
  get: (id: number) => api.get<Insight>(`/insights/${id}`).then(r => r.data),
  generate: (clientId: number, opts?: { start?: string; end?: string; report_type?: string }) =>
    api.post<Insight>(`/clients/${clientId}/insights/generate`, opts).then(r => r.data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/insights/${id}/status`, { status }),
};
