import { Router } from 'express';
import * as repo from './alerts.repository';

const router = Router();

router.get('/clients/:id/alerts', async (req, res, next) => {
  try {
    const onlyActive = req.query.resolved !== 'true';
    res.json(await repo.findAlertsByClient(Number(req.params.id), onlyActive));
  } catch (e) { next(e); }
});

router.post('/alerts/:id/resolve', async (req, res, next) => {
  try {
    await repo.resolveAlert(Number(req.params.id), req.body.resolved_by);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/clients/:id/alerts/check', async (req, res, next) => {
  try {
    await repo.checkAndCreateAlerts(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/alerts/summary', async (req, res, next) => {
  try {
    res.json(await repo.getAlertSummary());
  } catch (e) { next(e); }
});

export default router;
