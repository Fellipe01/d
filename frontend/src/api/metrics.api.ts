import { api } from './client';

export interface Metrics {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  cpl: number;
  messages: number;
  cost_per_message: number;
  followers: number;
  cost_per_follower: number;
  video_views: number;
  cost_per_video_view: number;
}

export interface KpiResult {
  kpi_name: string;
  target: number;
  actual: number;
  delta_pct: number;
  raw_score: number;
  weighted_score: number;
  status: 'on_target' | 'warning' | 'breach';
}

export interface MetricsSummary {
  metrics: Metrics;
  kpi_results: KpiResult[];
  period: { start: string; end: string };
}

export const metricsApi = {
  getClientMetrics: (clientId: number, start?: string, end?: string) =>
    api.get<Metrics>(`/clients/${clientId}/metrics`, { params: { start, end } }).then(r => r.data),
  getClientSummary: (clientId: number, start?: string, end?: string) =>
    api.get<MetricsSummary>(`/clients/${clientId}/metrics/summary`, { params: { start, end } }).then(r => r.data),
  getTimeseries: (clientId: number, start?: string, end?: string) =>
    api.get(`/clients/${clientId}/metrics/timeseries`, { params: { start, end } }).then(r => r.data),
  getTopCreatives: (clientId: number, start?: string, end?: string, limit = 10) =>
    api.get(`/clients/${clientId}/metrics/top-creatives`, { params: { start, end, limit } }).then(r => r.data),
  getCampaignMetrics: (campaignId: number, start?: string, end?: string) =>
    api.get<Metrics>(`/campaigns/${campaignId}/metrics`, { params: { start, end } }).then(r => r.data),
  getCreativeMetrics: (creativeId: number, start?: string, end?: string) =>
    api.get<Metrics>(`/creatives/${creativeId}/metrics`, { params: { start, end } }).then(r => r.data),
  getCreativeTimeseries: (creativeId: number, start?: string, end?: string) =>
    api.get(`/creatives/${creativeId}/metrics/timeseries`, { params: { start, end } }).then(r => r.data),
};
