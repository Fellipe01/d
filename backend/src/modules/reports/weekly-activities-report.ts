import { supabase } from '../../config/supabase';

const TYPE_LABEL: Record<string, string> = {
  budget_change:    '💰 Alteração de Orçamento',
  creative_pause:   '⏸️  Criativo Pausado',
  creative_launch:  '🚀 Criativo Lançado',
  campaign_pause:   '⏸️  Campanha Pausada',
  campaign_launch:  '🚀 Campanha Lançada',
  kpi_update:       '🎯 Atualização de KPI',
  note:             '📝 Nota',
  meeting:          '🤝 Reunião',
  optimization:     '⚙️  Otimização',
};

function fmtDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

// ── Gera o relatório de atividades da semana (sem IA) ────────────────────────

export async function generateWeeklyActivitiesReport(
  clientId: number,
  start: string,
  end: string,
): Promise<string> {
  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .maybeSingle();
  const clientName = client?.name ?? `Cliente ${clientId}`;

  const { data: activities, error } = await supabase
    .from('activities')
    .select('id, activity_type, description, executed_at, executed_by, campaign_id, creative_id')
    .eq('client_id', clientId)
    .gte('executed_at', `${start}T00:00:00`)
    .lte('executed_at', `${end}T23:59:59`)
    .is('archived_at', null)
    .order('executed_at', { ascending: true });

  if (error) throw error;

  const list = activities || [];
  const period = `${fmtDate(start)} a ${fmtDate(end)}`;

  if (!list.length) {
    return `Relatório de Atividades — ${clientName}\nSemana: ${period}\n\nNenhuma atividade registrada nesta semana.`;
  }

  const lines: string[] = [
    `Relatório de Atividades — ${clientName}`,
    `Semana: ${period}`,
    `Total de atividades: ${list.length}`,
    '',
  ];

  // Agrupa por tipo
  const byType = new Map<string, typeof list>();
  for (const a of list as Array<{ id: number; activity_type: string; description: string; executed_at: string; executed_by: string; campaign_id: number | null; creative_id: number | null }>) {
    const group = byType.get(a.activity_type) ?? [];
    group.push(a);
    byType.set(a.activity_type, group);
  }

  for (const [type, items] of byType) {
    lines.push(`${TYPE_LABEL[type] ?? type} (${items.length})`);
    for (const a of items as Array<{ description: string; executed_at: string; executed_by: string }>) {
      lines.push(`  • ${a.description}`);
      lines.push(`    ${fmtDate(a.executed_at)} — ${a.executed_by}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Arquiva atividades de semanas anteriores ─────────────────────────────────
// Chamado após gerar o relatório de sexta: arquiva tudo com executed_at < início da semana atual

export async function archivePreviousWeekActivities(
  clientId: number,
  currentWeekStart: string,
): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .update({ archived_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .lt('executed_at', `${currentWeekStart}T00:00:00`)
    .is('archived_at', null);

  if (error) {
    console.error(`[Scheduler] Erro ao arquivar atividades do cliente ${clientId}:`, error);
  } else {
    console.log(`[Scheduler] Atividades anteriores a ${currentWeekStart} arquivadas para cliente ${clientId}`);
  }
}
