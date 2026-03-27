import cron from 'node-cron';
import { supabase } from '../config/supabase';
import { generateInsight } from '../modules/insights/insights.service';
import { generateWeeklyCampaignReport } from '../modules/reports/weekly-campaign-report';
import { generateWeeklyActivitiesReport, archivePreviousWeekActivities } from '../modules/reports/weekly-activities-report';
import { checkAndCreateAlerts } from '../modules/alerts/alerts.repository';
import { lastWeekRange, currentWeekRange } from '../shared/utils/date';

async function getActiveClientIds(): Promise<number[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('status', 'active');
  if (error) {
    console.error('[Scheduler] Failed to fetch active clients:', error);
    return [];
  }
  return (data || []).map((c: { id: number }) => c.id);
}

async function runReports(type: 'weekly_mon' | 'weekly_wed' | 'weekly_fri'): Promise<void> {
  const clientIds = await getActiveClientIds();
  const range = type === 'weekly_mon' ? lastWeekRange() : currentWeekRange();

  console.log(`[Scheduler] Generating ${type} reports for ${clientIds.length} clients...`);

  for (const clientId of clientIds) {
    try {
      let content: string;

      if (type === 'weekly_mon') {
        // Segunda-feira: relatório de campanhas sem IA
        content = await generateWeeklyCampaignReport(clientId, range.start, range.end);
      } else if (type === 'weekly_fri') {
        // Sexta-feira: lista de atividades da semana sem IA + arquiva semana anterior
        content = await generateWeeklyActivitiesReport(clientId, range.start, range.end);
        await archivePreviousWeekActivities(clientId, range.start);
      } else {
        // Quarta-feira e manual: insights com IA
        const insight = await generateInsight(clientId, range.start, range.end, type, 'scheduled');
        content = insight.content;
      }

      const { error } = await supabase.from('reports').insert({
        client_id: clientId,
        report_type: type,
        period_start: range.start,
        period_end: range.end,
        content,
        status: 'published',
      });
      if (error) throw error;

      console.log(`[Scheduler] Report generated for client ${clientId}`);
    } catch (err) {
      console.error(`[Scheduler] Failed for client ${clientId}:`, err);
    }
  }
}

async function runAlertChecks(): Promise<void> {
  const clientIds = await getActiveClientIds();
  for (const clientId of clientIds) {
    try {
      await checkAndCreateAlerts(clientId);
    } catch (err) {
      console.error(`[Scheduler] Alert check failed for client ${clientId}:`, err);
    }
  }
}

export function startScheduler(): void {
  // Monday 9am: weekly report (last week)
  cron.schedule('0 9 * * 1', () => runReports('weekly_mon'), { timezone: 'America/Sao_Paulo' });

  // Wednesday 9am: mid-week intelligence
  cron.schedule('0 9 * * 3', () => runReports('weekly_wed'), { timezone: 'America/Sao_Paulo' });

  // Friday 9am: activities report
  cron.schedule('0 9 * * 5', () => runReports('weekly_fri'), { timezone: 'America/Sao_Paulo' });

  // Daily 8am: check KPI alerts
  cron.schedule('0 8 * * *', runAlertChecks, { timezone: 'America/Sao_Paulo' });

  console.log('[Scheduler] Cron jobs registered (Mon/Wed/Fri 9am reports, daily 8am alerts)');
}
