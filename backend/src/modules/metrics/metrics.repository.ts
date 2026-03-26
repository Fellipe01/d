import { supabase } from '../../config/supabase';
import { calcCTR, calcCPM, calcCPC, calcCPL, calcFrequency } from '../../shared/utils/metrics-calculator';

export interface MetricsRow {
  entity_type: string;
  entity_id: number;
  date: string;
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
  hook_rate: number;
}

export interface AggregatedMetrics {
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
}

export async function insertMetrics(rows: MetricsRow[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase
    .from('metrics_daily')
    .upsert(rows, { onConflict: 'entity_type,entity_id,date' });
  if (error) throw error;
}

export async function getClientMetrics(clientId: number, start: string, end: string): Promise<AggregatedMetrics> {
  // Step 1: Get campaign IDs for the client
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id')
    .eq('client_id', clientId);
  if (campErr) throw campErr;

  const campaignIds = (campaigns || []).map((c: { id: number }) => Number(c.id)).filter(id => !isNaN(id) && id > 0);
  if (!campaignIds.length) return buildAggregated({});

  // Step 2: Get metrics for those campaign IDs
  const { data: rows, error } = await supabase
    .from('metrics_daily')
    .select('spend,impressions,reach,clicks,leads,messages,followers,video_views')
    .eq('entity_type', 'campaign')
    .in('entity_id', campaignIds)
    .gte('date', start)
    .lte('date', end);
  if (error) throw error;

  return buildAggregated(sumRows(rows || []));
}

export async function getCampaignMetrics(campaignId: number, start: string, end: string): Promise<AggregatedMetrics> {
  const { data: rows, error } = await supabase
    .from('metrics_daily')
    .select('spend,impressions,reach,clicks,leads,messages,followers,video_views')
    .eq('entity_type', 'campaign')
    .eq('entity_id', campaignId)
    .gte('date', start)
    .lte('date', end);
  if (error) throw error;
  return buildAggregated(sumRows(rows || []));
}

export async function getCreativeMetrics(creativeId: number, start: string, end: string): Promise<AggregatedMetrics> {
  const { data: rows, error } = await supabase
    .from('metrics_daily')
    .select('spend,impressions,reach,clicks,leads,messages,followers,video_views')
    .eq('entity_type', 'creative')
    .eq('entity_id', creativeId)
    .gte('date', start)
    .lte('date', end);
  if (error) throw error;
  return buildAggregated(sumRows(rows || []));
}

export async function getCreativeMetricsTimeseries(creativeId: number, start: string, end: string): Promise<MetricsRow[]> {
  const { data, error } = await supabase
    .from('metrics_daily')
    .select('*')
    .eq('entity_type', 'creative')
    .eq('entity_id', creativeId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data || []) as MetricsRow[];
}

export async function getClientMetricsTimeseries(clientId: number, start: string, end: string) {
  // Step 1: Get campaign IDs for the client
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id')
    .eq('client_id', clientId);
  if (campErr) throw campErr;

  const campaignIds = (campaigns || []).map((c: { id: number }) => Number(c.id)).filter(id => !isNaN(id) && id > 0);
  if (!campaignIds.length) return [];

  // Step 2: Get daily metrics
  const { data: rows, error } = await supabase
    .from('metrics_daily')
    .select('date,spend,impressions,clicks,leads')
    .eq('entity_type', 'campaign')
    .in('entity_id', campaignIds)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw error;

  // Step 3: Group by date in JS
  const byDate = new Map<string, { date: string; spend: number; impressions: number; clicks: number; leads: number }>();
  for (const row of (rows || []) as Array<{ date: string; spend: number; impressions: number; clicks: number; leads: number }>) {
    const existing = byDate.get(row.date);
    if (existing) {
      existing.spend += row.spend || 0;
      existing.impressions += row.impressions || 0;
      existing.clicks += row.clicks || 0;
      existing.leads += row.leads || 0;
    } else {
      byDate.set(row.date, { date: row.date, spend: row.spend || 0, impressions: row.impressions || 0, clicks: row.clicks || 0, leads: row.leads || 0 });
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTopCreativesByClient(clientId: number, start: string, end: string, limit = 10) {
  // Step 1: Get campaign IDs
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id')
    .eq('client_id', clientId);
  if (campErr) throw campErr;

  const campaignIds = (campaigns || []).map((c: { id: number }) => Number(c.id)).filter(id => !isNaN(id) && id > 0);
  if (!campaignIds.length) return [];

  // Step 2: Get ad set IDs
  const { data: adSets, error: adsErr } = await supabase
    .from('ad_sets')
    .select('id')
    .in('campaign_id', campaignIds);
  if (adsErr) throw adsErr;

  const adSetIds = (adSets || []).map((a: { id: number }) => Number(a.id)).filter(id => !isNaN(id) && id > 0);
  if (!adSetIds.length) return [];

  // Step 3: Get creative IDs for those ad sets
  const { data: creatives, error: crErr } = await supabase
    .from('creatives')
    .select('id,name,type,status,thumbnail_url')
    .in('ad_set_id', adSetIds);
  if (crErr) throw crErr;

  if (!creatives || !creatives.length) return [];

  const creativeIds = creatives.map((c: { id: number }) => c.id);

  // Step 4: Get metrics for those creatives
  const { data: metrics, error: metErr } = await supabase
    .from('metrics_daily')
    .select('entity_id,spend,impressions,clicks,leads,frequency,ctr,cpl')
    .eq('entity_type', 'creative')
    .in('entity_id', creativeIds)
    .gte('date', start)
    .lte('date', end);
  if (metErr) throw metErr;

  // Step 5: Aggregate by creative in JS
  type CreativeInfo = { id: number; name: string; type: string; status: string; thumbnail_url: string | null };
  type CreativeAgg = {
    id: number; name: string; type: string; status: string; thumbnail_url: string | null;
    spend: number; impressions: number; clicks: number; leads: number;
    freq_sum: number; ctr_sum: number; cpl_sum: number; count: number;
  };

  const creativeMap = new Map<number, CreativeInfo>(
    creatives.map((c: CreativeInfo) => [c.id, c])
  );
  const aggMap = new Map<number, CreativeAgg>();

  for (const m of (metrics || []) as Array<{ entity_id: number; spend: number; impressions: number; clicks: number; leads: number; frequency: number; ctr: number; cpl: number }>) {
    const existing = aggMap.get(m.entity_id);
    if (existing) {
      existing.spend += m.spend || 0;
      existing.impressions += m.impressions || 0;
      existing.clicks += m.clicks || 0;
      existing.leads += m.leads || 0;
      existing.freq_sum += m.frequency || 0;
      existing.ctr_sum += m.ctr || 0;
      existing.cpl_sum += m.cpl || 0;
      existing.count += 1;
    } else {
      const info = creativeMap.get(m.entity_id);
      if (!info) continue;
      aggMap.set(m.entity_id, {
        id: m.entity_id,
        name: info.name,
        type: info.type,
        status: info.status,
        thumbnail_url: info.thumbnail_url,
        spend: m.spend || 0,
        impressions: m.impressions || 0,
        clicks: m.clicks || 0,
        leads: m.leads || 0,
        freq_sum: m.frequency || 0,
        ctr_sum: m.ctr || 0,
        cpl_sum: m.cpl || 0,
        count: 1,
      });
    }
  }

  return Array.from(aggMap.values())
    .map(agg => ({
      id: agg.id,
      name: agg.name,
      type: agg.type,
      status: agg.status,
      thumbnail_url: agg.thumbnail_url,
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      leads: agg.leads,
      frequency: agg.count > 0 ? agg.freq_sum / agg.count : 0,
      ctr: agg.count > 0 ? agg.ctr_sum / agg.count : 0,
      cpl: agg.count > 0 ? agg.cpl_sum / agg.count : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sumRows(rows: Array<Record<string, number>>): Record<string, number> {
  return rows.reduce(
    (acc, row) => ({
      spend: acc.spend + (row.spend || 0),
      impressions: acc.impressions + (row.impressions || 0),
      reach: acc.reach + (row.reach || 0),
      clicks: acc.clicks + (row.clicks || 0),
      leads: acc.leads + (row.leads || 0),
      messages: acc.messages + (row.messages || 0),
      followers: acc.followers + (row.followers || 0),
      video_views: acc.video_views + (row.video_views || 0),
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, messages: 0, followers: 0, video_views: 0 }
  );
}

function buildAggregated(row: Record<string, number>): AggregatedMetrics {
  const spend = row?.spend || 0;
  const impressions = row?.impressions || 0;
  const reach = row?.reach || 0;
  const clicks = row?.clicks || 0;
  const leads = row?.leads || 0;
  const messages = row?.messages || 0;
  const followers = row?.followers || 0;
  const video_views = row?.video_views || 0;

  return {
    spend,
    impressions,
    reach,
    frequency: calcFrequency(impressions, reach),
    clicks,
    ctr: calcCTR(clicks, impressions),
    cpc: calcCPC(spend, clicks),
    cpm: calcCPM(spend, impressions),
    leads,
    cpl: calcCPL(spend, leads),
    messages,
    cost_per_message: messages > 0 ? spend / messages : 0,
    followers,
    cost_per_follower: followers > 0 ? spend / followers : 0,
    video_views,
  };
}
