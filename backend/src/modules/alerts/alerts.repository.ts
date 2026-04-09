import { supabase } from '../../config/supabase';
import { findClientById, findKpisByClientId } from '../clients/clients.repository';
import { getClientMetrics } from '../metrics/metrics.repository';
import { evaluateKpi } from '../../shared/utils/kpi-evaluator';
import { subDays, toISODate } from '../../shared/utils/date';

export interface Alert {
  id: number;
  client_id: number;
  alert_type: string;
  severity: string;
  message: string;
  entity_type: string | null;
  entity_id: number | null;
  kpi_name: string | null;
  actual_value: number | null;
  threshold_value: number | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export async function findAlertsByClient(clientId: number, onlyActive = true): Promise<Alert[]> {
  let query = supabase
    .from('alerts')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (onlyActive) {
    query = query.is('resolved_at', null);
  } else {
    query = query.limit(100);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Alert[];
}

export async function resolveAlert(id: number, resolvedBy = 'user'): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq('id', id);
  if (error) throw error;
}

export async function createAlert(data: Omit<Alert, 'id' | 'created_at' | 'resolved_at' | 'resolved_by'>): Promise<void> {
  const { error } = await supabase.from('alerts').insert(data);
  if (error) throw error;
}

export async function getAlertSummary() {
  const { data, error } = await supabase
    .from('alerts')
    .select('client_id,severity')
    .is('resolved_at', null);
  if (error) throw error;

  // Aggregate by client_id + severity in JS
  const counts = new Map<string, { client_id: number; severity: string; count: number }>();
  for (const row of (data || []) as Array<{ client_id: number; severity: string }>) {
    const key = `${row.client_id}:${row.severity}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { client_id: row.client_id, severity: row.severity, count: 1 });
    }
  }
  return Array.from(counts.values());
}

export async function checkAndCreateAlerts(clientId: number): Promise<void> {
  const client = await findClientById(clientId);
  if (!client) return;

  const kpis = await findKpisByClientId(clientId);
  if (!kpis.length) return;

  const end = toISODate(new Date());
  const start = toISODate(subDays(new Date(), 7));
  const metrics = await getClientMetrics(clientId, start, end) as unknown as Record<string, number>;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const kpi of kpis) {
    const actual = metrics[kpi.kpi_name];
    if (actual === undefined) continue;

    const result = evaluateKpi(actual, kpi);
    if (result.status === 'breach') {
      // Check if a recent unresolved alert already exists for this KPI
      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('client_id', clientId)
        .eq('kpi_name', kpi.kpi_name)
        .is('resolved_at', null)
        .gte('created_at', oneDayAgo)
        .maybeSingle();

      if (!existing) {
        const direction = kpi.kpi_type === 'lower_is_better' ? 'acima do' : 'abaixo do';
        await createAlert({
          client_id: clientId,
          alert_type: 'kpi_breach',
          severity: result.raw_score < 0.6 ? 'critical' : 'warning',
          message: `KPI "${kpi.kpi_name}" está ${direction} limite aceitável. Real: ${actual.toFixed(2)} | Meta: ${kpi.target_value.toFixed(2)}`,
          entity_type: 'client',
          entity_id: clientId,
          kpi_name: kpi.kpi_name,
          actual_value: actual,
          threshold_value: kpi.target_value,
        });
      }
    }
  }

  // Check frequency saturation
  const frequency = metrics['frequency'];
  if (frequency && frequency >= 4.0) {
    const { data: existing } = await supabase
      .from('alerts')
      .select('id')
      .eq('client_id', clientId)
      .eq('alert_type', 'frequency_high')
      .is('resolved_at', null)
      .gte('created_at', oneDayAgo)
      .maybeSingle();

    if (!existing) {
      await createAlert({
        client_id: clientId,
        alert_type: 'frequency_high',
        severity: frequency >= 5.0 ? 'critical' : 'warning',
        message: `Frequência média elevada: **${frequency.toFixed(1)}** — possível saturação de audiência. Considere novos criativos ou segmentações alternativas.`,
        entity_type: 'client',
        entity_id: clientId,
        kpi_name: 'frequency',
        actual_value: frequency,
        threshold_value: 3.5,
      });
    }
  }
}
