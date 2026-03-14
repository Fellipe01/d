import { Router } from 'express';
import * as svc from './insights.service';
import { NotFoundError } from '../../shared/errors';
import { subDays, toISODate } from '../../shared/utils/date';

const router = Router();

router.get('/clients/:id/insights', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 20;
    res.json(await svc.findInsightsByClient(Number(req.params.id), limit));
  } catch (e) { next(e); }
});

router.post('/clients/:id/insights/generate', async (req, res, next) => {
  try {
    const { start, end, report_type } = req.body as {
      start?: string; end?: string;
      report_type?: 'weekly_mon' | 'weekly_wed' | 'weekly_fri' | 'manual';
    };
    const periodEnd = end || toISODate(new Date());
    const periodStart = start || toISODate(subDays(new Date(), 7));
    const insight = await svc.generateInsight(
      Number(req.params.id), periodStart, periodEnd, report_type || 'manual', 'manual'
    );
    res.status(201).json(insight);
  } catch (e) { next(e); }
});

router.get('/insights/:id', async (req, res, next) => {
  try {
    const insight = await svc.findInsightById(Number(req.params.id));
    if (!insight) throw new NotFoundError('Insight', req.params.id);
    res.json(insight);
  } catch (e) { next(e); }
});

router.patch('/insights/:id/status', async (req, res, next) => {
  try {
    await svc.updateInsightStatus(Number(req.params.id), req.body.status);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
