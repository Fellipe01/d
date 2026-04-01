import { supabase } from '../../../config/supabase';
import { insertMetrics } from '../../metrics/metrics.repository';
import { createCampaign, createAdSet, createCreative } from '../../campaigns/campaigns.repository';
import { toISODate, subDays } from '../../../shared/utils/date';

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number): number {
  return Math.round(rand(min, max));
}

// In-memory lock to prevent concurrent seeding of the same client
const seedingInProgress = new Set<number>();

// Seed realistic 90-day historical data for a client
export async function seedMockData(clientId: number): Promise<void> {
  if (seedingInProgress.has(clientId)) {
    console.log(`[Mock] Client ${clientId} seed already in progress, skipping`);
    return;
  }
  seedingInProgress.add(clientId);

  try {
    await _seedMockData(clientId);
  } finally {
    seedingInProgress.delete(clientId);
  }
}

async function _seedMockData(clientId: number): Promise<void> {
  // Check if client already has data
  const { data: existing } = await supabase
    .from('campaigns')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle();

  if (existing) {
    console.log(`[Mock] Client ${clientId} already has data, skipping seed`);
    return;
  }

  // Fetch client monthly_budget to generate proportional data
  const { data: clientData } = await supabase
    .from('clients')
    .select('monthly_budget')
    .eq('id', clientId)
    .maybeSingle();

  const monthlyBudget: number = (clientData as { monthly_budget: number | null } | null)?.monthly_budget ?? 3000;
  const dailyBudgetTotal = monthlyBudget / 30;
  // 2 active campaigns, 1 paused — active ones split ~85% of budget
  const dailyPerActiveCamp = (dailyBudgetTotal * 0.85) / 2;
  const dailyPerPausedCamp = dailyBudgetTotal * 0.15;

  const today = new Date();

  // Create 3 campaigns
  const campaigns = [
    { name: 'Geração de Leads - Principal', objective: 'LEAD_GENERATION', status: 'active' },
    { name: 'WhatsApp - Conversão', objective: 'CONVERSIONS', status: 'active' },
    { name: 'Tráfego - Conteúdo', objective: 'TRAFFIC', status: 'paused' },
  ];

  const creativeTypes: Array<'image' | 'video' | 'carousel' | 'reel'> = ['image', 'video', 'carousel', 'reel'];
  const creativeNames = [
    'Criativo A - Depoimento',
    'Criativo B - Produto em uso',
    'Criativo C - Oferta direta',
    'Criativo D - Carrossel benefícios',
    'Criativo E - Vídeo curto (Reel)',
  ];

  const createdCampaignIds: number[] = [];

  for (const campData of campaigns) {
    const camp = await createCampaign({
      client_id: clientId,
      external_id: `ext_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: campData.name,
      platform: 'meta',
      status: campData.status as 'active' | 'paused' | 'archived',
      objective: campData.objective,
    });
    createdCampaignIds.push(camp.id);

    // 2 ad sets per campaign
    for (let asi = 0; asi < 2; asi++) {
      const adSet = await createAdSet({
        campaign_id: camp.id,
        external_id: `ads_${Date.now()}_${asi}`,
        name: `Conjunto ${asi + 1} - ${campData.name}`,
        targeting: { age_min: 25, age_max: 55, genders: [1, 2] },
        daily_budget: rand(50, 200),
        status: campData.status === 'active' ? 'active' : 'paused',
      });

      // 2-3 creatives per ad set
      const numCreatives = randInt(2, 3);
      for (let ci = 0; ci < numCreatives; ci++) {
        const creativeIdx = (asi * 2 + ci) % creativeNames.length;
        const creative = await createCreative({
          ad_set_id: adSet.id,
          external_id: `cr_${Date.now()}_${ci}`,
          name: creativeNames[creativeIdx],
          type: creativeTypes[ci % creativeTypes.length],
          status: 'active',
          thumbnail_url: null,
          headline: `Headline ${creativeIdx + 1}`,
          body_text: `Texto do anúncio ${creativeIdx + 1}`,
          cta: 'LEARN_MORE',
        });

        // Generate 90 days of daily metrics
        const creativeMetrics = [];
        let baseCTR = rand(0.8, 2.5);
        let baseFreq = 0.5;
        const saturationDay = randInt(40, 80);

        // Budget per creative: split adset budget evenly across creatives in this adset
        const campDailyBudget = campData.status === 'active' ? dailyPerActiveCamp : dailyPerPausedCamp;
        const adSetDailyBudget = campDailyBudget / 2; // 2 ad sets per campaign
        const creativeDailyBudget = adSetDailyBudget / numCreatives;

        for (let day = 89; day >= 0; day--) {
          const date = toISODate(subDays(today, day));
          const dayIndex = 89 - day;

          baseFreq = Math.min(baseFreq + rand(0.02, 0.05), 6.0);

          if (dayIndex > saturationDay) {
            baseCTR = Math.max(baseCTR * (1 - rand(0.01, 0.03)), 0.3);
          }

          // Spend proportional to creative budget with ±20% daily variance
          const spend = rand(creativeDailyBudget * 0.8, creativeDailyBudget * 1.2);
          // Impressions derived from spend using realistic Brazilian Meta CPM (R$15–30)
          const cpm = rand(15, 30);
          const impressions = Math.round((spend / cpm) * 1000);
          const reach = Math.round(impressions / Math.max(baseFreq, 1));
          const clicks = Math.round(impressions * (baseCTR / 100));
          const leads = campData.objective === 'LEAD_GENERATION' ? randInt(0, Math.max(1, Math.round(clicks * 0.15))) : 0;
          const messages = campData.objective === 'CONVERSIONS' ? randInt(0, Math.max(1, Math.round(clicks * 0.2))) : 0;

          creativeMetrics.push({
            entity_type: 'creative' as const,
            entity_id: creative.id,
            date,
            spend,
            impressions,
            reach,
            frequency: baseFreq,
            clicks,
            ctr: baseCTR,
            cpc: clicks > 0 ? spend / clicks : 0,
            cpm: (spend / impressions) * 1000,
            leads,
            cpl: leads > 0 ? spend / leads : 0,
            messages,
            cost_per_message: messages > 0 ? spend / messages : 0,
            followers: 0,
            cost_per_follower: 0,
            video_views: creative.type === 'video' || creative.type === 'reel' ? randInt(100, 800) : 0,
            hook_rate: creative.type === 'video' ? rand(15, 60) : 0,
            profile_visits: 0,
          });
        }
        await insertMetrics(creativeMetrics);
      }
    }

    // Campaign-level rollup (last 90 days)
    const campDailyBudget = campData.status === 'active' ? dailyPerActiveCamp : dailyPerPausedCamp;
    const campMetrics = [];
    for (let day = 89; day >= 0; day--) {
      const date = toISODate(subDays(today, day));
      const spend = rand(campDailyBudget * 0.8, campDailyBudget * 1.2);
      const cpm = rand(15, 30);
      const impressions = Math.round((spend / cpm) * 1000);
      const ctr = rand(0.8, 2.5);
      const clicks = Math.round(impressions * (ctr / 100));
      const leads = campData.objective === 'LEAD_GENERATION' ? randInt(1, Math.max(2, Math.round(clicks * 0.12))) : 0;
      const messages = campData.objective === 'CONVERSIONS' ? randInt(1, Math.max(2, Math.round(clicks * 0.18))) : 0;

      campMetrics.push({
        entity_type: 'campaign' as const,
        entity_id: camp.id,
        date,
        spend,
        impressions,
        reach: Math.round(impressions / rand(1.2, 3.5)),
        frequency: rand(1.0, 4.5),
        clicks,
        ctr,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: (spend / impressions) * 1000,
        leads,
        cpl: leads > 0 ? spend / leads : 0,
        messages,
        cost_per_message: messages > 0 ? spend / messages : 0,
        followers: 0,
        cost_per_follower: 0,
        video_views: 0,
        hook_rate: 0,
        profile_visits: 0,
      });
    }
    await insertMetrics(campMetrics);
  }

  // Seed CRM data using the created campaign IDs
  for (const campId of createdCampaignIds) {
    const crmRows = [];
    // Average campaign daily budget (mix of active/paused)
    const avgCampDailyBudget = dailyBudgetTotal / campaigns.length;
    for (let day = 89; day >= 0; day--) {
      const date = toISODate(subDays(today, day));
      const spend = rand(avgCampDailyBudget * 0.8, avgCampDailyBudget * 1.2);
      // Scale leads to budget: assume ~R$30-60 CPL
      const cpl = rand(30, 60);
      const leads = Math.max(1, Math.round(spend / cpl));
      const mql = Math.round(leads * rand(0.2, 0.5));
      const sql = Math.round(mql * rand(0.2, 0.5));
      const sales = Math.round(sql * rand(0.15, 0.4));
      const revenue = sales * rand(500, 3000);

      crmRows.push({
        client_id: clientId,
        campaign_id: campId,
        date,
        leads,
        mql,
        sql_count: sql,
        sales,
        revenue,
        cost_per_mql: mql > 0 ? spend / mql : 0,
        cost_per_sql: sql > 0 ? spend / sql : 0,
        cost_per_sale: sales > 0 ? spend / sales : 0,
        roas: spend > 0 ? revenue / spend : 0,
        lead_to_mql_rate: leads > 0 ? (mql / leads) * 100 : 0,
        mql_to_sql_rate: mql > 0 ? (sql / mql) * 100 : 0,
        sql_to_sale_rate: sql > 0 ? (sales / sql) * 100 : 0,
      });
    }

    // Upsert in batches to avoid request size limits
    const batchSize = 50;
    for (let i = 0; i < crmRows.length; i += batchSize) {
      const batch = crmRows.slice(i, i + batchSize);
      const { error } = await supabase
        .from('crm_metrics')
        .upsert(batch, { onConflict: 'client_id,campaign_id,creative_id,date', ignoreDuplicates: true });
      if (error) throw error;
    }
  }

  console.log(`[Mock] Seeded 90 days of data for client ${clientId}`);
}
