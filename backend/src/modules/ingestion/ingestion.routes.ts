import { Router } from 'express';
import { seedMockData } from './adapters/meta-ads.mock';
import { supabase } from '../../config/supabase';
import { env } from '../../config/env';

const router = Router();

router.post('/ingestion/:clientId/meta-ads/mock', async (req, res, next) => {
  if (!env.USE_META_MOCK) {
    res.status(403).json({ error: { message: 'Mock data is disabled (USE_META_MOCK=false). Use the real Meta Ads sync instead.', code: 'MOCK_DISABLED' } });
    return;
  }
  try {
    const clientId = Number(req.params.clientId);
    await seedMockData(clientId);
    await supabase.from('clients').update({ last_meta_sync_at: new Date().toISOString() }).eq('id', clientId);
    res.json({ message: 'Mock data seeded successfully', synced_at: new Date().toISOString() });
  } catch (e) { next(e); }
});

router.post('/ingestion/:clientId/rd-station/sync', async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    // Placeholder: RD Station real integration reads rdstation_token from client
    // and pulls deals/leads into crm_metrics using stage config (rd_mql_stage etc.)
    const now = new Date().toISOString();
    await supabase.from('clients').update({ last_rd_sync_at: now }).eq('id', clientId);
    res.json({ message: 'RD Station sync triggered', synced_at: now });
  } catch (e) { next(e); }
});

router.get('/ingestion/:clientId/status', async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);

    // Get campaign IDs for this client
    const { data: campaigns, error: campErr } = await supabase
      .from('campaigns')
      .select('id')
      .eq('client_id', clientId);
    if (campErr) throw campErr;

    const campaignIds = (campaigns || []).map((c: { id: number }) => c.id);

    if (!campaignIds.length) {
      res.json({ last_ingestion: null, total_rows: 0 });
      return;
    }

    const { data: rows, error } = await supabase
      .from('metrics_daily')
      .select('ingested_at')
      .eq('entity_type', 'campaign')
      .in('entity_id', campaignIds);
    if (error) throw error;

    const total_rows = (rows || []).length;
    const last_ingestion = (rows || []).reduce((max: string | null, r: { ingested_at: string }) => {
      if (!max || r.ingested_at > max) return r.ingested_at;
      return max;
    }, null);

    res.json({ last_ingestion, total_rows });
  } catch (e) { next(e); }
});

export default router;
