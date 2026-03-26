import { Router } from 'express';
import { supabase } from '../../config/supabase';
import { subDays, toISODate } from '../../shared/utils/date';

const router = Router();

function defaultRange() {
  return {
    start: toISODate(subDays(new Date(), 7)),
    end: toISODate(new Date()),
  };
}

router.get('/clients/:id/funnel', async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const range = start && end ? { start, end } : defaultRange();
    const clientId = Number(req.params.id);

    const { data: rows, error } = await supabase
      .from('crm_metrics')
      .select('leads,mql,sql_count,sales,revenue')
      .eq('client_id', clientId)
      .gte('date', range.start)
      .lte('date', range.end);
    if (error) throw error;

    type CrmRow = { leads: number; mql: number; sql_count: number; sales: number; revenue: number };

    const totals = ((rows || []) as CrmRow[]).reduce(
      (acc, row) => ({
        leads: acc.leads + (row.leads || 0),
        mql: acc.mql + (row.mql || 0),
        sql: acc.sql + (row.sql_count || 0),
        sales: acc.sales + (row.sales || 0),
        revenue: acc.revenue + (row.revenue || 0),
      }),
      { leads: 0, mql: 0, sql: 0, sales: 0, revenue: 0 }
    );

    // Get total Meta Ads spend in the same period to compute cost metrics
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('client_id', clientId);
    const campaignIds = (campaigns || []).map((c: { id: number }) => c.id);

    let totalSpend = 0;
    if (campaignIds.length) {
      const { data: metaRows } = await supabase
        .from('metrics_daily')
        .select('spend')
        .eq('entity_type', 'campaign')
        .in('entity_id', campaignIds)
        .gte('date', range.start)
        .lte('date', range.end);
      totalSpend = ((metaRows || []) as { spend: number }[]).reduce((s, r) => s + (r.spend || 0), 0);
    }

    res.json({
      leads: totals.leads,
      mql: totals.mql,
      sql: totals.sql,
      sales: totals.sales,
      revenue: totals.revenue,
      cost_per_lead:  totals.leads > 0 ? totalSpend / totals.leads : 0,
      cost_per_mql:   totals.mql   > 0 ? totalSpend / totals.mql   : 0,
      cost_per_sql:   totals.sql   > 0 ? totalSpend / totals.sql   : 0,
      cost_per_sale:  totals.sales > 0 ? totalSpend / totals.sales : 0,
      period: range,
    });
  } catch (e) { next(e); }
});

router.get('/clients/:id/funnel/by-campaign', async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const range = start && end ? { start, end } : defaultRange();
    const clientId = Number(req.params.id);

    const { data: rows, error } = await supabase
      .from('crm_metrics')
      .select('campaign_id,leads,mql,sql_count,sales,revenue,cost_per_sale,lead_to_mql_rate')
      .eq('client_id', clientId)
      .gte('date', range.start)
      .lte('date', range.end)
      .not('campaign_id', 'is', null);
    if (error) throw error;

    // Get campaign names
    const campaignIds = [...new Set((rows || []).map((r: { campaign_id: number }) => r.campaign_id).filter(Boolean))];
    let campaignNames = new Map<number, string>();
    if (campaignIds.length) {
      const { data: camps } = await supabase
        .from('campaigns')
        .select('id,name')
        .in('id', campaignIds);
      if (camps) {
        for (const c of camps as { id: number; name: string }[]) {
          campaignNames.set(c.id, c.name);
        }
      }
    }

    type CampaignRow = { campaign_id: number; leads: number; mql: number; sql_count: number; sales: number; revenue: number; cost_per_sale: number; lead_to_mql_rate: number };
    const aggMap = new Map<number, { campaign_id: number; campaign_name: string; leads: number; mql: number; sql: number; sales: number; revenue: number; cps_sum: number; lmql_sum: number; count: number }>();

    for (const row of (rows || []) as CampaignRow[]) {
      const existing = aggMap.get(row.campaign_id);
      if (existing) {
        existing.leads += row.leads || 0;
        existing.mql += row.mql || 0;
        existing.sql += row.sql_count || 0;
        existing.sales += row.sales || 0;
        existing.revenue += row.revenue || 0;
        existing.cps_sum += row.cost_per_sale || 0;
        existing.lmql_sum += row.lead_to_mql_rate || 0;
        existing.count += 1;
      } else {
        aggMap.set(row.campaign_id, {
          campaign_id: row.campaign_id,
          campaign_name: campaignNames.get(row.campaign_id) || String(row.campaign_id),
          leads: row.leads || 0,
          mql: row.mql || 0,
          sql: row.sql_count || 0,
          sales: row.sales || 0,
          revenue: row.revenue || 0,
          cps_sum: row.cost_per_sale || 0,
          lmql_sum: row.lead_to_mql_rate || 0,
          count: 1,
        });
      }
    }

    const result = Array.from(aggMap.values())
      .map(a => ({
        campaign_id: a.campaign_id,
        campaign_name: a.campaign_name,
        leads: a.leads,
        mql: a.mql,
        sql: a.sql,
        sales: a.sales,
        revenue: a.revenue,
        cost_per_sale: a.count > 0 ? a.cps_sum / a.count : 0,
        lead_to_mql_rate: a.count > 0 ? a.lmql_sum / a.count : 0,
      }))
      .sort((a, b) => b.sales - a.sales);

    res.json(result);
  } catch (e) { next(e); }
});

router.get('/clients/:id/funnel/by-creative', async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const range = start && end ? { start, end } : defaultRange();
    const clientId = Number(req.params.id);

    const { data: rows, error } = await supabase
      .from('crm_metrics')
      .select('creative_id,leads,mql,sql_count,sales,revenue,cost_per_sale')
      .eq('client_id', clientId)
      .gte('date', range.start)
      .lte('date', range.end)
      .not('creative_id', 'is', null);
    if (error) throw error;

    // Get creative names/types
    const creativeIds = [...new Set((rows || []).map((r: { creative_id: number }) => r.creative_id).filter(Boolean))];
    let creativeInfo = new Map<number, { name: string; type: string }>();
    if (creativeIds.length) {
      const { data: crs } = await supabase
        .from('creatives')
        .select('id,name,type')
        .in('id', creativeIds);
      if (crs) {
        for (const c of crs as { id: number; name: string; type: string }[]) {
          creativeInfo.set(c.id, { name: c.name, type: c.type });
        }
      }
    }

    type CreativeRow = { creative_id: number; leads: number; mql: number; sql_count: number; sales: number; revenue: number; cost_per_sale: number };
    const aggMap = new Map<number, { creative_id: number; creative_name: string; creative_type: string; leads: number; mql: number; sql: number; sales: number; revenue: number; cps_sum: number; count: number }>();

    for (const row of (rows || []) as CreativeRow[]) {
      const existing = aggMap.get(row.creative_id);
      if (existing) {
        existing.leads += row.leads || 0;
        existing.mql += row.mql || 0;
        existing.sql += row.sql_count || 0;
        existing.sales += row.sales || 0;
        existing.revenue += row.revenue || 0;
        existing.cps_sum += row.cost_per_sale || 0;
        existing.count += 1;
      } else {
        const info = creativeInfo.get(row.creative_id);
        aggMap.set(row.creative_id, {
          creative_id: row.creative_id,
          creative_name: info?.name || String(row.creative_id),
          creative_type: info?.type || 'unknown',
          leads: row.leads || 0,
          mql: row.mql || 0,
          sql: row.sql_count || 0,
          sales: row.sales || 0,
          revenue: row.revenue || 0,
          cps_sum: row.cost_per_sale || 0,
          count: 1,
        });
      }
    }

    const result = Array.from(aggMap.values())
      .map(a => ({
        creative_id: a.creative_id,
        creative_name: a.creative_name,
        creative_type: a.creative_type,
        leads: a.leads,
        mql: a.mql,
        sql: a.sql,
        sales: a.sales,
        revenue: a.revenue,
        cost_per_sale: a.count > 0 ? a.cps_sum / a.count : 0,
      }))
      .sort((a, b) => b.sales - a.sales);

    res.json(result);
  } catch (e) { next(e); }
});

export default router;
