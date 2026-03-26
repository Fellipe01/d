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
  deal_stage?: { id: string; name: string };
  deal_custom_fields?: Array<{ custom_field: { label: string }; value: string }>;
  amount_montly?: number;
  amount?: number;
}

interface RdDealStage {
  id: string;
  name: string;
  step_order?: number;
  position?: number;
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

  // ── Fetch deal stages to determine Kanban order ───────────────────────────
  // A deal at position N has passed through ALL stages 1..N
  const stageOrderMap = await fetchStageOrderMap(cfg.rdstation_token);
  const mqlPos  = findStagePosition(stageOrderMap, cfg.rd_mql_stage);
  const sqlPos  = findStagePosition(stageOrderMap, cfg.rd_sql_stage);
  const vendaPos = findStagePosition(stageOrderMap, cfg.rd_venda_stage);
  console.log(`[RD] Stage positions — MQL:${mqlPos} SQL:${sqlPos} Venda:${vendaPos}`);

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
    const campaignName = getCustomField(deal, cfg.rd_campanha_field);
    const stageName = deal.deal_stage?.name ?? '';

    // Current position of this deal in the Kanban
    const dealPos = stageOrderMap.get(stageName.toLowerCase()) ?? -1;

    // Match campaign by name
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
      aggMap.set(key, { client_id: clientId, campaign_id: campaignId, date, leads: 0, mql: 0, sql_count: 0, sales: 0, revenue: 0 });
    }

    const agg = aggMap.get(key)!;
    agg.leads++;

    // Deal is MQL if it reached or passed the MQL stage
    if (mqlPos !== null && (dealPos >= mqlPos || deal.win)) {
      agg.mql++;
    }
    // Deal is SQL if it reached or passed the SQL stage
    if (sqlPos !== null && (dealPos >= sqlPos || deal.win)) {
      agg.sql_count++;
    }
    // Deal is Venda if it reached the Venda stage OR is marked as won
    if (vendaPos !== null && dealPos >= vendaPos) {
      agg.sales++;
      agg.revenue += deal.amount ?? deal.amount_montly ?? 0;
    } else if (deal.win === true) {
      agg.sales++;
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

// Returns a map of stage name (lowercase) → position (0-based order)
async function fetchStageOrderMap(token: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    // Try /deal_stages first
    const data = await rdGet('/deal_stages', token) as { deal_stages?: RdDealStage[] } | RdDealStage[];
    const stages: RdDealStage[] = Array.isArray(data) ? data : (data.deal_stages ?? []);

    // Sort by step_order or position
    stages.sort((a, b) => (a.step_order ?? a.position ?? 0) - (b.step_order ?? b.position ?? 0));
    stages.forEach((s, idx) => map.set(s.name.toLowerCase(), idx));
  } catch {
    // If endpoint not available, map will be empty and we fall back to name matching
    console.warn('[RD] Could not fetch deal stages order, falling back to name matching');
  }
  return map;
}

// Find the position of a configured stage name in the order map
function findStagePosition(map: Map<string, number>, configuredName: string | null): number | null {
  if (!configuredName) return null;
  const lower = configuredName.toLowerCase();
  // Exact match first
  if (map.has(lower)) return map.get(lower)!;
  // Partial match
  for (const [key, pos] of map.entries()) {
    if (key.includes(lower) || lower.includes(key)) return pos;
  }
  return null;
}

function getCustomField(deal: RdDeal, fieldLabel: string | null): string {
  if (!fieldLabel || !deal.deal_custom_fields?.length) return '';
  const field = deal.deal_custom_fields.find(
    f => f.custom_field?.label?.toLowerCase() === fieldLabel.toLowerCase()
  );
  return field?.value ?? '';
}
