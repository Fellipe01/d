import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { api } from '../../api/client';
import { metricsApi } from '../../api/metrics.api';
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

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-2">
      {/* Leads */}
      <div className="flex items-center gap-1">
        <span className="font-semibold text-gray-700">{fmtNum(leads)}</span>
        <span className="text-gray-400">Leads</span>
        {leads > 0 && <span className="text-gray-400">({fmtCurrency(cpl)})</span>}
      </div>
      <span className="text-gray-300">→</span>

      {/* MQL */}
      <div className="flex items-center gap-1">
        <span className={`font-semibold ${mql > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{fmtNum(mql)}</span>
        <span className="text-gray-400">MQL</span>
        {leads > 0 && <span className="text-gray-400">({fmtPct(pMql)})</span>}
        {mql > 0 && <span className="text-gray-400 ml-1">· {fmtCurrency(cpmql)}</span>}
      </div>
      <span className="text-gray-300">→</span>

      {/* SQL */}
      <div className="flex items-center gap-1">
        <span className={`font-semibold ${sql > 0 ? 'text-purple-600' : 'text-gray-300'}`}>{fmtNum(sql)}</span>
        <span className="text-gray-400">SQL</span>
        {mql > 0 && <span className="text-gray-400">({fmtPct(pSql)})</span>}
        {sql > 0 && <span className="text-gray-400 ml-1">· {fmtCurrency(cpsql)}</span>}
      </div>
      <span className="text-gray-300">→</span>

      {/* Venda */}
      <div className="flex items-center gap-1">
        <span className={`font-semibold ${sales > 0 ? 'text-green-600' : 'text-gray-300'}`}>{fmtNum(sales)}</span>
        <span className="text-gray-400">Vendas</span>
        {sql > 0 && <span className="text-gray-400">({fmtPct(pVenda)})</span>}
        {sales > 0 && <span className="text-gray-400 ml-1">· CAC {fmtCurrency(cac)}</span>}
      </div>
    </div>
  );
}

// ── Summary metrics bar ────────────────────────────────────────────────────────

function MetricsSummary({ clientId, dateRange }: { clientId: number; dateRange: { start: string; end: string } }) {
  const [showSecondary, setShowSecondary] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ['metrics-summary', clientId, dateRange],
    queryFn: () => metricsApi.getClientSummary(clientId, dateRange.start, dateRange.end),
  });

  const m = summary?.metrics;
  if (!m) return null;

  const primary = [
    { label: 'Investimento', value: fmtCurrency(m.spend) },
    { label: 'Impressões',   value: fmtNum(m.impressions) },
    { label: 'Alcance',      value: fmtNum(m.reach) },
    { label: 'Frequência',   value: m.frequency.toFixed(2) },
    { label: 'Cliques',      value: fmtNum(m.clicks) },
    { label: 'CTR',          value: fmtPct(m.ctr) },
    { label: 'CPM',          value: fmtCurrency(m.cpm) },
    { label: 'CPC',          value: fmtCurrency(m.cpc) },
    { label: 'Leads',        value: fmtNum(m.leads) },
    { label: 'CPL',          value: fmtCurrency(m.cpl) },
  ];

  const secondary = [
    { label: 'Mensagens',       value: fmtNum(m.messages) },
    { label: 'C/Mensagem',      value: fmtCurrency(m.cost_per_message) },
    { label: 'Seguidores',      value: fmtNum(m.followers) },
    { label: 'C/Seguidor',      value: fmtCurrency(m.cost_per_follower) },
    { label: 'Video Views',     value: fmtNum(m.video_views) },
  ];

  return (
    <Card className="!p-0">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Métricas Gerais — Período</span>
          <button
            onClick={() => setShowSecondary(s => !s)}
            className="text-xs text-brand-600 hover:underline">
            {showSecondary ? '▲ Ocultar secundárias' : '▼ Ver métricas secundárias'}
          </button>
        </div>

        {/* Primary */}
        <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
          {primary.map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs text-gray-400">{label}</div>
              <div className="text-sm font-semibold text-gray-800">{value}</div>
            </div>
          ))}
        </div>

        {/* Secondary */}
        {showSecondary && (
          <div className="grid grid-cols-5 md:grid-cols-10 gap-3 mt-3 pt-3 border-t border-gray-100">
            {secondary.map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs text-gray-400">{label}</div>
                <div className="text-sm font-semibold text-gray-800">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Campaign row ───────────────────────────────────────────────────────────────

function CampaignRow({ campaign, dateRange, funnelMap }: {
  campaign: Campaign;
  dateRange: { start: string; end: string };
  funnelMap: Map<number, FunnelRow>;
}) {
  const { data: metrics } = useQuery({
    queryKey: ['campaign-metrics', campaign.id, dateRange],
    queryFn: () => metricsApi.getCampaignMetrics(campaign.id, dateRange.start, dateRange.end),
  });

  const funnel = funnelMap.get(campaign.id);
  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-success-100 text-success-700';
    if (s === 'paused') return 'bg-warning-100 text-warning-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <Card className="!p-0">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          {/* Left: name + badges */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-gray-800 text-sm">{campaign.name}</h3>
              <Badge label={campaign.status} className={statusColor(campaign.status)} />
              <Badge label={campaign.platform} className="bg-blue-100 text-blue-700" />
            </div>
            {campaign.objective && <div className="text-xs text-gray-400 mt-0.5">{campaign.objective}</div>}
          </div>

          {/* Right: spend + top metrics */}
          {metrics && (
            <div className="text-right shrink-0">
              <div className="font-semibold text-gray-800 text-sm">{fmtCurrency(metrics.spend)}</div>
              <div className="text-xs text-gray-500">
                CTR {fmtPct(metrics.ctr)} · CPM {fmtCurrency(metrics.cpm)} · CPC {fmtCurrency(metrics.cpc)}
              </div>
            </div>
          )}
        </div>

        {/* Funnel strip */}
        {metrics && (
          <FunnelStrip
            spend={metrics.spend}
            leads={metrics.leads}
            mql={funnel?.mql ?? 0}
            sql={funnel?.sql ?? 0}
            sales={funnel?.sales ?? 0}
          />
        )}
      </div>
    </Card>
  );
}

// ── Creative row ───────────────────────────────────────────────────────────────

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
    <Card className="!p-0">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-gray-800 text-sm truncate max-w-xs">{creative.name}</h3>
              <Badge label={creative.type} className={typeColor(creative.type)} />
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Freq {creative.frequency?.toFixed(1)} · Impressões {fmtNum(creative.impressions)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold text-gray-800 text-sm">{fmtCurrency(spend)}</div>
            <div className="text-xs text-gray-500">
              CTR {fmtPct(creative.ctr)} · CPL {fmtCurrency(creative.cpl)}
            </div>
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
    </Card>
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

  const funnelCampMap = new Map<number, FunnelRow>(
    (funnelByCampaign as FunnelRow[]).map(f => [f.campaign_id!, f])
  );
  const funnelCreativeMap = new Map<number, FunnelRow>(
    (funnelByCreative as FunnelRow[]).map(f => [f.creative_id!, f])
  );

  if (!selectedClientId) return <EmptyState icon="👆" title="Selecione um cliente" />;

  const isLoading = view === 'campaigns' ? loadingCamp : loadingCreatives;

  return (
    <div className="space-y-4">
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">
          {view === 'campaigns' ? 'Campanhas' : 'Criativos'}
        </h2>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setView('campaigns')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${view === 'campaigns' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
            📣 Campanhas
          </button>
          <button
            onClick={() => setView('creatives')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${view === 'creatives' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
            🎨 Criativos
          </button>
        </div>
      </div>

      {/* Metrics summary */}
      <MetricsSummary clientId={selectedClientId} dateRange={dateRange} />

      {/* List */}
      {isLoading && <div className="text-gray-500 text-sm">Carregando...</div>}

      {!isLoading && view === 'campaigns' && (
        <>
          {!(campaigns as Campaign[]).length
            ? <EmptyState icon="📣" title="Nenhuma campanha encontrada" description="Carregue dados mock na página de Clientes." />
            : <div className="space-y-2">
                {(campaigns as Campaign[]).map(camp => (
                  <CampaignRow key={camp.id} campaign={camp} dateRange={dateRange} funnelMap={funnelCampMap} />
                ))}
              </div>
          }
        </>
      )}

      {!isLoading && view === 'creatives' && (
        <>
          {!(topCreatives as CreativeRow[]).length
            ? <EmptyState icon="🎨" title="Nenhum criativo encontrado" description="Carregue dados mock na página de Clientes." />
            : <div className="space-y-2">
                {(topCreatives as CreativeRow[]).map(cr => (
                  <CreativeRow key={cr.id} creative={cr} funnelMap={funnelCreativeMap} dateRange={dateRange} />
                ))}
              </div>
          }
        </>
      )}
    </div>
  );
}
