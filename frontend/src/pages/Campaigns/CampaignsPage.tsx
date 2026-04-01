import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { api } from '../../api/client';
import { metricsApi, Metrics } from '../../api/metrics.api';
import { funnelApi } from '../../api/funnel.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { fmtCurrency, fmtPct, fmtNum } from '../../utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Campaign {
  id: number;
  name: string;
  status: string;
  objective: string | null;
  platform: string;
}

interface FunnelRow {
  campaign_id?: number;
  creative_id?: number;
  leads: number;
  mql: number;
  sql: number;
  sales: number;
  revenue: number;
}

interface CreativeRow {
  id: number;
  name: string;
  type: string;
  campaign_id: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  frequency: number;
  ctr: number;
  cpl: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safe(a: number, b: number) { return b > 0 ? a / b : 0; }
function pct(a: number, b: number) { return b > 0 ? (a / b) * 100 : 0; }

type CampaignType = 'WPP' | 'VP' | 'LEAD' | 'FORM' | 'OTHER';

function getCampaignType(name: string): CampaignType {
  const upper = name.toUpperCase();
  if (upper.includes('[WPP]')) return 'WPP';
  if (upper.includes('[VP]'))  return 'VP';
  if (upper.includes('[LEAD]')) return 'LEAD';
  if (upper.includes('[FORM]')) return 'FORM';
  return 'OTHER';
}

const CAMPAIGN_TYPE_META: Record<CampaignType, {
  label: string;
  badge: string;
  costLabel: string;
  costKey: keyof Metrics;
}> = {
  WPP:   { label: 'WhatsApp',    badge: 'bg-green-100 text-green-700',  costLabel: 'Custo/MSG',   costKey: 'cost_per_message' },
  VP:    { label: 'Visita ao Perfil', badge: 'bg-purple-100 text-purple-700', costLabel: 'Custo/Visita', costKey: 'cost_per_profile_visit' },
  LEAD:  { label: 'Lead Ads',    badge: 'bg-brand-100 text-brand-700',  costLabel: 'CPL',         costKey: 'cpl' },
  FORM:  { label: 'Formulário',  badge: 'bg-orange-100 text-orange-700', costLabel: 'CPL',        costKey: 'cpl' },
  OTHER: { label: 'Outros',      badge: 'bg-gray-100 text-gray-600',    costLabel: 'CPL',         costKey: 'cpl' },
};

// ── Status indicator ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { dot: string; bg: string; text: string; label: string }> = {
    active:  { dot: 'bg-success-500', bg: 'bg-success-100', text: 'text-success-700', label: 'Ativo' },
    paused:  { dot: 'bg-warning-500', bg: 'bg-warning-100', text: 'text-warning-700', label: 'Pausado' },
    deleted: { dot: 'bg-danger-500',  bg: 'bg-danger-100',  text: 'text-danger-700',  label: 'Excluído' },
    archived:{ dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500',    label: 'Arquivado' },
  };
  const s = map[status] ?? { dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-500', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Metric pill ───────────────────────────────────────────────────────────────

function MetricPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-[70px] ${highlight ? 'bg-brand-50' : 'bg-gray-50'}`}>
      <span className={`text-base font-bold leading-tight ${highlight ? 'text-brand-700' : 'text-gray-800'}`}>{value}</span>
      <span className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">{label}</span>
    </div>
  );
}

// ── Group Header ──────────────────────────────────────────────────────────────

function GroupHeader({ type, count }: { type: CampaignType; count: number }) {
  const meta = CAMPAIGN_TYPE_META[type];
  return (
    <div className="flex items-center gap-3 mt-5 mb-2 first:mt-0">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${meta.badge}`}>
        [{type === 'OTHER' ? '···' : type}]
      </span>
      <span className="text-xs font-semibold text-gray-500">{meta.label}</span>
      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
      <div className="flex-1 h-px bg-gray-150" style={{ background: 'linear-gradient(to right, #e5e7eb, transparent)' }} />
    </div>
  );
}

// ── Skeleton loading ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
        <div className="h-6 bg-gray-200 rounded-full w-16" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-7 bg-gray-200 rounded w-24" />
        <div className="flex gap-2">
          <div className="h-12 w-16 bg-gray-100 rounded-xl" />
          <div className="h-12 w-16 bg-brand-50 rounded-xl" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="h-3 bg-gray-100 rounded w-20" />
        <div className="h-3 bg-gray-100 rounded w-16" />
        <div className="h-3 bg-gray-100 rounded w-20" />
      </div>
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <tr className="hidden sm:table-row animate-pulse border-b border-gray-100">
      <td className="px-4 py-4">
        <div className="h-4 bg-gray-200 rounded w-56 mb-1.5" />
        <div className="h-3 bg-gray-100 rounded w-32" />
      </td>
      <td className="px-4 py-4"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
      <td className="px-4 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-20 ml-auto" /></td>
      <td className="px-4 py-4 text-right"><div className="h-4 bg-gray-100 rounded w-14 ml-auto" /></td>
      <td className="px-4 py-4 text-right"><div className="h-4 bg-gray-100 rounded w-14 ml-auto" /></td>
      <td className="px-4 py-4 text-right"><div className="h-4 bg-brand-50 rounded w-20 ml-auto" /></td>
      <td className="px-4 py-4"><div className="h-6 bg-gray-100 rounded w-48" /></td>
    </tr>
  );
}

// ── Funnel strip (inline) ─────────────────────────────────────────────────────

function FunnelStrip({ spend, leads, mql, sql, sales }: {
  spend: number; leads: number; mql: number; sql: number; sales: number;
}) {
  const cpl    = safe(spend, leads);
  const cpmql  = safe(spend, mql);
  const cpsql  = safe(spend, sql);
  const cac    = safe(spend, sales);
  const pMql   = pct(mql, leads);
  const pSql   = pct(sql, mql);
  const pVenda = pct(sales, sql);

  const steps = [
    { count: leads, label: 'Leads',  cost: leads > 0 ? fmtCurrency(cpl) : null,   color: 'text-gray-700',   active: leads > 0 },
    { count: mql,   label: 'MQL',    cost: mql > 0   ? fmtCurrency(cpmql) : null, color: 'text-blue-600',   conv: leads > 0 ? fmtPct(pMql) : null, active: mql > 0 },
    { count: sql,   label: 'SQL',    cost: sql > 0   ? fmtCurrency(cpsql) : null, color: 'text-purple-600', conv: mql > 0   ? fmtPct(pSql) : null, active: sql > 0 },
    { count: sales, label: 'Vendas', cost: sales > 0 ? `CAC ${fmtCurrency(cac)}` : null, color: 'text-success-700', conv: sql > 0 ? fmtPct(pVenda) : null, active: sales > 0 },
  ];

  return (
    <div className="flex items-center gap-1 mt-3 flex-wrap">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1">
          {i > 0 && (
            <div className="flex flex-col items-center mx-0.5">
              <span className="text-gray-300 text-sm leading-none">→</span>
              {(steps[i] as typeof steps[0] & { conv?: string | null }).conv && (
                <span className="mt-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">
                  {(steps[i] as typeof steps[0] & { conv?: string | null }).conv}
                </span>
              )}
            </div>
          )}
          <div className={`text-xs rounded-lg px-2 py-1 ${s.active ? 'bg-gray-50' : 'bg-transparent opacity-40'}`}>
            <span className={`font-bold ${s.color}`}>{fmtNum(s.count)}</span>
            <span className="text-gray-400 ml-1">{s.label}</span>
            {s.cost && <span className="text-gray-400 ml-1 hidden sm:inline">· {s.cost}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Funil Geral ───────────────────────────────────────────────────────────────

function FunnelGeral({ spend, leads, mql, sql, sales, revenue }: {
  spend: number; leads: number; mql: number; sql: number; sales: number; revenue: number;
}) {
  const cpl    = safe(spend, leads);
  const cpmql  = safe(spend, mql);
  const cpsql  = safe(spend, sql);
  const cac    = safe(spend, sales);
  const roas   = safe(revenue, spend);
  const pMql   = pct(mql, leads);
  const pSql   = pct(sql, mql);
  const pVenda = pct(sales, sql);

  const steps = [
    { label: 'Leads',  count: leads, cost: cpl,   conv: null,   pctLabel: null,               color: 'text-gray-800',   bg: 'bg-gray-100',   bar: 'bg-gray-400' },
    { label: 'MQL',    count: mql,   cost: cpmql,  conv: pMql,   pctLabel: 'Lead → MQL',       color: 'text-blue-700',   bg: 'bg-blue-50',    bar: 'bg-blue-400' },
    { label: 'SQL',    count: sql,   cost: cpsql,  conv: pSql,   pctLabel: 'MQL → SQL',        color: 'text-purple-700', bg: 'bg-purple-50',  bar: 'bg-purple-400' },
    { label: 'Vendas', count: sales, cost: cac,    conv: pVenda, pctLabel: 'SQL → Venda',      color: 'text-success-700',bg: 'bg-success-100',bar: 'bg-success-500' },
  ];

  const maxCount = Math.max(leads, 1);

  return (
    <Card className="!p-0">
      <div className="px-5 pt-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Funil Geral — Período</span>
          <div className="flex gap-3 flex-wrap">
            {revenue > 0 && (
              <>
                <span className="text-xs font-semibold text-success-700 bg-success-100 px-2 py-1 rounded-full">
                  Receita {fmtCurrency(revenue)}
                </span>
                <span className="text-xs font-semibold text-brand-700 bg-brand-100 px-2 py-1 rounded-full">
                  ROAS {roas.toFixed(2)}x
                </span>
              </>
            )}
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
              Invest. {fmtCurrency(spend)}
            </span>
          </div>
        </div>

        {/* Mobile: stacked list */}
        <div className="block sm:hidden space-y-2">
          {steps.map((s, i) => (
            <div key={s.label}>
              {i > 0 && s.conv !== null && (
                <div className="flex items-center justify-center my-1">
                  <span className="text-gray-300 text-sm mr-1">↓</span>
                  <span className="text-[11px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {fmtPct(s.conv)} conv.
                  </span>
                </div>
              )}
              <div className={`flex items-center justify-between ${s.bg} rounded-xl px-3 py-2.5`}>
                <div>
                  <span className={`text-xl font-extrabold ${s.color}`}>{fmtNum(s.count)}</span>
                  <span className={`ml-2 text-sm font-semibold ${s.color}`}>{s.label}</span>
                </div>
                {s.count > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{s.label === 'Vendas' ? 'CAC' : `C/${s.label}`}</div>
                    <div className={`text-sm font-bold ${s.color}`}>{fmtCurrency(s.cost)}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: horizontal funnel with visible conversion badges */}
        <div className="hidden sm:flex items-end gap-0">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center">
              {i > 0 && (
                <div className="flex flex-col items-center mx-2 mb-3 gap-1">
                  <span className="text-gray-300 text-lg leading-none">→</span>
                  {s.conv !== null && (
                    <span className="text-[11px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {fmtPct(s.conv)}
                    </span>
                  )}
                </div>
              )}
              <div className={`rounded-xl p-3 flex-1 min-w-[110px]`} style={{ background: s.bg.replace('bg-', '') }}>
                <div className={`rounded-xl p-3 ${s.bg}`}>
                  {/* Funnel bar */}
                  <div className="h-1.5 rounded-full bg-gray-200 mb-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.bar} transition-all duration-500`}
                      style={{ width: `${Math.min(100, (s.count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <div className={`text-2xl font-extrabold leading-tight ${s.color}`}>{fmtNum(s.count)}</div>
                  <div className={`text-xs font-bold ${s.color} mt-0.5`}>{s.label}</div>
                  <div className="mt-2 space-y-0.5">
                    {s.pctLabel && s.conv !== null && (
                      <div className="text-xs text-gray-500">
                        {s.pctLabel}: <span className={`font-semibold ${s.color}`}>{fmtPct(s.conv)}</span>
                      </div>
                    )}
                    {s.count > 0 && (
                      <div className="text-xs text-gray-500">
                        {s.label === 'Vendas' ? 'CAC' : `C/${s.label}`}: <span className="font-semibold text-gray-700">{fmtCurrency(s.cost)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── Metrics Summary (tabbed: Mídia / Resultados) ──────────────────────────────

function MetricsSummary({ clientId, dateRange }: { clientId: number; dateRange: { start: string; end: string } }) {
  const [tab, setTab] = useState<'midia' | 'resultados'>('midia');

  const { data: summary } = useQuery({
    queryKey: ['metrics-summary', clientId, dateRange],
    queryFn: () => metricsApi.getClientSummary(clientId, dateRange.start, dateRange.end),
  });

  const m = summary?.metrics;
  if (!m) return null;

  const midia = [
    { label: 'Investimento', value: fmtCurrency(m.spend), highlight: true },
    { label: 'Impressões',   value: fmtNum(m.impressions) },
    { label: 'Alcance',      value: fmtNum(m.reach) },
    { label: 'Frequência',   value: m.frequency.toFixed(2) },
    { label: 'Cliques',      value: fmtNum(m.clicks) },
    { label: 'CTR',          value: fmtPct(m.ctr), highlight: true },
    { label: 'CPM',          value: fmtCurrency(m.cpm) },
    { label: 'CPC',          value: fmtCurrency(m.cpc) },
  ];

  const resultados = [
    { label: 'Leads',        value: fmtNum(m.leads),              highlight: true },
    { label: 'CPL',          value: fmtCurrency(m.cpl),           highlight: true },
    { label: 'Mensagens',    value: fmtNum(m.messages) },
    { label: 'C/Mensagem',   value: fmtCurrency(m.cost_per_message) },
    { label: 'Video Views',  value: fmtNum(m.video_views) },
  ];

  const pills = tab === 'midia' ? midia : resultados;

  return (
    <Card className="!p-0">
      <div className="px-5 pt-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Métricas Gerais — Período</span>
          {/* Tab toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setTab('midia')}
              className={`px-3 py-1 text-xs rounded-md transition-all font-semibold ${
                tab === 'midia' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mídia
            </button>
            <button
              onClick={() => setTab('resultados')}
              className={`px-3 py-1 text-xs rounded-md transition-all font-semibold ${
                tab === 'resultados' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Resultados
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {pills.map(({ label, value, highlight }) => (
            <div
              key={label}
              className={`flex flex-col items-start px-3 py-2 rounded-xl border ${
                highlight
                  ? 'border-brand-200 bg-brand-50'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <span className={`text-sm font-bold leading-tight ${highlight ? 'text-brand-700' : 'text-gray-800'}`}>
                {value}
              </span>
              <span className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── Campaign row (desktop table row / mobile card) ────────────────────────────

function CampaignRow({ campaign, metrics, funnelMap, campaignType }: {
  campaign: Campaign;
  metrics: Metrics;
  dateRange: { start: string; end: string };
  funnelMap: Map<number, FunnelRow>;
  campaignType: CampaignType;
}) {
  const funnel = funnelMap.get(campaign.id);
  const typeMeta = CAMPAIGN_TYPE_META[campaignType];

  const platformColor = (p: string) => {
    if (p === 'meta') return 'bg-blue-100 text-blue-700';
    if (p === 'google') return 'bg-yellow-100 text-yellow-700';
    if (p === 'tiktok') return 'bg-gray-800 text-white';
    return 'bg-gray-100 text-gray-600';
  };

  // Context-aware cost metric value
  const costValue = fmtCurrency((metrics[typeMeta.costKey] as number) ?? 0);

  return (
    <>
      {/* Mobile card */}
      <div className="sm:hidden bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug">{campaign.name}</h3>
            {campaign.objective && (
              <p className="text-xs text-gray-400 mt-0.5">{campaign.objective}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusDot status={campaign.status} />
            <Badge label={campaign.platform} className={platformColor(campaign.platform)} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xl font-extrabold text-gray-900">{fmtCurrency(metrics.spend)}</span>
          <div className="flex gap-2">
            <MetricPill label="CTR" value={fmtPct(metrics.ctr)} />
            <MetricPill label={typeMeta.costLabel} value={costValue} highlight />
          </div>
        </div>
        <div className="text-xs text-gray-400 flex gap-3 flex-wrap">
          <span>CPM {fmtCurrency(metrics.cpm)}</span>
          <span>CPC {fmtCurrency(metrics.cpc)}</span>
          <span>{fmtNum(metrics.impressions)} imp.</span>
        </div>
        <FunnelStrip
          spend={metrics.spend}
          leads={metrics.leads}
          mql={funnel?.mql ?? 0}
          sql={funnel?.sql ?? 0}
          sales={funnel?.sales ?? 0}
        />
      </div>

      {/* Desktop table row */}
      <tr className="hidden sm:table-row group hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
        <td className="px-4 py-3.5 max-w-xs">
          <div className="font-medium text-gray-800 text-sm leading-snug truncate">{campaign.name}</div>
          {campaign.objective && (
            <div className="text-xs text-gray-400 mt-0.5 truncate">{campaign.objective}</div>
          )}
        </td>
        <td className="px-4 py-3.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <StatusDot status={campaign.status} />
            <Badge label={campaign.platform} className={`hidden lg:inline-flex ${platformColor(campaign.platform)}`} />
          </div>
        </td>
        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          <span className="font-bold text-gray-900 text-sm">{fmtCurrency(metrics.spend)}</span>
        </td>
        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          <span className="text-sm text-gray-700">{fmtPct(metrics.ctr)}</span>
        </td>
        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          <span className="text-sm text-gray-700">{fmtCurrency(metrics.cpm)}</span>
        </td>
        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          <span className="text-sm font-semibold text-brand-700">{costValue}</span>
        </td>
        <td className="px-4 py-3.5">
          <FunnelStrip
            spend={metrics.spend}
            leads={metrics.leads}
            mql={funnel?.mql ?? 0}
            sql={funnel?.sql ?? 0}
            sales={funnel?.sales ?? 0}
          />
        </td>
      </tr>
    </>
  );
}

// ── Creative row (desktop table row / mobile card) ────────────────────────────

function CreativeRow({ creative, funnelMap, dateRange }: {
  creative: CreativeRow;
  funnelMap: Map<number, FunnelRow>;
  dateRange: { start: string; end: string };
}) {
  const { data: metrics } = useQuery({
    queryKey: ['creative-metrics', creative.id, dateRange],
    queryFn: () => metricsApi.getCreativeMetrics(creative.id, dateRange.start, dateRange.end),
  });

  const funnel = funnelMap.get(creative.id);
  const spend = metrics?.spend ?? creative.spend;
  const leads = metrics?.leads ?? creative.leads;

  const typeColor = (t: string) => {
    if (t === 'video' || t === 'reel') return 'bg-purple-100 text-purple-700';
    if (t === 'image') return 'bg-green-100 text-green-700';
    if (t === 'carousel') return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <>
      {/* Mobile card */}
      <div className="sm:hidden bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">{creative.name}</h3>
            <div className="text-xs text-gray-400 mt-0.5">
              Freq {(creative.frequency ?? 0).toFixed(1)} · {fmtNum(creative.impressions)} imp.
            </div>
          </div>
          <Badge label={creative.type} className={typeColor(creative.type)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xl font-extrabold text-gray-900">{fmtCurrency(spend)}</span>
          <div className="flex gap-2">
            <MetricPill label="CTR" value={fmtPct(creative.ctr)} />
            <MetricPill label="CPL" value={fmtCurrency(creative.cpl)} highlight />
          </div>
        </div>
        <FunnelStrip
          spend={spend}
          leads={leads}
          mql={funnel?.mql ?? 0}
          sql={funnel?.sql ?? 0}
          sales={funnel?.sales ?? 0}
        />
      </div>

      {/* Desktop table row */}
      <tr className="hidden sm:table-row group hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
        <td className="px-4 py-3.5 max-w-xs">
          <div className="font-medium text-gray-800 text-sm truncate">{creative.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Freq {(creative.frequency ?? 0).toFixed(1)} · {fmtNum(creative.impressions)} imp.
          </div>
        </td>
        <td className="px-4 py-3.5 whitespace-nowrap">
          <Badge label={creative.type} className={typeColor(creative.type)} />
        </td>
        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          <span className="font-bold text-gray-900 text-sm">{fmtCurrency(spend)}</span>
        </td>
        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          <span className="text-sm text-gray-700">{fmtPct(creative.ctr)}</span>
        </td>
        <td className="px-4 py-3.5 text-right whitespace-nowrap" />
        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          <span className="text-sm font-semibold text-brand-700">{fmtCurrency(creative.cpl)}</span>
        </td>
        <td className="px-4 py-3.5">
          <FunnelStrip
            spend={spend}
            leads={leads}
            mql={funnel?.mql ?? 0}
            sql={funnel?.sql ?? 0}
            sales={funnel?.sales ?? 0}
          />
        </td>
      </tr>
    </>
  );
}

// ── Group summary bar ────────────────────────────────────────────────────────

function GroupSummary({ items, type }: {
  items: Array<{ campaign: Campaign; metrics: Metrics }>;
  type: CampaignType;
}) {
  const totSpend       = items.reduce((s, i) => s + (i.metrics.spend        ?? 0), 0);
  const totImpressions = items.reduce((s, i) => s + (i.metrics.impressions  ?? 0), 0);
  const totClicks      = items.reduce((s, i) => s + (i.metrics.clicks       ?? 0), 0);
  const totLeads       = items.reduce((s, i) => s + (i.metrics.leads        ?? 0), 0);
  const totMessages    = items.reduce((s, i) => s + (i.metrics.messages     ?? 0), 0);
  const totVideoViews  = items.reduce((s, i) => s + (i.metrics.video_views  ?? 0), 0);

  const avgCtr  = safe(totClicks, totImpressions) * 100;
  const avgCpm  = safe(totSpend, totImpressions) * 1000;
  const avgFreq = items.reduce((s, i) => s + (i.metrics.frequency ?? 0), 0) / (items.length || 1);

  const pills: { label: string; value: string; highlight?: boolean }[] = [
    { label: 'Total gasto',   value: fmtCurrency(totSpend),          highlight: true },
    { label: 'Impressões',    value: fmtNum(totImpressions) },
    { label: 'CTR médio',     value: fmtPct(avgCtr),                  highlight: true },
    { label: 'CPM médio',     value: fmtCurrency(avgCpm) },
    { label: 'Freq. média',   value: avgFreq.toFixed(2) + 'x' },
  ];

  if (type === 'WPP') {
    pills.push(
      { label: 'Mensagens',     value: fmtNum(totMessages),           highlight: true },
      { label: 'Custo/MSG',     value: fmtCurrency(safe(totSpend, totMessages)), highlight: true },
    );
  } else if (type === 'VP') {
    const totProfileVisits = items.reduce((s, i) => s + ((i.metrics as { profile_visits?: number }).profile_visits ?? 0), 0);
    pills.push(
      { label: 'Visitas ao Perfil', value: fmtNum(totProfileVisits),                          highlight: true },
      { label: 'Custo/Visita',      value: fmtCurrency(safe(totSpend, totProfileVisits)),       highlight: true },
    );
  } else {
    pills.push(
      { label: 'Leads',         value: fmtNum(totLeads),              highlight: true },
      { label: 'CPL médio',     value: fmtCurrency(safe(totSpend, totLeads)), highlight: true },
    );
  }

  const color = type === 'WPP' ? 'bg-green-50 border-green-200' :
                type === 'VP'  ? 'bg-purple-50 border-purple-200' :
                type === 'LEAD'? 'bg-brand-50 border-brand-200' :
                type === 'FORM'? 'bg-orange-50 border-orange-200' :
                                 'bg-gray-50 border-gray-200';

  return (
    <div className={`mt-2 mb-6 rounded-xl border px-4 py-3 ${color}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
        Resumo {CAMPAIGN_TYPE_META[type].label} — {items.length} campanha{items.length > 1 ? 's' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        {pills.map(p => (
          <div key={p.label} className={`flex flex-col items-start px-3 py-1.5 rounded-lg border ${p.highlight ? 'bg-white border-gray-200 shadow-sm' : 'bg-white/60 border-transparent'}`}>
            <span className={`text-sm font-bold leading-tight ${p.highlight ? 'text-gray-900' : 'text-gray-600'}`}>{p.value}</span>
            <span className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Table wrapper ─────────────────────────────────────────────────────────────

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="hidden sm:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-left">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-50 border-b border-gray-200">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest first:px-4 ${i > 1 ? 'text-right' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ── Grouped campaigns rendering ───────────────────────────────────────────────

const TYPE_ORDER: CampaignType[] = ['WPP', 'VP', 'LEAD', 'FORM', 'OTHER'];

function GroupedCampaigns({
  campaignsWithMetrics,
  funnelCampMap,
  dateRange,
}: {
  campaignsWithMetrics: Array<{ campaign: Campaign; metrics: Metrics }>;
  funnelCampMap: Map<number, FunnelRow>;
  dateRange: { start: string; end: string };
}) {
  // Group campaigns by type
  const grouped = new Map<CampaignType, Array<{ campaign: Campaign; metrics: Metrics }>>();
  for (const item of campaignsWithMetrics) {
    const t = getCampaignType(item.campaign.name);
    if (!grouped.has(t)) grouped.set(t, []);
    grouped.get(t)!.push(item);
  }

  // Build dynamic headers per type group for desktop tables
  // We render one DataTable per group with a context-aware cost column header

  return (
    <>
      {TYPE_ORDER.filter(t => grouped.has(t)).map(type => {
        const items = grouped.get(type)!;
        const typeMeta = CAMPAIGN_TYPE_META[type];
        const headers = ['Campanha', 'Status', 'Gasto', 'CTR', 'CPM', typeMeta.costLabel, 'Funil'];

        return (
          <div key={type}>
            <GroupHeader type={type} count={items.length} />

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {items.map(({ campaign, metrics }) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  metrics={metrics}
                  dateRange={dateRange}
                  funnelMap={funnelCampMap}
                  campaignType={type}
                />
              ))}
            </div>

            {/* Desktop table */}
            <DataTable headers={headers}>
              {items.map(({ campaign, metrics }) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  metrics={metrics}
                  dateRange={dateRange}
                  funnelMap={funnelCampMap}
                  campaignType={type}
                />
              ))}
            </DataTable>

            {/* Summary bar */}
            <GroupSummary items={items} type={type} />
          </div>
        );
      })}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const { selectedClientId, dateRange } = useAppStore();
  const [view, setView] = useState<'campaigns' | 'creatives'>('campaigns');

  const { data: campaigns = [], isLoading: loadingCamp } = useQuery({
    queryKey: ['campaigns', selectedClientId],
    queryFn: () => api.get(`/clients/${selectedClientId}/campaigns`).then(r => r.data),
    enabled: !!selectedClientId,
  });

  const { data: funnelByCampaign = [] } = useQuery({
    queryKey: ['funnel-by-campaign', selectedClientId, dateRange],
    queryFn: () => funnelApi.byCampaign(selectedClientId!, dateRange.start, dateRange.end),
    enabled: !!selectedClientId,
  });

  const { data: summary } = useQuery({
    queryKey: ['metrics-summary', selectedClientId, dateRange],
    queryFn: () => metricsApi.getClientSummary(selectedClientId!, dateRange.start, dateRange.end),
    enabled: !!selectedClientId,
  });

  // Pre-fetch all campaign metrics in parallel for sorting
  const campaignMetricsQueries = useQueries({
    queries: (campaigns as Campaign[]).map(c => ({
      queryKey: ['campaign-metrics', c.id, dateRange],
      queryFn: () => metricsApi.getCampaignMetrics(c.id, dateRange.start, dateRange.end),
      enabled: !!selectedClientId && view === 'campaigns',
    })),
  });

  const { data: topCreatives = [], isLoading: loadingCreatives } = useQuery({
    queryKey: ['top-creatives', selectedClientId, dateRange],
    queryFn: () => metricsApi.getTopCreatives(selectedClientId!, dateRange.start, dateRange.end, 50),
    enabled: !!selectedClientId && view === 'creatives',
  });

  const { data: funnelByCreative = [] } = useQuery({
    queryKey: ['funnel-by-creative', selectedClientId, dateRange],
    queryFn: () => funnelApi.byCreative(selectedClientId!, dateRange.start, dateRange.end),
    enabled: !!selectedClientId && view === 'creatives',
  });

  // Build funnel maps
  const funnelCampMap = new Map<number, FunnelRow>(
    (funnelByCampaign as FunnelRow[]).map(f => [f.campaign_id!, f])
  );

  // Build creative funnel map by proportional distribution:
  // If crm_metrics has no creative_id attribution, distribute campaign funnel
  // by each creative's lead share within the campaign.
  const funnelCreativeMapDirect = new Map<number, FunnelRow>(
    (funnelByCreative as FunnelRow[]).map(f => [f.creative_id!, f])
  );

  const creativesTyped = topCreatives as CreativeRow[];

  // Group creatives by campaign_id and sum their leads
  const campLeadTotals = new Map<number, number>();
  for (const cr of creativesTyped) {
    if (cr.campaign_id != null) {
      campLeadTotals.set(cr.campaign_id, (campLeadTotals.get(cr.campaign_id) ?? 0) + (cr.leads || 0));
    }
  }

  // Build final creative funnel map: direct attribution if available, else proportional
  const funnelCreativeMap = new Map<number, FunnelRow>();
  for (const cr of creativesTyped) {
    if (funnelCreativeMapDirect.has(cr.id)) {
      funnelCreativeMap.set(cr.id, funnelCreativeMapDirect.get(cr.id)!);
    } else if (cr.campaign_id != null) {
      const campFunnel = funnelCampMap.get(cr.campaign_id);
      const totalLeads = campLeadTotals.get(cr.campaign_id) ?? 0;
      const share = totalLeads > 0 ? (cr.leads || 0) / totalLeads : 0;
      if (campFunnel && share > 0) {
        funnelCreativeMap.set(cr.id, {
          creative_id: cr.id,
          leads: Math.round(campFunnel.leads * share),
          mql:   Math.round(campFunnel.mql   * share),
          sql:   Math.round(campFunnel.sql    * share),
          sales: Math.round(campFunnel.sales  * share),
          revenue: campFunnel.revenue * share,
        });
      }
    }
  }

  // Aggregate overall funnel totals from all campaigns
  const funnelTotals = (funnelByCampaign as FunnelRow[]).reduce(
    (acc, f) => ({
      mql: acc.mql + (f.mql ?? 0),
      sql: acc.sql + (f.sql ?? 0),
      sales: acc.sales + (f.sales ?? 0),
      revenue: acc.revenue + (f.revenue ?? 0),
    }),
    { mql: 0, sql: 0, sales: 0, revenue: 0 }
  );

  // Combine campaigns with their metrics, filter zero spend, sort by spend desc
  const allMetricsLoaded = campaignMetricsQueries.every(q => !q.isLoading);
  const campaignsWithMetrics = (campaigns as Campaign[])
    .map((c, i) => ({ campaign: c, metrics: campaignMetricsQueries[i]?.data }))
    .filter(({ metrics }) => (metrics?.spend ?? 0) > 0)
    .sort((a, b) => (b.metrics?.spend ?? 0) - (a.metrics?.spend ?? 0)) as Array<{ campaign: Campaign; metrics: Metrics }>;

  // Creatives: filter zero spend, sort by spend desc
  const sortedCreatives = (topCreatives as CreativeRow[])
    .filter(cr => (cr.spend ?? 0) > 0)
    .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));

  if (!selectedClientId) return <EmptyState icon="👆" title="Selecione um cliente" />;

  const isLoading = view === 'campaigns'
    ? (loadingCamp || (campaigns.length > 0 && !allMetricsLoaded))
    : loadingCreatives;

  const creativeHeaders = ['Criativo', 'Tipo', 'Gasto', 'CTR', 'CPM', 'CPL', 'Funil'];

  return (
    <div className="space-y-4">
      {/* Header + view toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {view === 'campaigns' ? 'Campanhas' : 'Criativos'}
          </h1>
          {!isLoading && (
            <p className="text-sm text-gray-400 mt-0.5">
              {view === 'campaigns'
                ? `${campaignsWithMetrics.length} campanha(s) com investimento`
                : `${sortedCreatives.length} criativo(s) com investimento`}
            </p>
          )}
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1 self-start sm:self-auto">
          <button
            onClick={() => setView('campaigns')}
            className={`px-4 py-2 text-sm rounded-lg transition-all font-semibold ${
              view === 'campaigns' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Campanhas
          </button>
          <button
            onClick={() => setView('creatives')}
            className={`px-4 py-2 text-sm rounded-lg transition-all font-semibold ${
              view === 'creatives' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Criativos
          </button>
        </div>
      </div>

      {/* Funil Geral — only on campaigns view */}
      {view === 'campaigns' && summary && (
        <FunnelGeral
          spend={summary.metrics.spend}
          leads={summary.metrics.leads}
          mql={funnelTotals.mql}
          sql={funnelTotals.sql}
          sales={funnelTotals.sales}
          revenue={funnelTotals.revenue}
        />
      )}

      {/* Skeleton loading */}
      {isLoading && (
        <>
          {/* Mobile skeletons */}
          <div className="sm:hidden space-y-3">
            {[1, 2, 3, 4].map(i => (
              <SkeletonCard key={i} />
            ))}
          </div>
          {/* Desktop skeleton table */}
          <div className="hidden sm:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 animate-pulse">
                  {['Campanha', 'Status', 'Gasto', 'CTR', 'CPM', 'CPL', 'Funil'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 ${i > 1 ? 'text-right' : ''}`}>
                      <div className="h-3 bg-gray-200 rounded w-12 inline-block" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => (
                  <SkeletonTableRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Campaigns list — grouped by type */}
      {!isLoading && view === 'campaigns' && (
        <>
          {!campaignsWithMetrics.length ? (
            <EmptyState
              icon="📣"
              title="Nenhuma campanha com investimento"
              description="Sincronize os dados do Meta Ads na página de Clientes."
            />
          ) : (
            <GroupedCampaigns
              campaignsWithMetrics={campaignsWithMetrics}
              funnelCampMap={funnelCampMap}
              dateRange={dateRange}
            />
          )}
        </>
      )}

      {/* Creatives list */}
      {!isLoading && view === 'creatives' && (
        <>
          {!sortedCreatives.length ? (
            <EmptyState
              icon="🎨"
              title="Nenhum criativo com investimento"
              description="Sincronize os dados do Meta Ads na página de Clientes."
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {sortedCreatives.map(cr => (
                  <CreativeRow key={cr.id} creative={cr} funnelMap={funnelCreativeMap} dateRange={dateRange} />
                ))}
              </div>
              {/* Desktop table */}
              <DataTable headers={creativeHeaders}>
                {sortedCreatives.map(cr => (
                  <CreativeRow key={cr.id} creative={cr} funnelMap={funnelCreativeMap} dateRange={dateRange} />
                ))}
              </DataTable>
            </>
          )}
        </>
      )}

      {/* Métricas Gerais — at the bottom */}
      <MetricsSummary clientId={selectedClientId} dateRange={dateRange} />
    </div>
  );
}
