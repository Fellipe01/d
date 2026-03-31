import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { metricsApi } from '../../api/metrics.api';
import { clientsApi, type ClientKpi } from '../../api/clients.api';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { fmtCurrency, fmtPct, fmtNum } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Health logic — combines saturation (frequency/CTR) + cost performance (KPI)
// ---------------------------------------------------------------------------

type HealthState = {
  borderClass: string;
  badgeVariant: 'success' | 'warning' | 'danger';
  label: string;
  dotClass: string;
};

/** Severity rank: higher = worse */
function severityRank(v: HealthState['badgeVariant']): number {
  return v === 'danger' ? 2 : v === 'warning' ? 1 : 0;
}

function saturationHealth(frequency: number, ctr: number): HealthState {
  if (frequency >= 5.0 || (ctr < 0.5 && frequency >= 2.5)) {
    return { borderClass: 'border-l-danger-500', badgeVariant: 'danger', label: 'Saturado', dotClass: 'bg-danger-500' };
  }
  if (frequency >= 3.5) {
    return { borderClass: 'border-l-warning-500', badgeVariant: 'warning', label: 'Saturando', dotClass: 'bg-warning-500' };
  }
  if (frequency >= 2.5) {
    return { borderClass: 'border-l-yellow-400', badgeVariant: 'warning', label: 'Atenção Freq.', dotClass: 'bg-yellow-400' };
  }
  return { borderClass: 'border-l-success-500', badgeVariant: 'success', label: 'Saudável', dotClass: 'bg-success-500' };
}

function costHealth(actualCost: number, kpis: ClientKpi[], kpiName: string): HealthState | null {
  if (actualCost <= 0) return null;
  const kpi = kpis.find(k => k.kpi_name === kpiName);
  if (!kpi || !kpi.target_value) return null;

  // lower_is_better: rawScore = target / actual (>1 = good)
  const rawScore = kpi.target_value / actualCost;

  if (rawScore < 0.6) {
    return { borderClass: 'border-l-danger-500', badgeVariant: 'danger', label: 'Custo Alto', dotClass: 'bg-danger-500' };
  }
  if (rawScore < 0.8) {
    return { borderClass: 'border-l-warning-500', badgeVariant: 'warning', label: 'Custo Elevado', dotClass: 'bg-warning-500' };
  }
  if (rawScore < 1.0) {
    return { borderClass: 'border-l-yellow-400', badgeVariant: 'warning', label: 'Custo Limite', dotClass: 'bg-yellow-400' };
  }
  return { borderClass: 'border-l-success-500', badgeVariant: 'success', label: 'Saudável', dotClass: 'bg-success-500' };
}

function creativeHealth(
  c: { frequency: number; ctr: number; cost_per_message: number; cpl: number; cost_per_video_view: number },
  campaignType: CampaignType,
  kpis: ClientKpi[],
): HealthState {
  const sat = saturationHealth(c.frequency, c.ctr);

  let costKpiName: string | null = null;
  let costValue = 0;
  if (campaignType === 'WPP') { costKpiName = 'cost_per_message'; costValue = c.cost_per_message; }
  else if (campaignType === 'VP') { costKpiName = 'cost_per_video_view'; costValue = c.cost_per_video_view; }
  else if (campaignType === 'LEAD' || campaignType === 'FORM') { costKpiName = 'cpl'; costValue = c.cpl; }

  const cost = costKpiName ? costHealth(costValue, kpis, costKpiName) : null;

  // Return the worst of the two
  if (cost && severityRank(cost.badgeVariant) > severityRank(sat.badgeVariant)) return cost;
  return sat;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANGE_OPTIONS = [
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: 'Máximo', days: 365 },
];

const CAMPAIGN_TYPES = ['WPP', 'VP', 'LEAD', 'FORM'] as const;
type CampaignType = (typeof CAMPAIGN_TYPES)[number] | 'Outros';

// ---------------------------------------------------------------------------
// Campaign type helpers
// ---------------------------------------------------------------------------

function extractCampaignType(campaignName: string | null | undefined): CampaignType {
  if (!campaignName) return 'Outros';
  const upper = campaignName.toUpperCase();
  for (const t of CAMPAIGN_TYPES) {
    if (upper.includes(`[${t}]`)) return t;
  }
  return 'Outros';
}

/** Gradient classes for the thumbnail area, keyed by creative media type. */
function thumbnailGradient(type: string): string {
  const t = type?.toLowerCase() ?? '';
  if (t.includes('video')) return 'from-purple-600 via-indigo-500 to-blue-500';
  if (t.includes('carousel')) return 'from-teal-500 via-emerald-500 to-green-500';
  if (t.includes('image') || t.includes('photo')) return 'from-brand-500 via-indigo-500 to-blue-400';
  if (t.includes('story')) return 'from-pink-500 via-rose-500 to-red-400';
  if (t.includes('reel')) return 'from-fuchsia-600 via-purple-500 to-indigo-500';
  return 'from-gray-500 via-gray-600 to-gray-700';
}

/** SVG icon representing the creative type, rendered inside the thumbnail. */
function ThumbnailIcon({ type }: { type: string }) {
  const t = type?.toLowerCase() ?? '';

  if (t.includes('video') || t.includes('reel')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
        className="w-10 h-10 text-white/80" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
    );
  }

  if (t.includes('carousel')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
        className="w-10 h-10 text-white/80" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    );
  }

  if (t.includes('story')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
        className="w-10 h-10 text-white/80" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
      </svg>
    );
  }

  // Default: image / photo
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      className="w-10 h-10 text-white/80" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

type Creative = {
  id: number;
  name: string;
  type: string;
  status: string;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  messages: number;
  video_views: number;
  mql: number;
  ctr: number;
  cpl: number;
  frequency: number;
  cost_per_message: number;
  cost_per_video_view: number;
};

// ---------------------------------------------------------------------------
// Metric pill — small value display with semantic background tint
// ---------------------------------------------------------------------------

function MetricPill({
  label,
  value,
  tint = 'neutral',
}: {
  label: string;
  value: string;
  tint?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const tintClass =
    tint === 'success'
      ? 'bg-success-100 text-success-700'
      : tint === 'warning'
      ? 'bg-warning-100 text-warning-700'
      : tint === 'danger'
      ? 'bg-danger-100 text-danger-700'
      : 'bg-gray-100 text-gray-700';

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide leading-none">
        {label}
      </span>
      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md self-start ${tintClass}`}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context-aware cost metric (WPP / VP / LEAD / FORM / default)
// ---------------------------------------------------------------------------

function CostByType({ c, campaignType }: { c: Creative; campaignType: CampaignType }) {
  if (campaignType === 'WPP') {
    return (
      <>
        <MetricPill
          label="Custo/Msg"
          value={c.messages > 0 ? fmtCurrency(c.cost_per_message) : '—'}
        />
        <MetricPill label="Mensagens" value={fmtNum(c.messages || 0)} />
      </>
    );
  }

  if (campaignType === 'VP') {
    return (
      <>
        <MetricPill
          label="Custo/View"
          value={c.video_views > 0 ? fmtCurrency(c.cost_per_video_view) : '—'}
        />
        <MetricPill label="Views" value={fmtNum(c.video_views || 0)} />
      </>
    );
  }

  // LEAD, FORM, or default
  return (
    <>
      <MetricPill
        label="CPL"
        value={c.leads > 0 ? fmtCurrency(c.cpl) : '—'}
      />
      <MetricPill label="Leads" value={fmtNum(c.leads || 0)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Creative card
// ---------------------------------------------------------------------------

function CreativeCard({
  c,
  rank,
  campaignType,
  kpis,
}: {
  c: Creative;
  rank: number;
  campaignType: CampaignType;
  kpis: ClientKpi[];
}) {
  const sat = creativeHealth(
    { frequency: c.frequency || 0, ctr: c.ctr || 0, cost_per_message: c.cost_per_message || 0, cpl: c.cpl || 0, cost_per_video_view: c.cost_per_video_view || 0 },
    campaignType,
    kpis,
  );
  const isLead = campaignType === 'LEAD' || campaignType === 'FORM';
  const isActive = !c.status || c.status === 'active';
  const gradient = thumbnailGradient(c.type);

  const ctrTint =
    c.ctr >= 1 ? 'success' : c.ctr >= 0.5 ? 'warning' : ('danger' as const);
  const freqTint =
    c.frequency >= 4 ? 'danger' : c.frequency >= 2.5 ? 'warning' : ('success' as const);

  return (
    <article
      className={[
        'group relative flex flex-col rounded-xl overflow-hidden bg-white',
        'border border-gray-200 border-l-4 shadow-sm',
        'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
        sat.borderClass,
      ].join(' ')}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Thumbnail area                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className={`relative bg-gradient-to-br ${gradient} h-28 flex items-center justify-center`}>
        {/* Rank badge — top-left */}
        <span className="absolute top-2 left-2 text-[10px] font-bold text-white/70 leading-none">
          #{rank}
        </span>

        {/* Icon */}
        <ThumbnailIcon type={c.type} />

        {/* Creative type badge — bottom-left */}
        <div className="absolute bottom-2 left-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-black/30 text-white backdrop-blur-sm">
            {c.type}
          </span>
        </div>

        {/* Status pill — top-right */}
        <div className="absolute top-2 right-2">
          {isActive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-100 text-success-700">
              <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
              Ativo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning-100 text-warning-700">
              <span className="w-1.5 h-1.5 rounded-full bg-warning-500" />
              Pausado
            </span>
          )}
        </div>

        {/* Saturation indicator — bottom-right */}
        <div className="absolute bottom-2 right-2">
          <Badge variant={sat.badgeVariant} dot label={sat.label} />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Body                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 p-3 flex-1">
        {/* Creative name */}
        <p
          className="text-xs font-medium text-gray-800 leading-snug line-clamp-2 min-h-[2rem]"
          title={c.name}
        >
          {c.name}
        </p>

        {/* Primary metrics row */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <MetricPill label="Gasto" value={fmtCurrency(c.spend)} />
          <MetricPill label="CTR" value={fmtPct(c.ctr || 0)} tint={ctrTint} />
          <CostByType c={c} campaignType={campaignType} />
          <MetricPill label="Frequência" value={`${(c.frequency || 0).toFixed(1)}x`} tint={freqTint} />
          <MetricPill label="Impressões" value={fmtNum(c.impressions || 0)} />
          {isLead && (
            <MetricPill
              label="MQL"
              value={fmtNum(c.mql || 0)}
              tint={(c.mql || 0) > 0 ? 'success' : 'neutral'}
            />
          )}
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card for loading state
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm animate-pulse">
      <div className="h-28 bg-gray-200" />
      <div className="p-3 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-4/5" />
        <div className="h-3 bg-gray-200 rounded w-3/5" />
        <div className="grid grid-cols-2 gap-2 pt-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 bg-gray-100 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group header
// ---------------------------------------------------------------------------

const CAMPAIGN_TYPE_META: Record<CampaignType, { label: string; color: string }> = {
  WPP: { label: 'WhatsApp [WPP]', color: 'bg-green-100 text-green-700' },
  VP: { label: 'Vídeo Play [VP]', color: 'bg-purple-100 text-purple-700' },
  LEAD: { label: 'Geração de Leads [LEAD]', color: 'bg-brand-100 text-brand-700' },
  FORM: { label: 'Formulário [FORM]', color: 'bg-blue-100 text-blue-700' },
  Outros: { label: 'Outros', color: 'bg-gray-100 text-gray-600' },
};

function GroupHeader({ type, count }: { type: CampaignType; count: number }) {
  const meta = CAMPAIGN_TYPE_META[type];
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>
        {meta.label}
      </span>
      <span className="text-xs text-gray-400 tabular-nums">{count} criativo(s)</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreativesPage() {
  const { selectedClientId } = useAppStore();
  const [rangeDays, setRangeDays] = useState(60);
  const [showActive, setShowActive] = useState(true);
  const [showPaused, setShowPaused] = useState(false);

  const today = toISO(new Date());
  const start = toISO(new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000));

  const { data: topCreatives = [], isLoading } = useQuery({
    queryKey: ['top-creatives', selectedClientId, start, today],
    queryFn: () => metricsApi.getTopCreatives(selectedClientId!, start, today, 100),
    enabled: !!selectedClientId,
  });

  const { data: kpis = [] } = useQuery({
    queryKey: ['client-kpis', selectedClientId],
    queryFn: () => clientsApi.getKpis(selectedClientId!),
    enabled: !!selectedClientId,
  });

  // ---- Guard states -------------------------------------------------------

  if (!selectedClientId) {
    return <EmptyState icon="👆" title="Selecione um cliente" />;
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="h-6 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-40 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
        {/* Card skeleton grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!topCreatives.length) {
    return (
      <EmptyState
        icon="🎨"
        title="Nenhum criativo encontrado"
        description="Carregue dados mock na página de Clientes."
      />
    );
  }

  // ---- Data processing ----------------------------------------------------

  const allCreatives = topCreatives as Creative[];
  const activeCount = allCreatives.filter(c => !c.status || c.status === 'active').length;
  const pausedCount = allCreatives.filter(c => c.status === 'paused').length;

  const visibleCreatives = allCreatives
    .filter(c => {
      const isActive = !c.status || c.status === 'active';
      const isPaused = c.status === 'paused';
      return (showActive && isActive) || (showPaused && isPaused);
    })
    .sort((a, b) => b.impressions - a.impressions);

  // Group by campaign type, preserving display order
  const groups = new Map<CampaignType, Creative[]>();
  for (const t of [...CAMPAIGN_TYPES, 'Outros'] as CampaignType[]) {
    groups.set(t, []);
  }
  for (const c of visibleCreatives) {
    const t = extractCampaignType(c.campaign_name);
    groups.get(t)!.push(c);
  }
  const visibleGroups = ([...CAMPAIGN_TYPES, 'Outros'] as CampaignType[]).filter(
    t => groups.get(t)!.length > 0,
  );

  // ---- Render -------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* Toolbar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 leading-tight">Criativos</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {visibleCreatives.length} criativo(s) exibido(s)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status toggles */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setShowActive(v => !v)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                showActive
                  ? 'bg-white text-success-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  showActive ? 'bg-success-500' : 'bg-gray-400'
                }`}
              />
              Ativos ({activeCount})
            </button>
            <button
              onClick={() => setShowPaused(v => !v)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                showPaused
                  ? 'bg-white text-warning-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  showPaused ? 'bg-warning-500' : 'bg-gray-400'
                }`}
              />
              Pausados ({pausedCount})
            </button>
          </div>

          {/* Date range picker */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setRangeDays(opt.days)}
                className={[
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  rangeDays === opt.days
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Groups                                                               */}
      {/* ------------------------------------------------------------------ */}
      {visibleGroups.map(groupType => {
        const items = groups.get(groupType)!;
        return (
          <section key={groupType}>
            <GroupHeader type={groupType} count={items.length} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((c, i) => (
                <CreativeCard key={c.id} c={c} rank={i + 1} campaignType={groupType} kpis={kpis} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Empty filtered state */}
      {visibleGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-gray-500">
            Nenhum criativo corresponde aos filtros selecionados.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Ative "Ativos" ou "Pausados" para ver resultados.
          </p>
        </div>
      )}
    </div>
  );
}
