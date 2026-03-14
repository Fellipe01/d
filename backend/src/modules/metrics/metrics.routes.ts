import { Router } from 'express';
import * as repo from './metrics.repository';
import { findKpisByClientId } from '../clients/clients.repository';
import { evaluateAllKpis } from '../../shared/utils/kpi-evaluator';
import { subDays, toISODate } from '../../shared/utils/date';

const router = Router();

function defaultRange() {
  const end = toISODate(new Date());
  const start = toISODate(subDays(new Date(), 7));
  return { start, end };
}

router.get('/clients/:id/metrics', async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const range = start && end ? { start, end } : defaultRange();
    res.json(await repo.getClientMetrics(Number(req.params.id), range.start, range.end));
  } catch (e) { next(e); }
});

router.get('/clients/:id/metrics/timeseries', async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const range = start && end ? { start, end } : defaultRange();
    res.json(await repo.getClientMetricsTimeseries(Number(req.params.id), range.start, range.end));
  } catch (e) { next(e); }
});

router.get('/clients/:id/metrics/summary', async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const range = start && end ? { start, end } : defaultRange();
    const [metrics, kpis] = await Promise.all([
      repo.getClientMetrics(Number(req.params.id), range.start, range.end),
      findKpisByClientId(Number(req.params.id)),
    ]);
    const results = evaluateAllKpis(metrics as unknown as Record<string, number>, kpis);
    res.json({ metrics, kpi_results: results, period: range });
  } catch (e) { next(e); }
});

router.get('/clients/:id/metrics/top-creatives', async (req, res, next) => {
  try {
    const { start, end, limit } = req.query as { start?: string; end?: string; limit?: string };
    const range = start && end ? { start, end } : defaultRange();
    res.json(await repo.getTopCreativesByClient(Number(req.params.id), range.start, range.end, Number(limit) || 10));
  } catch (e) { next(e); }
});

router.get('/campaigns/:id/metrics', async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const range = start && end ? { start, end } : defaultRange();
    res.json(await repo.getCampaignMetrics(Number(req.params.id), range.start, range.end));
  } catch (e) { next(e); }
});

router.get('/creatives/:id/metrics', async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const range = start && end ? { start, end } : defaultRange();
    res.json(await repo.getCreativeMetrics(Number(req.params.id), range.start, range.end));
  } catch (e) { next(e); }
});

router.get('/creatives/:id/metrics/timeseries', async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const range = start && end ? { start, end } : defaultRange();
    res.json(await repo.getCreativeMetricsTimeseries(Number(req.params.id), range.start, range.end));
  } catch (e) { next(e); }
});

export default router;
