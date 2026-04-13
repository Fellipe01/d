import OpenAI from 'openai';
import { env } from '../../config/env';
import { supabase } from '../../config/supabase';
import { findClientById, findKpisByClientId } from '../clients/clients.repository';
import { getClientMetrics, getTopCreativesByClient } from '../metrics/metrics.repository';
import { evaluateAllKpis } from '../../shared/utils/kpi-evaluator';
import { buildWeeklyReportPrompt, WeeklyReportContext } from './prompts/weekly-report.prompt';
import { SYSTEM_PROMPT } from './prompts/system-prompt';
import { NotFoundError } from '../../shared/errors';
import { generateWeeklyCampaignReport } from '../reports/weekly-campaign-report';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface Insight {
  id: number;
  client_id: number;
  generated_at: string;
  period_start: string;
  period_end: string;
  content: string;
  summary: string | null;
  impact_level: string;
  category: string;
  status: string;
  triggered_by: string;
}

export async function findInsightsByClient(clientId: number, limit = 20): Promise<Insight[]> {
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('client_id', clientId)
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as Insight[];
}

export async function findInsightById(id: number): Promise<Insight | undefined> {
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Insight | undefined ?? undefined;
}

export async function updateInsightStatus(id: number, status: string): Promise<void> {
  const { error } = await supabase
    .from('insights')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

function extractImpactLevel(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('crítico') || lower.includes('critico')) return 'critical';
  if (lower.includes('alto')) return 'high';
  if (lower.includes('baixo')) return 'low';
  return 'medium';
}

function extractCategory(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('saturação') || lower.includes('saturacao') || lower.includes('frequência')) return 'saturation';
  if (lower.includes('funil') || lower.includes('mql') || lower.includes('sql')) return 'funnel';
  if (lower.includes('orçamento') || lower.includes('budget') || lower.includes('gasto')) return 'budget';
  if (lower.includes('criativo')) return 'creative';
  if (lower.includes('oportunidade') || lower.includes('escalar')) return 'opportunity';
  return 'performance';
}

function extractSummary(content: string): string {
  const lines = content.split('\n').filter(l => l.trim());
  for (const line of lines) {
    if (!line.startsWith('#') && line.length > 30) {
      return line.replace(/\*\*/g, '').slice(0, 200);
    }
  }
  return lines[0]?.slice(0, 200) || '';
}

async function getActiveAlerts(clientId: number) {
  const { data, error } = await supabase
    .from('alerts')
    .select('alert_type,severity,message')
    .eq('client_id', clientId)
    .is('resolved_at', null)
    .order('severity', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data || []) as { alert_type: string; severity: string; message: string }[];
}

async function getCrmSummary(clientId: number, start: string, end: string) {
  const { data: rows, error } = await supabase
    .from('crm_metrics')
    .select('leads,mql,sql_count,sales,revenue,cost_per_mql,cost_per_sql,cost_per_sale,lead_to_mql_rate,mql_to_sql_rate,sql_to_sale_rate')
    .eq('client_id', clientId)
    .gte('date', start)
    .lte('date', end);
  if (error) throw error;
  if (!rows || !rows.length) return null;

  type CrmRow = {
    leads: number; mql: number; sql_count: number; sales: number; revenue: number;
    cost_per_mql: number; cost_per_sql: number; cost_per_sale: number;
    lead_to_mql_rate: number; mql_to_sql_rate: number; sql_to_sale_rate: number;
  };

  const totals = (rows as CrmRow[]).reduce(
    (acc, row) => ({
      leads: acc.leads + (row.leads || 0),
      mql: acc.mql + (row.mql || 0),
      sql: acc.sql + (row.sql_count || 0),
      sales: acc.sales + (row.sales || 0),
      revenue: acc.revenue + (row.revenue || 0),
      cost_per_mql_sum: acc.cost_per_mql_sum + (row.cost_per_mql || 0),
      cost_per_sql_sum: acc.cost_per_sql_sum + (row.cost_per_sql || 0),
      cost_per_sale_sum: acc.cost_per_sale_sum + (row.cost_per_sale || 0),
      lead_to_mql_sum: acc.lead_to_mql_sum + (row.lead_to_mql_rate || 0),
      mql_to_sql_sum: acc.mql_to_sql_sum + (row.mql_to_sql_rate || 0),
      sql_to_sale_sum: acc.sql_to_sale_sum + (row.sql_to_sale_rate || 0),
      count: acc.count + 1,
    }),
    { leads: 0, mql: 0, sql: 0, sales: 0, revenue: 0, cost_per_mql_sum: 0, cost_per_sql_sum: 0, cost_per_sale_sum: 0, lead_to_mql_sum: 0, mql_to_sql_sum: 0, sql_to_sale_sum: 0, count: 0 }
  );

  if (!totals.leads) return null;
  const n = totals.count || 1;
  return {
    leads: totals.leads,
    mql: totals.mql,
    sql: totals.sql,
    sales: totals.sales,
    revenue: totals.revenue,
    cost_per_mql: totals.cost_per_mql_sum / n,
    cost_per_sql: totals.cost_per_sql_sum / n,
    cost_per_sale: totals.cost_per_sale_sum / n,
    lead_to_mql_rate: totals.lead_to_mql_sum / n,
    mql_to_sql_rate: totals.mql_to_sql_sum / n,
    sql_to_sale_rate: totals.sql_to_sale_sum / n,
  };
}

export async function generateInsight(
  clientId: number,
  periodStart: string,
  periodEnd: string,
  reportType: 'weekly_mon' | 'weekly_wed' | 'weekly_fri' | 'manual' = 'manual',
  triggeredBy: 'manual' | 'scheduled' | 'alert' = 'manual'
): Promise<Insight> {
  const client = await findClientById(clientId);
  if (!client) throw new NotFoundError('Client', clientId);

  // Segunda-feira: card por campanha, sem IA
  if (reportType === 'weekly_mon') {
    const content = await generateWeeklyCampaignReport(clientId, periodStart, periodEnd);
    const { data, error } = await supabase
      .from('insights')
      .insert({
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
        content,
        summary: content.split('\n')[0],
        impact_level: 'low',
        category: 'performance',
        triggered_by: triggeredBy,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Insight;
  }

  const [kpis, metrics, topCreatives, crmSummary, alerts] = await Promise.all([
    findKpisByClientId(clientId),
    getClientMetrics(clientId, periodStart, periodEnd),
    getTopCreativesByClient(clientId, periodStart, periodEnd, 10),
    getCrmSummary(clientId, periodStart, periodEnd),
    getActiveAlerts(clientId),
  ]);

  const kpiResults = evaluateAllKpis(metrics as unknown as Record<string, number>, kpis);

  const ctx: WeeklyReportContext = {
    client,
    kpis,
    periodStart,
    periodEnd,
    metrics,
    kpiResults,
    topCreatives: topCreatives as TopCreative[],
    crmSummary,
    alerts,
    reportType,
  };

  const prompt = buildWeeklyReportPrompt(ctx);

  const message = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2048,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  const content = message.choices[0].message.content ?? '';
  const impactLevel = extractImpactLevel(content);
  const category = extractCategory(content);
  const summary = extractSummary(content);

  const { data, error } = await supabase
    .from('insights')
    .insert({
      client_id: clientId,
      period_start: periodStart,
      period_end: periodEnd,
      content,
      summary,
      impact_level: impactLevel,
      category,
      triggered_by: triggeredBy,
    })
    .select()
    .single();
  if (error) throw error;

  return data as Insight;
}

interface TopCreative {
  id: number;
  name: string;
  type: string;
  spend: number;
  leads: number;
  ctr: number;
  cpl: number;
  frequency: number;
}
