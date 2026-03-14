import { api } from './client';

export const funnelApi = {
  get: (clientId: number, start?: string, end?: string) =>
    api.get(`/clients/${clientId}/funnel`, { params: { start, end } }).then(r => r.data),
  byCampaign: (clientId: number, start?: string, end?: string) =>
    api.get(`/clients/${clientId}/funnel/by-campaign`, { params: { start, end } }).then(r => r.data),
  byCreative: (clientId: number, start?: string, end?: string) =>
    api.get(`/clients/${clientId}/funnel/by-creative`, { params: { start, end } }).then(r => r.data),
};
