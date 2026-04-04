import cron from 'node-cron';
import { supabase } from '../config/supabase';
import { generateInsight } from '../modules/insights/insights.service';
import { generateWeeklyCampaignReport } from '../modules/reports/weekly-campaign-report';
import { generateWeeklyActivitiesReport, archivePreviousWeekActivities } from '../modules/reports/weekly-activities-report';
import { checkAndCreateAlerts } from '../modules/alerts/alerts.repository';
import { lastWeekRange, currentWeekRange } from '../shared/utils/date';
import { syncMetaAdsReal } from '../modules/ingestion/adapters/meta-ads.adapter';
import { syncRdStationReal } from '../modules/ingestion/adapters/rd-station.adapter';

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runDailySync(): Promise<void> {
  const clientIds = await getActiveClientIds();
  console.log(`[Scheduler] Starting daily sync for ${clientIds.length} clients...`);

  for (const clientId of clientIds) {
    try {
      await syncMetaAdsReal(clientId);
      await supabase.from('clients').update({ last_meta_sync_at: new Date().toISOString() }).eq('id', clientId);
      console.log(`[Scheduler] Meta sync complete for client ${clientId}`);
    } catch (err) {
      console.error(`[Scheduler] Meta sync failed for client ${clientId}:`, err);
    }

    // Aguarda 15s entre clientes para não estourar o rate limit da Meta API
    await sleep(15000);

    try {
      await syncRdStationReal(clientId);
      await supabase.from('clients').update({ last_rd_sync_at: new Date().toISOString() }).eq('id', clientId);
      console.log(`[Scheduler] RD sync complete for client ${clientId}`);
    } catch (err) {
      console.error(`[Scheduler] RD sync failed for client ${clientId}:`, err);
    }
  }

  console.log('[Scheduler] Daily sync finished');
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

  // Daily 6am: sync Meta Ads + RD Station for all active clients
  cron.schedule('0 6 * * *', runDailySync, { timezone: 'America/Sao_Paulo' });

  // Daily 8am: check KPI alerts
  cron.schedule('0 8 * * *', runAlertChecks, { timezone: 'America/Sao_Paulo' });

  console.log('[Scheduler] Cron jobs registered (daily 6am sync, Mon/Wed/Fri 9am reports, daily 8am alerts)');
}
