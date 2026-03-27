import { Client, ClientKpi } from '../../clients/clients.types';
import { AggregatedMetrics } from '../../metrics/metrics.repository';
import { KpiResult } from '../../../shared/utils/kpi-evaluator';
import { formatBR } from '../../../shared/utils/date';

interface TopCreative {
  id: number;
  name: string;
  type: string;
  spend: number;
  leads: number;
  ctr: number;
  cpl: number;
  frequency: number;
}

interface CrmSummary {
  leads: number;
  mql: number;
  sql: number;
  sales: number;
  revenue: number;
  cost_per_mql: number;
  cost_per_sql: number;
  cost_per_sale: number;
  lead_to_mql_rate: number;
  mql_to_sql_rate: number;
  sql_to_sale_rate: number;
}

interface AlertSummary {
  alert_type: string;
  severity: string;
  message: string;
}

export interface WeeklyReportContext {
  client: Client;
  kpis: ClientKpi[];
  periodStart: string;
  periodEnd: string;
  metrics: AggregatedMetrics;
  kpiResults: KpiResult[];
  topCreatives: TopCreative[];
  crmSummary: CrmSummary | null;
  alerts: AlertSummary[];
  reportType: 'weekly_mon' | 'weekly_wed' | 'weekly_fri' | 'manual';
}

export function buildWeeklyReportPrompt(ctx: WeeklyReportContext): string {
  const { client, kpis, metrics, kpiResults, topCreatives, crmSummary, alerts, reportType } = ctx;
  const periodLabel = `${formatBR(ctx.periodStart)} a ${formatBR(ctx.periodEnd)}`;

  const kpiTable = kpiResults.map(r =>
    `- **${r.kpi_name}**: Meta ${r.target.toFixed(2)} | Real ${r.actual.toFixed(2)} | Δ ${r.delta_pct.toFixed(1)}% | Status: ${r.status}`
  ).join('\n');

  const creativesTable = topCreatives.slice(0, 5).map((c, i) =>
    `${i + 1}. **${c.name}** (${c.type}) — Gasto: R$${c.spend.toFixed(2)} | CTR: ${c.ctr.toFixed(2)}% | CPL: R$${c.cpl.toFixed(2)} | Freq: ${c.frequency.toFixed(1)} | Leads: ${c.leads}`
  ).join('\n');

  const funnelSection = crmSummary ? `
## Dados do Funil (CRM)
- Leads: **${crmSummary.leads}** | MQL: **${crmSummary.mql}** (${crmSummary.lead_to_mql_rate.toFixed(1)}%) | SQL: **${crmSummary.sql}** (${crmSummary.mql_to_sql_rate.toFixed(1)}%) | Vendas: **${crmSummary.sales}** (${crmSummary.sql_to_sale_rate.toFixed(1)}%)
- Custo por MQL: R$${crmSummary.cost_per_mql.toFixed(2)} | Custo por SQL: R$${crmSummary.cost_per_sql.toFixed(2)} | Custo por Venda: R$${crmSummary.cost_per_sale.toFixed(2)}
- Receita total estimada: R$${crmSummary.revenue.toFixed(2)}` : '';

  const alertsSection = alerts.length > 0 ? `
## Alertas Ativos (${alerts.length})
${alerts.map(a => `- [${a.severity.toUpperCase()}] ${a.message}`).join('\n')}` : '';

  const typeLabel = {
    weekly_mon: 'Relatório Semanal (Segunda-feira) — Semana anterior',
    weekly_wed: 'Relatório de Inteligência (Quarta-feira) — Semana atual',
    weekly_fri: 'Relatório de Atividades (Sexta-feira)',
    manual: 'Relatório Manual',
  }[reportType];

  return `# ${typeLabel}
**Cliente:** ${client.name}
**Período:** ${periodLabel}
**Objetivos:** ${client.objectives.join(', ') || 'Não definidos'}
**Budget Mensal:** ${client.monthly_budget ? `R$${client.monthly_budget.toFixed(2)}` : 'Não informado'}

## Métricas do Período
- **Gasto:** R$${metrics.spend.toFixed(2)}
- **Impressões:** ${metrics.impressions.toLocaleString('pt-BR')}
- **Alcance:** ${metrics.reach.toLocaleString('pt-BR')}
- **Frequência:** ${metrics.frequency.toFixed(2)}
- **Cliques:** ${metrics.clicks.toLocaleString('pt-BR')}
- **CTR:** ${metrics.ctr.toFixed(2)}%
- **CPC:** R$${metrics.cpc.toFixed(2)}
- **CPM:** R$${metrics.cpm.toFixed(2)}
- **Leads:** ${metrics.leads}
- **CPL:** R$${metrics.cpl.toFixed(2)}
- **Mensagens:** ${metrics.messages}
- **Custo por Mensagem:** R$${metrics.cost_per_message.toFixed(2)}

## Desempenho vs KPIs
${kpiTable || 'Nenhum KPI configurado para este cliente.'}
${funnelSection}

## Top 5 Criativos
${creativesTable || 'Dados insuficientes de criativos.'}
${alertsSection}

---
${reportType === 'manual' ? `TAREFA: Gere um resumo rápido do desempenho desta semana para este cliente.

Seja direto e conciso. Inclua apenas:
1. Resumo executivo (máximo 2 frases)
2. Principais números do período (o que se destacou positiva ou negativamente)
3. Top criativos da semana
4. Análise do funil se houver dados de CRM
5. Até 3 próximos passos prioritários
6. Classificação do impacto geral (crítico/alto/médio/baixo)

Não faça comparação temporal. Foque apenas no período informado.` : `TAREFA: Gere uma análise completa de desempenho para este cliente considerando o tipo de relatório (${typeLabel}).

Para relatório de quarta-feira: aplique obrigatoriamente a comparação temporal 7d vs 14d vs 30d conforme as regras do system prompt. Foque no que está chamando atenção na semana atual, sinais de saturação, criativos em destaque, e otimizações recomendadas imediatamente.

Inclua obrigatoriamente:
1. Resumo executivo (máximo 3 frases)
2. Evolução (7d vs 14d vs 30d)
3. Análise de desempenho de mídia por tipo de campanha
4. Análise de criativos com diagnóstico de saturação
5. Análise do funil (se houver dados de CRM)
6. Fatores de risco
7. Próximos passos priorizados (numerados, específicos, com impacto estimado)
8. Classificação do impacto geral (crítico/alto/médio/baixo)`}`;
}
