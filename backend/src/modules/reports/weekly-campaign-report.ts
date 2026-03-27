import { supabase } from '../../config/supabase';

// ── Tipos de campanha ─────────────────────────────────────────────────────────

type CampType = 'leads' | 'whatsapp' | 'traffic' | 'other';

function detectType(objective: string | null): CampType {
  const o = (objective ?? '').toUpperCase();
  if (o.includes('LEAD')) return 'leads';
  if (o.includes('MESSAGE') || o.includes('WPP') || o.includes('WHATSAPP')) return 'whatsapp';
  if (o.includes('TRAFFIC') || o.includes('LINK_CLICK') || o.includes('REACH') ||
      o.includes('AWARENESS') || o.includes('PAGE_LIKE') || o.includes('PROFILE')) return 'traffic';
  return 'other';
}

// Extrai tag entre colchetes do nome da campanha, ex: "Lima [FORMS] - Tráfego" → "FORMS"
function extractNameTag(campName: string): string | null {
  const match = campName.match(/\[([^\]]+)\]/);
  return match ? match[1].toUpperCase() : null;
}

function typeLabel(campName: string, t: CampType): string {
  // Prioridade: tag do nome da campanha
  const nameTag = extractNameTag(campName);
  if (nameTag) return nameTag;
  // Fallback pelo tipo detectado
  if (t === 'leads')    return 'FORMS';
  if (t === 'whatsapp') return 'WPP';
  if (t === 'traffic')  return 'VP';
  return '';
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(v: number) {
  return v.toLocaleString('pt-BR');
}

// ── Geração do relatório ──────────────────────────────────────────────────────

export async function generateWeeklyCampaignReport(
  clientId: number,
  start: string,
  end: string,
): Promise<string> {
  // Busca cliente
  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .maybeSingle();
  const clientName = client?.name ?? `Cliente ${clientId}`;

  // Busca campanhas
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, objective, status')
    .eq('client_id', clientId);

  if (!campaigns?.length) return `Relatório de Campanha ${clientName}\n\nNenhuma campanha encontrada.`;

  // Busca métricas de cada campanha no período
  const campIds = campaigns.map((c: { id: number }) => c.id);
  const { data: metricsRows } = await supabase
    .from('metrics_daily')
    .select('entity_id,spend,impressions,reach,clicks,leads,messages,followers')
    .eq('entity_type', 'campaign')
    .in('entity_id', campIds)
    .gte('date', start)
    .lte('date', end);

  // Busca MQL por campanha
  const { data: funnelRows } = await supabase
    .from('crm_metrics')
    .select('campaign_id,mql,sql_count,sales')
    .eq('client_id', clientId)
    .gte('date', start)
    .lte('date', end)
    .not('campaign_id', 'is', null);

  // Agrega métricas por campanha
  type CampAgg = {
    spend: number; reach: number; impressions: number;
    clicks: number; leads: number; messages: number; followers: number;
    mql: number; sql: number; sales: number;
  };
  const metricsMap = new Map<number, CampAgg>();
  for (const r of (metricsRows || []) as Array<{ entity_id: number } & CampAgg>) {
    const e = metricsMap.get(r.entity_id) ?? { spend: 0, reach: 0, impressions: 0, clicks: 0, leads: 0, messages: 0, followers: 0, mql: 0, sql: 0, sales: 0 };
    e.spend      += r.spend      || 0;
    e.reach      += r.reach      || 0;
    e.impressions += r.impressions || 0;
    e.clicks     += r.clicks     || 0;
    e.leads      += r.leads      || 0;
    e.messages   += r.messages   || 0;
    e.followers  += r.followers  || 0;
    metricsMap.set(r.entity_id, e);
  }
  for (const f of (funnelRows || []) as Array<{ campaign_id: number; mql: number; sql_count: number; sales: number }>) {
    const e = metricsMap.get(f.campaign_id);
    if (e) {
      e.mql   += f.mql       || 0;
      e.sql   += f.sql_count || 0;
      e.sales += f.sales     || 0;
    }
  }

  // Formata data para exibição
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}`;
  };
  const period = `${fmt(start)} a ${fmt(end)}`;

  // Agrupa campanhas por tipo e gera blocos
  const blocks: string[] = [];

  for (const camp of campaigns as Array<{ id: number; name: string; objective: string | null; status: string }>) {
    const m = metricsMap.get(camp.id);
    if (!m || m.spend === 0) continue; // ignora campanhas sem investimento no período

    const tipo = detectType(camp.objective);
    const tag  = typeLabel(camp.name, tipo);
    const header = tag
      ? `Relatório de Campanha ${clientName} [${tag}] – (${period})`
      : `Relatório de Campanha ${clientName} – (${period})`;

    const lines: string[] = [header];

    if (tipo === 'leads') {
      lines.push(`👥 Alcance: ${fmtNum(m.reach)}`);
      lines.push(`📌 Leads Gerados: ${fmtNum(m.leads)}`);
      if (m.mql > 0) lines.push(`📌 MQLs Gerados: ${fmtNum(m.mql)}`);
      if (m.sql > 0) lines.push(`📌 SQLs Gerados: ${fmtNum(m.sql)}`);
      if (m.sales > 0) lines.push(`🏆 Vendas: ${fmtNum(m.sales)}`);
      lines.push(`💰 Total Investido: ${fmtBRL(m.spend)}`);
      if (m.leads > 0) lines.push(`🏆 Custo Médio por Lead (CPL): ${fmtBRL(m.spend / m.leads)}`);
      if (m.mql > 0)   lines.push(`🏆 Custo Médio por MQL (CPMQL): ${fmtBRL(m.spend / m.mql)}`);
    } else if (tipo === 'whatsapp') {
      lines.push(`👥 Alcance: ${fmtNum(m.reach)}`);
      lines.push(`📌 Mensagens Geradas: ${fmtNum(m.messages)}`);
      lines.push(`💰 Total Investido: ${fmtBRL(m.spend)}`);
      if (m.messages > 0) lines.push(`🏆 Custo Médio por Mensagem: ${fmtBRL(m.spend / m.messages)}`);
    } else if (tipo === 'traffic') {
      lines.push(`👥 Alcance: ${fmtNum(m.reach)}`);
      if (m.clicks > 0)    lines.push(`👥 Visitas ao perfil: ${fmtNum(m.clicks)}`);
      if (m.followers > 0) lines.push(`📌 Seguidores: ${fmtNum(m.followers)}`);
      lines.push(`💰 Total Investido: ${fmtBRL(m.spend)}`);
      if (m.followers > 0) lines.push(`🏆 Custo Médio por Seguidor (CPS): ${fmtBRL(m.spend / m.followers)}`);
      else if (m.clicks > 0) lines.push(`🏆 Custo por Visita: ${fmtBRL(m.spend / m.clicks)}`);
    } else {
      lines.push(`👥 Alcance: ${fmtNum(m.reach)}`);
      lines.push(`🖱️ Cliques: ${fmtNum(m.clicks)}`);
      lines.push(`💰 Total Investido: ${fmtBRL(m.spend)}`);
    }

    blocks.push(lines.join('\n'));
  }

  return blocks.length > 0
    ? blocks.join('\n\n---\n\n')
    : `Relatório de Campanha ${clientName} – (${period})\n\nNenhuma campanha com investimento no período.`;
}
