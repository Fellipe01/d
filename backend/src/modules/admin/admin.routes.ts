import { Router } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

// ── Helper: busca nomes dos clientes ─────────────────────────────────────────

async function clientNames(): Promise<Map<number, string>> {
  const { data } = await supabase.from('clients').select('id,name');
  const map = new Map<number, string>();
  for (const c of (data || []) as { id: number; name: string }[]) map.set(c.id, c.name);
  return map;
}

// ── Relatórios ────────────────────────────────────────────────────────────────

router.get('/admin/reports', async (_req, res, next) => {
  try {
    const [{ data }, names] = await Promise.all([
      supabase.from('reports').select('*').order('generated_at', { ascending: false }).limit(200),
      clientNames(),
    ]);
    res.json((data || []).map((r: Record<string, unknown>) => ({ ...r, client_name: names.get(r.client_id as number) ?? '' })));
  } catch (e) { next(e); }
});

router.delete('/admin/reports/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('reports').delete().eq('id', Number(req.params.id));
    if (error) throw error;
    res.status(204).send();
  } catch (e) { next(e); }
});

// ── Insights ──────────────────────────────────────────────────────────────────

router.get('/admin/insights', async (_req, res, next) => {
  try {
    const [{ data }, names] = await Promise.all([
      supabase.from('insights').select('id,client_id,generated_at,period_start,period_end,summary,impact_level,category,status,triggered_by').order('generated_at', { ascending: false }).limit(200),
      clientNames(),
    ]);
    res.json((data || []).map((r: Record<string, unknown>) => ({ ...r, client_name: names.get(r.client_id as number) ?? '' })));
  } catch (e) { next(e); }
});

router.delete('/admin/insights/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('insights').delete().eq('id', Number(req.params.id));
    if (error) throw error;
    res.status(204).send();
  } catch (e) { next(e); }
});

// ── Alertas ───────────────────────────────────────────────────────────────────

router.get('/admin/alerts', async (_req, res, next) => {
  try {
    const [{ data }, names] = await Promise.all([
      supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(200),
      clientNames(),
    ]);
    res.json((data || []).map((r: Record<string, unknown>) => ({ ...r, client_name: names.get(r.client_id as number) ?? '' })));
  } catch (e) { next(e); }
});

router.delete('/admin/alerts/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('alerts').delete().eq('id', Number(req.params.id));
    if (error) throw error;
    res.status(204).send();
  } catch (e) { next(e); }
});

// ── Tarefas ───────────────────────────────────────────────────────────────────

router.get('/admin/tasks', async (_req, res, next) => {
  try {
    const [{ data }, names] = await Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true }).limit(200),
      clientNames(),
    ]);
    res.json((data || []).map((r: Record<string, unknown>) => ({ ...r, client_name: names.get(r.client_id as number) ?? '' })));
  } catch (e) { next(e); }
});

// ── Atividades ────────────────────────────────────────────────────────────────

router.get('/admin/activities', async (_req, res, next) => {
  try {
    const [{ data }, names] = await Promise.all([
      supabase.from('activities').select('*').order('executed_at', { ascending: false }).limit(200),
      clientNames(),
    ]);
    res.json((data || []).map((r: Record<string, unknown>) => ({ ...r, client_name: names.get(r.client_id as number) ?? '' })));
  } catch (e) { next(e); }
});

router.delete('/admin/activities/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('activities').delete().eq('id', Number(req.params.id));
    if (error) throw error;
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
