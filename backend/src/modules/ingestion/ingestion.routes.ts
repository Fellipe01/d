import { Router } from 'express';
import { seedMockData } from './adapters/meta-ads.mock';
import { supabase } from '../../config/supabase';

const router = Router();

router.post('/ingestion/:clientId/meta-ads/mock', async (req, res, next) => {
  try {
    await seedMockData(Number(req.params.clientId));
    res.json({ message: 'Mock data seeded successfully' });
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
