import { Router } from 'express';
import * as repo from './campaigns.repository';
import { NotFoundError } from '../../shared/errors';

const router = Router();

// Campaigns
router.get('/clients/:clientId/campaigns', async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    res.json(await repo.findCampaignsByClient(Number(req.params.clientId), status));
  } catch (e) { next(e); }
});

router.post('/clients/:clientId/campaigns', async (req, res, next) => {
  try {
    const camp = await repo.createCampaign({ ...req.body, client_id: Number(req.params.clientId) });
    res.status(201).json(camp);
  } catch (e) { next(e); }
});

router.get('/campaigns/:id', async (req, res, next) => {
  try {
    const camp = await repo.findCampaignById(Number(req.params.id));
    if (!camp) throw new NotFoundError('Campaign', req.params.id);
    const adSets = await repo.findAdSetsByCampaign(camp.id);
    res.json({ ...camp, ad_sets: adSets });
  } catch (e) { next(e); }
});

// Ad Sets
router.get('/campaigns/:id/ad-sets', async (req, res, next) => {
  try {
    res.json(await repo.findAdSetsByCampaign(Number(req.params.id)));
  } catch (e) { next(e); }
});

// Creatives
router.get('/ad-sets/:id/creatives', async (req, res, next) => {
  try {
    res.json(await repo.findCreativesByAdSet(Number(req.params.id)));
  } catch (e) { next(e); }
});

router.get('/clients/:clientId/creatives', async (req, res, next) => {
  try {
    res.json(await repo.findCreativesByClient(Number(req.params.clientId)));
  } catch (e) { next(e); }
});

router.get('/creatives/:id', async (req, res, next) => {
  try {
    const c = await repo.findCreativeById(Number(req.params.id));
    if (!c) throw new NotFoundError('Creative', req.params.id);
    res.json(c);
  } catch (e) { next(e); }
});

export default router;
