import { Router } from 'express';
import { supabase } from '../../config/supabase';
import { generateInsight } from '../insights/insights.service';
import { generateWeeklyCampaignReport } from './weekly-campaign-report';
import { generateWeeklyActivitiesReport, archivePreviousWeekActivities } from './weekly-activities-report';
import { lastWeekRange, currentWeekRange } from '../../shared/utils/date';
import { NotFoundError } from '../../shared/errors';

const router = Router();

router.get('/clients/:id/reports', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('id,client_id,report_type,generated_at,period_start,period_end,status')
      .eq('client_id', Number(req.params.id))
      .order('generated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data || []);
  } catch (e) { next(e); }
});

router.get('/reports/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', Number(req.params.id))
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError('Report', req.params.id);
    res.json(data);
  } catch (e) { next(e); }
});

router.post('/clients/:id/reports/generate', async (req, res, next) => {
  try {
    const { report_type } = req.body as { report_type?: 'weekly_mon' | 'weekly_wed' | 'weekly_fri' | 'manual' };
    const type = report_type || 'manual';

    const range = type === 'weekly_mon' ? lastWeekRange() : currentWeekRange();
    const clientId = Number(req.params.id);

    let content: string;
    if (type === 'weekly_mon') {
      content = await generateWeeklyCampaignReport(clientId, range.start, range.end);
    } else if (type === 'weekly_fri') {
      content = await generateWeeklyActivitiesReport(clientId, range.start, range.end);
      await archivePreviousWeekActivities(clientId, range.start);
    } else {
      const insight = await generateInsight(clientId, range.start, range.end, type, 'scheduled');
      content = insight.content;
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        client_id: clientId,
        report_type: type,
        period_start: range.start,
        period_end: range.end,
        content,
        status: 'published',
      })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (e) { next(e); }
});

export default router;
