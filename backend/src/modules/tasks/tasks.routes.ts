import { Router } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

// Lista tarefas do cliente (não concluídas primeiro, depois por due_date)
router.get('/clients/:id/tasks', async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('client_id', Number(req.params.id))
      .order('due_date', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e) { next(e); }
});

// Cria tarefa
router.post('/clients/:id/tasks', async (req, res, next) => {
  try {
    const { task_type, custom_type, title, description, due_date, assigned_to, campaign_id } = req.body;
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        client_id: Number(req.params.id),
        task_type,
        custom_type: task_type === 'other' ? custom_type : null,
        title,
        description: description || null,
        due_date,
        assigned_to: assigned_to || 'DAE Assessoria',
        campaign_id: campaign_id || null,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { next(e); }
});

// Conclui tarefa
router.patch('/tasks/:id/complete', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', Number(req.params.id))
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// Cancela tarefa
router.patch('/tasks/:id/cancel', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status: 'cancelled' })
      .eq('id', Number(req.params.id))
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// Deleta tarefa
router.delete('/tasks/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', Number(req.params.id));
    if (error) throw error;
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
