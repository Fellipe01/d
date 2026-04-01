import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { metricsApi, KpiResult, Metrics } from '../../api/metrics.api';
import { alertsApi, Alert } from '../../api/alerts.api';
import { insightsApi } from '../../api/insights.api';
import { clientsApi } from '../../api/clients.api';
import { funnelApi } from '../../api/funnel.api';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import {
  fmtCurrency,
  fmtPct,
  fmtNum,
  fmtDate,
  kpiColor,
  impactColor,
  impactLabel,
  severityColor,
} from '../../utils/formatters';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FunnelSummary = {
  leads: number;
  mql: number;
  sql: number;
  sales: number;
  spend: number;
  cost_per_sale: number;
};

interface KpiCard {
  label: string;
  value: string;
  icon: string;
  /** Optional delta percentage shown as trend arrow */
  delta?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildObjectiveCards(
  objectives: string[],
  m: Metrics,
  funnel: FunnelSummary | null
): KpiCard[] {
  const cards: KpiCard[] = [];

  for (const obj of objectives) {
    switch (obj) {
      case 'leads':
        cards.push({ label: 'Leads', value: fmtNum(m.leads || 0), icon: '🎯' });
        cards.push({
          label: 'CPL',
          value: m.leads > 0 ? fmtCurrency(m.cpl || 0) : '—',
          icon: '📊',
        });
        break;
      case 'whatsapp':
        cards.push({ label: 'Mensagens', value: fmtNum(m.messages || 0), icon: '💬' });
        cards.push({
          label: 'Custo/Mensagem',
          value: m.messages > 0 ? fmtCurrency(m.cost_per_message || 0) : '—',
          icon: '📩',
        });
        break;
      case 'vendas':
        cards.push({ label: 'Vendas', value: fmtNum(funnel?.sales || 0), icon: '🏆' });
        cards.push({
          label: 'Custo/Venda',
          value: (funnel?.sales || 0) > 0 ? fmtCurrency(funnel!.cost_per_sale) : '—',
          icon: '💵',
        });
        break;
      case 'trafego': {
        const hasProfileVisits = (m.profile_visits || 0) > 0;
        cards.push({
          label: hasProfileVisits ? 'Visitas ao Perfil' : 'Cliques',
          value: fmtNum(hasProfileVisits ? m.profile_visits : m.clicks || 0),
          icon: '🔗',
        });
        cards.push({
          label: 'Custo/Visita',
          value: hasProfileVisits
            ? fmtCurrency(m.cost_per_profile_visit || 0)
            : m.clicks > 0 ? fmtCurrency(m.cpc || 0) : '—',
          icon: '🖱️',
        });
        break;
      }
      case 'alcance':
        cards.push({ label: 'Video Views', value: fmtNum(m.video_views || 0), icon: '▶️' });
        cards.push({
          label: 'Custo/View',
          value:
            m.video_views > 0
              ? fmtCurrency((m.spend || 0) / m.video_views)
              : '—',
          icon: '🎬',
        });
        break;
    }
  }

  return cards;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Skeleton card used while metrics are loading */
function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-20 bg-gray-200 rounded" />
        <div className="h-6 w-6 bg-gray-100 rounded" />
      </div>
      <div className="h-7 w-28 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-16 bg-gray-100 rounded" />
    </div>
  );
}

/** Single KPI metric card with optional trend delta */
function KpiCard({ label, value, icon, delta }: KpiCard) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <Card variant="elevated" hoverable accent className="!p-0">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            {label}
          </span>
          <span className="text-lg select-none" aria-hidden="true">
            {icon}
          </span>
        </div>

        <div className="text-2xl sm:text-3xl font-bold text-gray-900 leading-none mb-2">
          {value}
        </div>

        {delta !== undefined ? (
          <div
            className={[
              'inline-flex items-center gap-0.5 text-xs font-semibold',
              isPositive ? 'text-success-700' : isNegative ? 'text-danger-700' : 'text-gray-400',
            ].join(' ')}
          >
            {isPositive && <span aria-hidden="true">▲</span>}
            {isNegative && <span aria-hidden="true">▼</span>}
            {Math.abs(delta).toFixed(1)}% vs período anterior
          </div>
        ) : (
          <div className="h-4" /> /* spacer to keep card height uniform */
        )}
      </div>
    </Card>
  );
}

/** Alerts sidebar panel — shown inline at the top when there are active alerts */
function AlertsPanel({ critAlerts, warnAlerts }: { critAlerts: Alert[]; warnAlerts: Alert[] }) {
  const [expanded, setExpanded] = useState(false);
  const total = critAlerts.length + warnAlerts.length;
  if (total === 0) return null;

  const hasCrit = critAlerts.length > 0;
  const visibleAlerts = expanded
    ? [...critAlerts, ...warnAlerts]
    : [...critAlerts, ...warnAlerts].slice(0, 3);

  return (
    <div
      className={[
        'rounded-xl border p-4',
        hasCrit
          ? 'bg-danger-100 border-red-200'
          : 'bg-warning-100 border-yellow-200',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">{hasCrit ? '🚨' : '⚠️'}</span>
          <span
            className={[
              'font-semibold text-sm',
              hasCrit ? 'text-danger-700' : 'text-warning-700',
            ].join(' ')}
          >
            {hasCrit
              ? `${critAlerts.length} alerta${critAlerts.length > 1 ? 's' : ''} crítico${critAlerts.length > 1 ? 's' : ''}`
              : `${warnAlerts.length} aviso${warnAlerts.length > 1 ? 's' : ''} ativo${warnAlerts.length > 1 ? 's' : ''}`}
          </span>
          {hasCrit && warnAlerts.length > 0 && (
            <span className="text-xs text-warning-700">
              + {warnAlerts.length} aviso{warnAlerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {total > 3 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className={[
              'text-xs font-medium underline underline-offset-2',
              hasCrit ? 'text-danger-700' : 'text-warning-700',
            ].join(' ')}
          >
            {expanded ? 'Ver menos' : `Ver todos (${total})`}
          </button>
        )}
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {visibleAlerts.map((a: Alert) => (
          <div key={a.id} className="flex items-start gap-2">
            <Badge
              label={a.severity === 'critical' ? 'Crítico' : 'Aviso'}
              className={severityColor(a.severity)}
              dot
              variant={a.severity === 'critical' ? 'danger' : 'warning'}
            />
            <span
              className={[
                'text-sm leading-snug',
                a.severity === 'critical' ? 'text-danger-700' : 'text-warning-700',
              ].join(' ')}
            >
              {a.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header component
// ---------------------------------------------------------------------------

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      {description && <p className="text-sm text-gray-400 mt-0.5">{description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { selectedClientId, dateRange } = useAppStore();

  const { data: client } = useQuery({
    queryKey: ['client', selectedClientId],
    queryFn: () => clientsApi.get(selectedClientId!),
    enabled: !!selectedClientId,
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ['metrics-summary', selectedClientId, dateRange],
    queryFn: () =>
      metricsApi.getClientSummary(selectedClientId!, dateRange.start, dateRange.end),
    enabled: !!selectedClientId,
  });

  const { data: timeseries = [] } = useQuery({
    queryKey: ['timeseries', selectedClientId, dateRange],
    queryFn: () =>
      metricsApi.getTimeseries(selectedClientId!, dateRange.start, dateRange.end),
    enabled: !!selectedClientId,
  });

  const { data: topCreatives = [] } = useQuery({
    queryKey: ['top-creatives', selectedClientId, dateRange],
    queryFn: () =>
      metricsApi.getTopCreatives(selectedClientId!, dateRange.start, dateRange.end, 5),
    enabled: !!selectedClientId,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', selectedClientId],
    queryFn: () => alertsApi.list(selectedClientId!),
    enabled: !!selectedClientId,
    refetchInterval: 60000,
  });

  const { data: insights = [] } = useQuery({
    queryKey: ['insights', selectedClientId],
    queryFn: () => insightsApi.list(selectedClientId!, 5),
    enabled: !!selectedClientId,
  });

  const { data: funnel = null } = useQuery({
    queryKey: ['funnel', selectedClientId, dateRange],
    queryFn: () => funnelApi.get(selectedClientId!, dateRange.start, dateRange.end),
    enabled: !!selectedClientId,
  });

  // -------------------------------------------------------------------------
  // Guard: no client selected
  // -------------------------------------------------------------------------

  if (!selectedClientId) {
    return (
      <EmptyState
        icon="👆"
        title="Selecione um cliente"
        description="Escolha um cliente no menu superior para ver o dashboard de desempenho."
      />
    );
  }

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const m = summary?.metrics;
  const kpiResults: KpiResult[] = summary?.kpi_results || [];
  const objectives: string[] = client?.objectives || [];
  const critAlerts = alerts.filter((a: Alert) => a.severity === 'critical');
  const warnAlerts = alerts.filter((a: Alert) => a.severity === 'warning');

  // Base cards always shown
  const baseCards: KpiCard[] = [
    { label: 'Investimento', value: fmtCurrency(m?.spend || 0), icon: '💰' },
    { label: 'Impressões', value: fmtNum(m?.impressions || 0), icon: '👁️' },
    { label: 'CTR', value: fmtPct(m?.ctr || 0), icon: '🖱️' },
    { label: 'Frequência', value: (m?.frequency || 0).toFixed(2), icon: '🔄' },
  ];

  // Objective-based cards
  const objectiveCards = m
    ? buildObjectiveCards(objectives, m, funnel as FunnelSummary | null)
    : [];

  // Fall back to legacy cards if no objectives configured
  const overviewCards: KpiCard[] =
    objectiveCards.length > 0
      ? [...baseCards, ...objectiveCards]
      : [
          ...baseCards,
          { label: 'Leads', value: fmtNum(m?.leads || 0), icon: '🎯' },
          { label: 'CPL', value: fmtCurrency(m?.cpl || 0), icon: '📊' },
          { label: 'Mensagens', value: fmtNum(m?.messages || 0), icon: '💬' },
          { label: 'CPC', value: fmtCurrency(m?.cpc || 0), icon: '📈' },
        ];

  const creativeRows = topCreatives as {
    id: number;
    name: string;
    type: string;
    campaign_name: string | null;
    spend: number;
    ctr: number;
    cpl: number;
    leads: number;
    messages: number;
    cost_per_message: number;
    frequency: number;
  }[];

  const insightRows = insights as {
    id: number;
    summary: string | null;
    impact_level: string;
    category: string;
    generated_at: string;
  }[];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-8 pb-8">

      {/* ── Alerts panel (full-width, top of page) ── */}
      <AlertsPanel critAlerts={critAlerts} warnAlerts={warnAlerts} />

      {/* ── KPI Overview ── */}
      <section>
        <SectionHeader
          title="Visão Geral"
          description={`${fmtDate(dateRange.start)} — ${fmtDate(dateRange.end)}`}
        />

        {isLoading ? (
          /* Skeleton grid while loading */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {overviewCards.map(card => (
              <KpiCard key={card.label} {...card} />
            ))}
          </div>
        )}
      </section>

      {/* ── Spend Trend + Top Creatives ── */}
      {/* Decision: side-by-side on lg+ because they are both "performance evidence"
          and complement each other visually. The chart gives temporal context; the
          creatives list gives attribution. Together they answer "how did we spend and
          what drove it?" without requiring tab-switching. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Spend trend chart */}
        <Card
          title="Evolução do Investimento"
          subtitle={`${fmtDate(dateRange.start)} a ${fmtDate(dateRange.end)}`}
          variant="elevated"
          accent
        >
          {timeseries.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={
                  timeseries as { date: string; spend: number; leads: number }[]
                }
              >
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={v => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={v => `R$${v}`}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
                    fontSize: '12px',
                  }}
                  formatter={(v: number, name: string) => [
                    name === 'spend' ? fmtCurrency(v) : fmtNum(v),
                    name === 'spend' ? 'Gasto' : 'Leads',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="spend"
                  stroke="#4f46e5"
                  fill="url(#spendGradient)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#4f46e5' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Top Creatives */}
        {creativeRows.length > 0 ? (
          <Card title="Top Criativos" variant="elevated" accent>
            <div className="space-y-3">
              {creativeRows.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* Rank badge */}
                  <div className="w-6 h-6 flex items-center justify-center rounded-full bg-brand-100 text-brand-600 text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {c.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 space-x-1.5">
                      <span>{fmtCurrency(c.spend)}</span>
                      <span className="text-gray-300">·</span>
                      <span>CTR {fmtPct(c.ctr)}</span>
                      <span className="text-gray-300">·</span>
                      {c.campaign_name?.toUpperCase().includes('[WPP]') ? (
                        <span>C/MSG {fmtCurrency(c.cost_per_message)}</span>
                      ) : (
                        <span>CPL {fmtCurrency(c.cpl)}</span>
                      )}
                      <span className="text-gray-300">·</span>
                      <span>Freq {c.frequency?.toFixed(1)}</span>
                    </div>
                  </div>

                  <Badge
                    label={c.type}
                    className="bg-gray-100 text-gray-600 capitalize"
                  />
                </div>
              ))}
            </div>
          </Card>
        ) : (
          /* Keep the grid balanced even when there are no creatives */
          <Card variant="bordered">
            <EmptyState
              icon="🎨"
              title="Sem criativos"
              description="Nenhum criativo com dados no período selecionado."
            />
          </Card>
        )}
      </section>

      {/* ── KPIs vs Metas ── */}
      {kpiResults.length > 0 && (
        <section>
          <SectionHeader title="KPIs vs Metas" />
          <Card variant="elevated">
            <div className="divide-y divide-gray-100">
              {kpiResults.map(r => (
                <div key={r.kpi_name} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-gray-700 truncate">
                        {r.kpi_name}
                      </span>
                      <Badge
                        label={
                          r.status === 'on_target'
                            ? 'No alvo'
                            : r.status === 'warning'
                            ? 'Atenção'
                            : 'Fora da meta'
                        }
                        variant={
                          r.status === 'on_target'
                            ? 'success'
                            : r.status === 'warning'
                            ? 'warning'
                            : 'danger'
                        }
                        dot
                      />
                    </div>
                    <span className="text-xs text-gray-400 ml-4 flex-shrink-0">
                      {r.delta_pct > 0 ? '+' : ''}
                      {r.delta_pct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 mb-1.5">
                    Meta: {r.target.toFixed(2)} · Real: {r.actual.toFixed(2)}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={[
                        'h-full rounded-full transition-all duration-500',
                        r.status === 'on_target'
                          ? 'bg-success-500'
                          : r.status === 'warning'
                          ? 'bg-warning-500'
                          : 'bg-danger-500',
                      ].join(' ')}
                      style={{ width: `${Math.min(r.raw_score * 50, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* ── Recent Insights ── */}
      {insightRows.length > 0 && (
        <section>
          <SectionHeader
            title="Insights Recentes"
            description="Análises geradas automaticamente por IA"
          />
          <Card variant="elevated">
            <div className="space-y-3">
              {insightRows.map(ins => (
                <div
                  key={ins.id}
                  className="flex items-start gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <Badge
                    label={impactLabel(ins.impact_level)}
                    className={impactColor(ins.impact_level)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {ins.summary || '(ver insight completo)'}
                    </p>
                    <div className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5">
                      <span>{ins.category}</span>
                      <span className="text-gray-300">·</span>
                      <span>
                        {new Date(ins.generated_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
