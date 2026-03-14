import { Router } from 'express';
import * as ctrl from './clients.controller';

const router = Router();

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.get);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.get('/:id/kpis', ctrl.getKpis);
router.put('/:id/kpis', ctrl.upsertKpis);

export default router;
