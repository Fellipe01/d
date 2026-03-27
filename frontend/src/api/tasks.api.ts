import { api } from './client';

export interface Task {
  id: number;
  client_id: number;
  task_type: string;
  custom_type: string | null;
  title: string;
  description: string | null;
  due_date: string;
  assigned_to: string;
  status: 'pending' | 'done' | 'cancelled';
  campaign_id: number | null;
  created_at: string;
  completed_at: string | null;
}

export const tasksApi = {
  list: (clientId: number, status?: string) =>
    api.get<Task[]>(`/clients/${clientId}/tasks`, { params: status ? { status } : {} }).then(r => r.data),
  create: (clientId: number, data: Partial<Task>) =>
    api.post<Task>(`/clients/${clientId}/tasks`, data).then(r => r.data),
  complete: (id: number) =>
    api.patch<Task>(`/tasks/${id}/complete`).then(r => r.data),
  cancel: (id: number) =>
    api.patch<Task>(`/tasks/${id}/cancel`).then(r => r.data),
  remove: (id: number) =>
    api.delete(`/tasks/${id}`),
};
