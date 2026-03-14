import { Router } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

router.get('/clients/:id/activities', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('client_id', Number(req.params.id))
      .order('executed_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json(data || []);
  } catch (e) { next(e); }
});

router.post('/clients/:id/activities', async (req, res, next) => {
  try {
    const { activity_type, description, executed_by, campaign_id, creative_id, metadata } = req.body;
    const { data, error } = await supabase
      .from('activities')
      .insert({
        client_id: Number(req.params.id),
        activity_type,
        description,
        executed_by: executed_by || 'agency',
        campaign_id: campaign_id || null,
        creative_id: creative_id || null,
        metadata: JSON.stringify(metadata || {}),
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { next(e); }
});

export default router;
