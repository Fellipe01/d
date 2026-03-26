import { supabase } from '../../config/supabase';

export interface Campaign {
  id: number;
  client_id: number;
  external_id: string | null;
  name: string;
  platform: string;
  status: string;
  objective: string | null;
  created_at: string;
}

export interface AdSet {
  id: number;
  campaign_id: number;
  external_id: string | null;
  name: string;
  targeting: Record<string, unknown>;
  daily_budget: number | null;
  status: string;
}

export interface Creative {
  id: number;
  ad_set_id: number;
  external_id: string | null;
  name: string;
  type: string;
  status: string;
  thumbnail_url: string | null;
  headline: string | null;
  body_text: string | null;
  cta: string | null;
  created_at: string;
}

// ── Campaigns ────────────────────────────────────────────────────────────────

export async function findCampaignsByClient(clientId: number, status?: string): Promise<Campaign[]> {
  let query = supabase
    .from('campaigns')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Campaign[];
}

export async function findCampaignById(id: number): Promise<Campaign | undefined> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Campaign | undefined ?? undefined;
}

export async function createCampaign(data: Omit<Campaign, 'id' | 'created_at'>): Promise<Campaign> {
  const { data: row, error } = await supabase
    .from('campaigns')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return row as Campaign;
}

// ── Ad Sets ───────────────────────────────────────────────────────────────────

function parseAdSet(row: Record<string, unknown>): AdSet {
  return {
    ...row as unknown as AdSet,
    targeting: typeof row.targeting === 'string'
      ? JSON.parse(row.targeting || '{}')
      : (row.targeting as Record<string, unknown> ?? {}),
  };
}

export async function findAdSetsByCampaign(campaignId: number): Promise<AdSet[]> {
  const { data, error } = await supabase
    .from('ad_sets')
    .select('*')
    .eq('campaign_id', campaignId);
  if (error) throw error;
  return (data || []).map(r => parseAdSet(r as Record<string, unknown>));
}

export async function findAdSetById(id: number): Promise<AdSet | undefined> {
  const { data, error } = await supabase
    .from('ad_sets')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parseAdSet(data as Record<string, unknown>) : undefined;
}

export async function createAdSet(data: Omit<AdSet, 'id'>): Promise<AdSet> {
  const { data: row, error } = await supabase
    .from('ad_sets')
    .insert({ ...data, targeting: JSON.stringify(data.targeting) })
    .select()
    .single();
  if (error) throw error;
  return parseAdSet(row as Record<string, unknown>);
}

// ── Creatives ─────────────────────────────────────────────────────────────────

export async function findCreativesByAdSet(adSetId: number): Promise<Creative[]> {
  const { data, error } = await supabase
    .from('creatives')
    .select('*')
    .eq('ad_set_id', adSetId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Creative[];
}

export async function findCreativeById(id: number): Promise<Creative | undefined> {
  const { data, error } = await supabase
    .from('creatives')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Creative | undefined ?? undefined;
}

export async function findCreativesByClient(clientId: number): Promise<Creative[]> {
  // Get all campaign IDs for the client first
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id')
    .eq('client_id', clientId);
  if (campErr) throw campErr;

  const campaignIds = (campaigns || []).map((c: { id: number }) => c.id);
  if (!campaignIds.length) return [];

  // Get all ad set IDs for those campaigns
  const { data: adSets, error: adsErr } = await supabase
    .from('ad_sets')
    .select('id')
    .in('campaign_id', campaignIds);
  if (adsErr) throw adsErr;

  const adSetIds = (adSets || []).map((a: { id: number }) => a.id);
  if (!adSetIds.length) return [];

  const { data, error } = await supabase
    .from('creatives')
    .select('*')
    .in('ad_set_id', adSetIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Creative[];
}

export async function createCreative(data: Omit<Creative, 'id' | 'created_at'>): Promise<Creative> {
  const { data: row, error } = await supabase
    .from('creatives')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return row as Creative;
}
