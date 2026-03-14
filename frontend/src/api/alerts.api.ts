import { api } from './client';

export interface Alert {
  id: number;
  client_id: number;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  entity_type: string | null;
  kpi_name: string | null;
  actual_value: number | null;
  threshold_value: number | null;
  created_at: string;
  resolved_at: string | null;
}

export const alertsApi = {
  list: (clientId: number, showResolved = false) =>
    api.get<Alert[]>(`/clients/${clientId}/alerts`, { params: { resolved: showResolved } }).then(r => r.data),
  resolve: (id: number) => api.post(`/alerts/${id}/resolve`),
  summary: () => api.get('/alerts/summary').then(r => r.data),
};
