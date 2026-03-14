import { api } from './client';

export interface Report {
  id: number;
  client_id: number;
  report_type: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  content?: string;
  status: string;
}

export const reportsApi = {
  list: (clientId: number) =>
    api.get<Report[]>(`/clients/${clientId}/reports`).then(r => r.data),
  get: (id: number) => api.get<Report>(`/reports/${id}`).then(r => r.data),
  generate: (clientId: number, reportType: string) =>
    api.post<Report>(`/clients/${clientId}/reports/generate`, { report_type: reportType }).then(r => r.data),
};
