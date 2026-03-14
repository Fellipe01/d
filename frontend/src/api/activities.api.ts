import { api } from './client';

export interface Activity {
  id: number;
  client_id: number;
  activity_type: string;
  description: string;
  executed_at: string;
  executed_by: string;
  campaign_id: number | null;
  creative_id: number | null;
}

export const activitiesApi = {
  list: (clientId: number, limit = 50) =>
    api.get<Activity[]>(`/clients/${clientId}/activities`, { params: { limit } }).then(r => r.data),
  create: (clientId: number, data: Partial<Activity>) =>
    api.post<Activity>(`/clients/${clientId}/activities`, data).then(r => r.data),
};
