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
  // Fetch open/won deals, then lost deals separately — RD Station API does not
  // return lost (win=false) deals in the default listing without explicit filter.
  const [open, lost] = await Promise.all([
    rdGetDealsPage(token, since, until, {}),
    rdGetDealsPage(token, since, until, { win: 'false' }),
  ]);

  // Merge, deduplicate by id
  const byId = new Map<string, RdDeal>();
  for (const d of [...open, ...lost]) byId.set(d.id, d);

  console.log(`[RD] Raw fetch: ${open.length} open/won + ${lost.length} lost = ${byId.size} unique deals`);
  return Array.from(byId.values());
}

async function rdGetDealsPage(token: string, since: string, until: string, extra: Record<string, string>): Promise<RdDeal[]> {
  const results: RdDeal[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const data = await rdGet('/deals', token, {
      page: String(page),
      limit: String(pageSize),
      'created_at[gte]': since,
      'created_at[lte]': until,
      ...extra,
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

  // Extract prefixes from configured stage names, e.g. "(MQL) Solicitação" → "mql"
  // Used as fallback when API order is unavailable
  const mqlPrefix  = extractPrefix(cfg.rd_mql_stage);
  const sqlPrefix  = extractPrefix(cfg.rd_sql_stage);
  const vendaPrefix = extractPrefix(cfg.rd_venda_stage);
  // Hierarchy order of known prefixes
  const prefixRank: Record<string, number> = {
    lead: 0, mql: 1, sql: 2,
    sell: 3, win: 3, fechou: 3, venda: 3, ganho: 3, contrato: 3,
  };
  console.log(`[RD] Prefix fallback — MQL:"${mqlPrefix}" SQL:"${sqlPrefix}" Venda:"${vendaPrefix}"`);

  // Fetch all deals created in the last 90 days
  const allDeals = await rdGetAllDeals(cfg.rdstation_token, since, until);

  // Filter deals where the "Fonte" field value matches the configured rd_fonte_field value
  // The field is always named "Fonte" in RD Station; rd_fonte_field stores the expected VALUE (e.g. "Meta/Ads")
  let deals = allDeals;
  if (cfg.rd_fonte_field) {
    const expectedFonte = cfg.rd_fonte_field.toLowerCase();
    deals = allDeals.filter(d => {
      const fonteValue = getCustomField(d, 'Fonte').toLowerCase();
      return fonteValue.includes(expectedFonte) || expectedFonte.includes(fonteValue) && fonteValue !== '';
    });
    if (deals.length === 0) {
      console.warn(`[RD] "Fonte" = "${cfg.rd_fonte_field}" matched 0 deals — using all deals as fallback`);
      deals = allDeals;
    }
  }

  console.log(`[RD] Fetched ${allDeals.length} deals, ${deals.length} with Fonte="${cfg.rd_fonte_field}" for client ${clientId}`);

  if (!deals.length) return;

  // Fetch campaigns and creatives for this client to match by name
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, external_id')
    .eq('client_id', clientId);

  const campaignList = campaigns ?? [];

  // Fetch all creatives for matching by rd_criativo_field
  const { data: creatives } = await supabase
    .from('creatives')
    .select('id, name, ad_set_id')
    .in('ad_set_id',
      campaignList.length
        ? (await supabase.from('ad_sets').select('id').in('campaign_id', campaignList.map(c => c.id))).data?.map((a: { id: number }) => a.id) ?? []
        : []
    );
  const creativeList = creatives ?? [];

  // ── Aggregate deals by date + campaign ────────────────────────────────────
  type DayAgg = {
    client_id: number;
    campaign_id: number | null;
    creative_id: number | null;
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
    const creativeName = getCustomField(deal, cfg.rd_criativo_field);
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

    // Match creative by name — strip leading "ADxxx - " prefix before comparing
    // so "AD002 - SOFREU ACIDENTE" matches "AD009 - SOFREU ACIDENTE" in Meta
    let creativeId: number | null = null;
    if (creativeName) {
      const stripPrefix = (s: string) => s.replace(/^AD\d+\s*[-–]\s*/i, '').toLowerCase().trim();
      const needleStripped = stripPrefix(creativeName);
      const match = creativeList.find(c => {
        const haystackStripped = stripPrefix(c.name);
        return c.name.toLowerCase() === creativeName.toLowerCase() // exact match first
          || c.name.toLowerCase().includes(creativeName.toLowerCase())
          || creativeName.toLowerCase().includes(c.name.toLowerCase())
          || (needleStripped.length > 3 && (haystackStripped.includes(needleStripped) || needleStripped.includes(haystackStripped)));
      });
      creativeId = match?.id ?? null;
      if (!match) {
        console.warn(`[RD] Deal "${deal.name}" — criativo "${creativeName}" não encontrou match (campo: ${cfg.rd_criativo_field})`);
      }
    }

    const key = `${date}|${campaignId ?? 'null'}|${creativeId ?? 'null'}`;

    if (!aggMap.has(key)) {
      aggMap.set(key, { client_id: clientId, campaign_id: campaignId, creative_id: creativeId, date, leads: 0, mql: 0, sql_count: 0, sales: 0, revenue: 0 });
    }

    const agg = aggMap.get(key)!;
    agg.leads++;

    // Log todos os deals perdidos para diagnóstico
    if (deal.win === false) {
      console.log(`[RD] Perdido: "${deal.name}" | estágio: "${stageName}" | pos: ${dealPos}`);
    }

    // Determine deal's funnel level using position map (primary) or prefix hierarchy (fallback)
    let dealLevel = dealFunnelLevel(stageName, dealPos, prefixRank);
    const mqlLevel  = configuredLevel(mqlPos, mqlPrefix, prefixRank);
    const sqlLevel  = configuredLevel(sqlPos, sqlPrefix, prefixRank);
    const vendaLevel = configuredLevel(vendaPos, vendaPrefix, prefixRank);

    // For lost deals (win=false) whose current stage is a terminal "Perdido/Perdida" stage
    // (not found in the order map → dealPos=-1), attempt to infer the highest funnel level
    // reached by matching the stage name against the configured MQL/SQL/Venda stage names.
    // This happens because RD Station moves lost deals to a terminal pipeline stage that
    // has no position in the Kanban order.
    if (deal.win === false && dealPos === -1 && stageName) {
      const sl = stageName.toLowerCase();
      const inferredLevel = inferLostDealLevel(
        sl, cfg.rd_mql_stage, cfg.rd_sql_stage, cfg.rd_venda_stage,
        mqlPos, sqlPos, vendaPos, mqlPrefix, sqlPrefix, vendaPrefix, prefixRank,
      );
      if (inferredLevel !== null) {
        dealLevel = inferredLevel;
        console.log(`[RD] Lost deal "${deal.name}" stage="${stageName}" → inferred level ${dealLevel}`);
      } else {
        // Could not infer level — deal may have been lost before reaching MQL
        console.log(`[RD] Lost deal "${deal.name}" stage="${stageName}" — level unknown, counting as Lead only`);
      }
    }

    if (mqlLevel !== null && (dealLevel >= mqlLevel || deal.win)) {
      agg.mql++;
    }
    if (sqlLevel !== null && (dealLevel >= sqlLevel || deal.win)) {
      agg.sql_count++;
    }
    if ((vendaLevel !== null && dealLevel >= vendaLevel) || deal.win === true) {
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

  // Delete ALL existing rows for this client before inserting fresh data.
  // Using a date range caused off-by-one conflicts when deal dates fell just
  // outside the window but rows from previous syncs still existed.
  const { error: delError } = await supabase
    .from('crm_metrics')
    .delete()
    .eq('client_id', clientId);
  if (delError) throw delError;

  // Insert fresh rows in batches
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('crm_metrics').insert(batch);
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

// Extracts the prefix keyword from a stage name like "(MQL) Solicitação" → "mql"
function extractPrefix(stageName: string | null): string {
  if (!stageName) return '';
  const match = stageName.match(/\(([^)]+)\)/);
  return match ? match[1].toLowerCase() : stageName.split(' ')[0].toLowerCase();
}

// Returns the funnel level of a deal's current stage.
// Uses position map if available, otherwise falls back to prefix rank.
function dealFunnelLevel(stageName: string, positionMapValue: number, prefixRank: Record<string, number>): number {
  if (positionMapValue >= 0) return positionMapValue;
  const prefix = extractPrefix(stageName);
  return prefixRank[prefix] ?? 0;
}

// Returns the funnel level for a configured stage (MQL/SQL/Venda).
function configuredLevel(pos: number | null, prefix: string, prefixRank: Record<string, number>): number | null {
  if (pos !== null) return pos;
  if (!prefix) return null;
  return prefixRank[prefix] ?? null;
}

// Infers the funnel level of a lost deal whose current stage is a terminal "Perdido" stage
// (not found in the order map). Checks if the stage name contains any part of the configured
// MQL/SQL/Venda stage names, then falls back to prefix rank.
function inferLostDealLevel(
  stageLower: string,
  mqlStage: string | null, sqlStage: string | null, vendaStage: string | null,
  mqlPos: number | null, sqlPos: number | null, vendaPos: number | null,
  mqlPrefix: string, sqlPrefix: string, vendaPrefix: string,
  prefixRank: Record<string, number>,
): number | null {
  // Check if the stage name matches any configured stage (partial, case-insensitive)
  const matches = (configured: string | null) => {
    if (!configured) return false;
    const cl = configured.toLowerCase();
    return stageLower.includes(cl) || cl.includes(stageLower);
  };
  if (vendaStage && matches(vendaStage)) return configuredLevel(vendaPos, vendaPrefix, prefixRank);
  if (sqlStage   && matches(sqlStage))   return configuredLevel(sqlPos,   sqlPrefix,   prefixRank);
  if (mqlStage   && matches(mqlStage))   return configuredLevel(mqlPos,   mqlPrefix,   prefixRank);
  // Try prefix rank on the terminal stage name itself
  const prefix = extractPrefix(stageLower);
  const rank = prefixRank[prefix];
  return rank !== undefined ? rank : null;
}

function getCustomField(deal: RdDeal, fieldLabel: string | null): string {
  if (!fieldLabel || !deal.deal_custom_fields?.length) return '';
  const field = deal.deal_custom_fields.find(
    f => f.custom_field?.label?.toLowerCase() === fieldLabel.toLowerCase()
  );
  return field?.value ?? '';
}
