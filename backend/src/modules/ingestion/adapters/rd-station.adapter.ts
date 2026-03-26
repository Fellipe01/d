import { supabase } from '../../../config/supabase';
import { toISODate, subDays } from '../../../shared/utils/date';

const RD_BASE = 'https://crm.rdstation.com/api/v1';

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function rdGet(path: string, token: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${RD_BASE}${path}`);
  url.searchParams.set('token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  const json = await res.json() as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(`RD Station API error ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function rdGetAllDeals(token: string, since: string, until: string): Promise<RdDeal[]> {
  const results: RdDeal[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const data = await rdGet('/deals', token, {
      page: String(page),
      limit: String(pageSize),
      'created_at[gte]': since,
      'created_at[lte]': until,
    }) as { deals: RdDeal[]; total?: number };

    const deals = data.deals ?? [];
    results.push(...deals);

    if (deals.length < pageSize) break;
    page++;
  }

  return results;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RdDeal {
  id: string;
  name: string;
  created_at: string;
  closed_at?: string;
  win?: boolean;
  deal_stage?: { name: string };
  deal_custom_fields?: Array<{ custom_field: { label: string }; value: string }>;
  amount_montly?: number;
  amount?: number;
}

interface ClientConfig {
  id: number;
  rdstation_token: string;
  rd_fonte_field: string | null;
  rd_campanha_field: string | null;
  rd_criativo_field: string | null;
  rd_mql_stage: string | null;
  rd_sql_stage: string | null;
  rd_venda_stage: string | null;
}

// ── Main sync function ────────────────────────────────────────────────────────

const syncInProgress = new Set<number>();

export async function syncRdStationReal(clientId: number): Promise<void> {
  if (syncInProgress.has(clientId)) {
    console.log(`[RD] Client ${clientId} sync already in progress, skipping`);
    return;
  }
  syncInProgress.add(clientId);
  try {
    await _syncRdStationReal(clientId);
  } finally {
    syncInProgress.delete(clientId);
  }
}

async function _syncRdStationReal(clientId: number): Promise<void> {
  // Fetch client config
  const { data: client } = await supabase
    .from('clients')
    .select('id, rdstation_token, rd_fonte_field, rd_campanha_field, rd_criativo_field, rd_mql_stage, rd_sql_stage, rd_venda_stage')
    .eq('id', clientId)
    .maybeSingle();

  if (!client?.rdstation_token) {
    throw new Error(`Client ${clientId} has no rdstation_token configured`);
  }

  const cfg = client as ClientConfig;
  console.log(`[RD] Syncing client ${clientId} — stages: MQL="${cfg.rd_mql_stage}" SQL="${cfg.rd_sql_stage}" Venda="${cfg.rd_venda_stage}"`);

  // Date range: last 90 days
  const today = new Date();
  const since = toISODate(subDays(today, 89));
  const until = toISODate(today);

  // Fetch all deals created in the last 90 days
  const deals = await rdGetAllDeals(cfg.rdstation_token, since, until);
  console.log(`[RD] Fetched ${deals.length} deals for client ${clientId}`);

  if (!deals.length) return;

  // Fetch campaigns for this client to match by name
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, external_id')
    .eq('client_id', clientId);

  const campaignList = campaigns ?? [];

  // ── Aggregate deals by date + campaign ────────────────────────────────────
  // Key: "date|campaignId"
  type DayAgg = {
    client_id: number;
    campaign_id: number | null;
    date: string;
    leads: number;
    mql: number;
    sql_count: number;
    sales: number;
    revenue: number;
  };

  const aggMap = new Map<string, DayAgg>();

  for (const deal of deals) {
    const date = toISODate(new Date(deal.created_at));

    // Extract custom field values
    const campaignName = getCustomField(deal, cfg.rd_campanha_field);
    const stageName = deal.deal_stage?.name ?? '';

    // Match campaign by name (fuzzy: contains)
    let campaignId: number | null = null;
    if (campaignName) {
      const match = campaignList.find(c =>
        c.name.toLowerCase().includes(campaignName.toLowerCase()) ||
        campaignName.toLowerCase().includes(c.name.toLowerCase())
      );
      campaignId = match?.id ?? null;
    }

    const key = `${date}|${campaignId ?? 'null'}`;

    if (!aggMap.has(key)) {
      aggMap.set(key, {
        client_id: clientId,
        campaign_id: campaignId,
        date,
        leads: 0,
        mql: 0,
        sql_count: 0,
        sales: 0,
        revenue: 0,
      });
    }

    const agg = aggMap.get(key)!;

    // Every deal created = 1 lead
    agg.leads++;

    // Classify by stage
    if (cfg.rd_mql_stage && stageMatches(stageName, cfg.rd_mql_stage)) {
      agg.mql++;
    }
    if (cfg.rd_sql_stage && stageMatches(stageName, cfg.rd_sql_stage)) {
      agg.sql_count++;
    }
    if (cfg.rd_venda_stage && stageMatches(stageName, cfg.rd_venda_stage)) {
      agg.sales++;
      agg.revenue += deal.amount ?? deal.amount_montly ?? 0;
    }
    // If deal is marked as won, count as sale regardless of stage name
    if (deal.win === true) {
      if (agg.sales === 0) agg.sales++;
      agg.revenue += deal.amount ?? deal.amount_montly ?? 0;
    }
  }

  const rows = Array.from(aggMap.values()).map(agg => ({
    ...agg,
    cost_per_mql: 0,
    cost_per_sql: 0,
    cost_per_sale: 0,
    roas: 0,
    lead_to_mql_rate: agg.leads > 0 ? (agg.mql / agg.leads) * 100 : 0,
    mql_to_sql_rate: agg.mql > 0 ? (agg.sql_count / agg.mql) * 100 : 0,
    sql_to_sale_rate: agg.sql_count > 0 ? (agg.sales / agg.sql_count) * 100 : 0,
  }));

  // Upsert in batches
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('crm_metrics')
      .upsert(batch, { onConflict: 'client_id,campaign_id,creative_id,date', ignoreDuplicates: false });
    if (error) throw error;
  }

  console.log(`[RD] Upserted ${rows.length} daily rows for client ${clientId}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCustomField(deal: RdDeal, fieldLabel: string | null): string {
  if (!fieldLabel || !deal.deal_custom_fields?.length) return '';
  const field = deal.deal_custom_fields.find(
    f => f.custom_field?.label?.toLowerCase() === fieldLabel.toLowerCase()
  );
  return field?.value ?? '';
}

function stageMatches(currentStage: string, configuredStage: string): boolean {
  return currentStage.toLowerCase().includes(configuredStage.toLowerCase()) ||
    configuredStage.toLowerCase().includes(currentStage.toLowerCase());
}
