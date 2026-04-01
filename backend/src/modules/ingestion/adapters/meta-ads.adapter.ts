import { env } from '../../../config/env';
import { supabase } from '../../../config/supabase';
import { insertMetrics } from '../../metrics/metrics.repository';
import { createCampaign, createAdSet, createCreative } from '../../campaigns/campaigns.repository';
import { toISODate, subDays } from '../../../shared/utils/date';

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function graphGet(path: string, params: Record<string, string> = {}, retries = 4): Promise<unknown> {
  const token = env.META_ACCESS_TOKEN;
  if (!token) throw new Error('META_ACCESS_TOKEN not configured');

  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString());
    const json = await res.json() as Record<string, unknown>;

    if (res.ok && !json.error) return json;

    const err = json.error as Record<string, unknown> | undefined;
    const code = err?.code as number | undefined;
    const isRateLimit = code === 4 || code === 17 || code === 32 || code === 613;

    if (isRateLimit && attempt < retries) {
      const wait = Math.pow(2, attempt + 1) * 5000; // 10s, 20s, 40s, 80s
      console.warn(`[Meta] Rate limit (code ${code}), waiting ${wait / 1000}s before retry ${attempt + 1}/${retries}...`);
      await sleep(wait);
      continue;
    }

    throw new Error(`Meta API error: ${err?.message ?? res.statusText}`);
  }
  throw new Error('Meta API: max retries exceeded');
}

// Paginate through all edges automatically
async function graphGetAll(path: string, params: Record<string, string> = {}): Promise<unknown[]> {
  const results: unknown[] = [];
  let nextUrl: string | null = null;

  const first = await graphGet(path, params) as { data: unknown[]; paging?: { next?: string } };
  results.push(...first.data);
  nextUrl = first.paging?.next ?? null;

  while (nextUrl) {
    await sleep(300); // avoid burst on pagination
    const res = await fetch(nextUrl);
    const json = await res.json() as { data: unknown[]; paging?: { next?: string } };
    results.push(...json.data);
    nextUrl = json.paging?.next ?? null;
  }

  return results;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
}

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  targeting?: Record<string, unknown>;
}

interface MetaAd {
  id: string;
  name: string;
  status: string;
  creative?: {
    id: string;
    name?: string;
    thumbnail_url?: string;
    title?: string;
    body?: string;
    call_to_action_type?: string;
  };
}

interface MetaInsight {
  date_start: string;
  spend: string;
  impressions: string;
  reach: string;
  frequency: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  actions?: Array<{ action_type: string; value: string }>;
  video_p25_watched_actions?: Array<{ value: string }>;
  video_avg_time_watched_actions?: Array<{ value: string }>;
  // results can be a plain number string OR an array of {action_type, value}
  results?: string | Array<{ action_type: string; value: string }>;
}

function getAction(actions: MetaInsight['actions'], type: string): number {
  return Number(actions?.find(a => a.action_type === type)?.value ?? 0);
}

// ── Main sync function ────────────────────────────────────────────────────────

const syncInProgress = new Set<number>();

// Global queue: only 1 Meta sync runs at a time to avoid shared rate limit exhaustion
let metaQueue: Promise<void> = Promise.resolve();

export async function syncMetaAdsReal(clientId: number): Promise<void> {
  if (syncInProgress.has(clientId)) {
    console.log(`[Meta] Client ${clientId} sync already in progress, skipping`);
    return;
  }
  syncInProgress.add(clientId);

  // Chain onto global queue so concurrent requests run sequentially
  metaQueue = metaQueue.then(async () => {
    try {
      await _syncMetaAdsReal(clientId);
    } finally {
      syncInProgress.delete(clientId);
    }
  });

  return metaQueue;
}

async function _syncMetaAdsReal(clientId: number): Promise<void> {
  // Fetch client to get ad_account
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, ad_account')
    .eq('id', clientId)
    .maybeSingle();

  if (!client?.ad_account) {
    throw new Error(`Client ${clientId} has no ad_account configured`);
  }

  const accountId = String(client.ad_account).replace(/^act_/, '');
  const adAccountId = `act_${accountId}`;
  console.log(`[Meta] Syncing client ${clientId} (${client.name}) — account ${adAccountId}`);

  // Date range: last 90 days
  const today = new Date();
  const since = toISODate(subDays(today, 89));
  const until = toISODate(today);

  // ── 1. Fetch only ACTIVE campaigns — drastically reduces API calls for large accounts
  const metaCampaigns = await graphGetAll(`/${adAccountId}/campaigns`, {
    fields: 'id,name,status,objective',
    effective_status: '["ACTIVE"]',
    limit: '100',
  }) as MetaCampaign[];

  console.log(`[Meta] Found ${metaCampaigns.length} active campaigns`);

  for (const mc of metaCampaigns) {
    // Upsert campaign
    const { data: existingCamp } = await supabase
      .from('campaigns')
      .select('id')
      .eq('client_id', clientId)
      .eq('external_id', mc.id)
      .maybeSingle();

    let campId: number;

    if (existingCamp) {
      await supabase.from('campaigns').update({
        name: mc.name,
        status: normalizeStatus(mc.status),
        objective: mc.objective,
      }).eq('id', existingCamp.id);
      campId = existingCamp.id;
    } else {
      const camp = await createCampaign({
        client_id: clientId,
        external_id: mc.id,
        name: mc.name,
        platform: 'meta',
        status: normalizeStatus(mc.status),
        objective: mc.objective,
      });
      campId = camp.id;
    }

    // ── 2. Fetch campaign insights (only active campaigns) ─────────────────
    const isVP = mc.name.toUpperCase().includes('[VP]');
    if (mc.status === 'ACTIVE') {
      await syncInsights('campaign', campId, mc.id, since, until, isVP);
    }

    // ── 3. Fetch ad sets ────────────────────────────────────────────────────
    const metaAdSets = await graphGetAll(`/${mc.id}/adsets`, {
      fields: 'id,name,status,daily_budget,targeting',
      limit: '100',
    }) as MetaAdSet[];

    for (const mas of metaAdSets) {
      const { data: existingAdSet } = await supabase
        .from('ad_sets')
        .select('id')
        .eq('campaign_id', campId)
        .eq('external_id', mas.id)
        .maybeSingle();

      let adSetId: number;

      if (existingAdSet) {
        await supabase.from('ad_sets').update({
          name: mas.name,
          status: normalizeStatus(mas.status),
          daily_budget: mas.daily_budget ? Number(mas.daily_budget) / 100 : null,
        }).eq('id', existingAdSet.id);
        adSetId = existingAdSet.id;
      } else {
        const adSet = await createAdSet({
          campaign_id: campId,
          external_id: mas.id,
          name: mas.name,
          status: normalizeStatus(mas.status),
          daily_budget: mas.daily_budget ? Number(mas.daily_budget) / 100 : null,
          targeting: (mas.targeting as Record<string, unknown>) ?? {},
        });
        adSetId = adSet.id;
      }

      // ── 4. Fetch ads (creatives) ──────────────────────────────────────────
      const metaAds = await graphGetAll(`/${mas.id}/ads`, {
        fields: 'id,name,status,creative{id,name,thumbnail_url,title,body,call_to_action_type}',
        limit: '100',
      }) as MetaAd[];

      for (const ma of metaAds) {
        const cr = ma.creative;
        const { data: existingCreative } = await supabase
          .from('creatives')
          .select('id')
          .eq('ad_set_id', adSetId)
          .eq('external_id', ma.id)
          .maybeSingle();

        let creativeId: number;

        if (existingCreative) {
          await supabase.from('creatives').update({ status: normalizeStatus(ma.status) }).eq('id', existingCreative.id);
          creativeId = existingCreative.id;
        } else {
          const creative = await createCreative({
            ad_set_id: adSetId,
            external_id: ma.id,
            name: ma.name,
            type: 'image',
            thumbnail_url: cr?.thumbnail_url ?? null,
            headline: cr?.title ?? null,
            body_text: cr?.body ?? null,
            cta: cr?.call_to_action_type ?? null,
            status: normalizeStatus(ma.status),
          });
          creativeId = creative.id;
        }

        // Sync creative-level insights (only active ads)
        if (ma.status === 'ACTIVE') {
          await syncInsights('creative', creativeId, ma.id, since, until, isVP);
        }
      }
      await sleep(200); // small pause between ad sets
    }
    await sleep(500); // small pause between campaigns
  }

  console.log(`[Meta] Sync complete for client ${clientId}`);
}

// ── Insights sync ─────────────────────────────────────────────────────────────

async function syncInsights(
  entityType: 'campaign' | 'creative',
  entityId: number,
  metaId: string,
  since: string,
  until: string,
  isVP = false,
): Promise<void> {
  const baseFields = [
    'date_start', 'spend', 'impressions', 'reach', 'frequency',
    'clicks', 'ctr', 'cpc', 'cpm', 'actions',
    'video_p25_watched_actions',
  ];
  if (isVP) baseFields.push('results');
  const fields = baseFields.join(',');

  let insights: MetaInsight[];
  try {
    insights = await graphGetAll(`/${metaId}/insights`, {
      fields,
      time_increment: '1',
      time_range: JSON.stringify({ since, until }),
      limit: '100',
    }) as MetaInsight[];
  } catch (err) {
    console.warn(`[Meta] Could not fetch insights for ${entityType} ${metaId}:`, err);
    return;
  }

  if (!insights.length) return;

  const rows = insights.map(ins => {
    const spend = Number(ins.spend ?? 0);
    const impressions = Number(ins.impressions ?? 0);
    const clicks = Number(ins.clicks ?? 0);
    const leads = getAction(ins.actions, 'lead') ||
      getAction(ins.actions, 'onsite_conversion.lead_grouped');
    const messages = getAction(ins.actions, 'onsite_conversion.messaging_conversation_started_7d') ||
      getAction(ins.actions, 'onsite_conversion.total_messaging_connection');
    const followers = getAction(ins.actions, 'like');
    // Use standard 3-second video views (shown in Meta Ads Manager) as primary.
    const videoViews =
      getAction(ins.actions, 'video_view') ||
      getAction(ins.actions, 'onsite_conversion.video_view') ||
      Number(ins.video_p25_watched_actions?.[0]?.value ?? 0);
    // Profile visits — for VP campaigns, use `results` field (primary campaign result)
    // results can be: a plain string "449", or an array [{action_type, value}], or undefined
    let profileVisits = 0;
    if (isVP) {
      const r = ins.results;
      if (Array.isArray(r) && r.length > 0) {
        // Log raw object to see actual property names
        console.log(`[Meta VP] ${ins.date_start} results raw:`, JSON.stringify(r));
        // Meta returns {indicator, value} not {action_type, value}
        const item = r[0] as Record<string, unknown>;
        profileVisits = Number(item.value ?? 0);
      } else if (typeof r === 'string' && r) {
        profileVisits = Number(r);
        console.log(`[Meta VP] ${ins.date_start} results(scalar): ${r}`);
      } else {
        console.log(`[Meta VP] ${ins.date_start} results empty/undefined`);
      }
      if (!profileVisits) {
        profileVisits = getAction(ins.actions, 'onsite_conversion.profile_visit') ||
          getAction(ins.actions, 'ig_profile_visit');
      }
    } else {
      profileVisits = getAction(ins.actions, 'onsite_conversion.profile_visit') ||
        getAction(ins.actions, 'ig_profile_visit');
    }

    return {
      entity_type: entityType,
      entity_id: entityId,
      date: ins.date_start,
      spend,
      impressions,
      reach: Number(ins.reach ?? 0),
      frequency: Number(ins.frequency ?? 0),
      clicks,
      ctr: Number(ins.ctr ?? 0),
      cpc: Number(ins.cpc ?? 0),
      cpm: Number(ins.cpm ?? 0),
      leads,
      cpl: leads > 0 ? spend / leads : 0,
      messages,
      cost_per_message: messages > 0 ? spend / messages : 0,
      followers,
      cost_per_follower: followers > 0 ? spend / followers : 0,
      video_views: videoViews,
      hook_rate: 0,
      profile_visits: profileVisits,
    };
  });

  // Upsert in batches
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    await insertMetrics(rows.slice(i, i + batchSize));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeStatus(s: string): 'active' | 'paused' | 'archived' {
  const lower = s.toLowerCase();
  if (lower === 'active') return 'active';
  if (lower === 'archived' || lower === 'deleted') return 'archived';
  return 'paused';
}
