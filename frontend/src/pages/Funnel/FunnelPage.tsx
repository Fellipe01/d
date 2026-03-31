import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { funnelApi } from '../../api/funnel.api';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { fmtCurrency, fmtPct, fmtNum } from '../../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

// Gradient config: top of funnel is deep indigo, bottom is emerald
const STAGE_COLORS = ['#4f46e5', '#7c3aed', '#db2777', '#059669'];

export default function FunnelPage() {
  const { selectedClientId, dateRange } = useAppStore();

  const { data: funnel, isLoading } = useQuery({
    queryKey: ['funnel', selectedClientId, dateRange],
    queryFn: () => funnelApi.get(selectedClientId!, dateRange.start, dateRange.end),
    enabled: !!selectedClientId,
  });

  const { data: byCampaign = [] } = useQuery({
    queryKey: ['funnel-campaign', selectedClientId, dateRange],
    queryFn: () => funnelApi.byCampaign(selectedClientId!, dateRange.start, dateRange.end),
    enabled: !!selectedClientId,
  });

  if (!selectedClientId) return <EmptyState icon="👆" title="Selecione um cliente" />;
  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin w-8 h-8 text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span className="text-sm text-gray-500">Carregando funil...</span>
      </div>
    </div>
  );

  const f = funnel as Record<string, number> | null;
  if (!f || !f.leads) {
    return (
      <EmptyState
        icon="🔻"
        title="Sem dados de funil"
        description="Integre o CRM (RD Station) ou carregue dados mock para ver o funil."
      />
    );
  }

  const funnelStages = [
    { label: 'Leads',  value: f.leads,  color: STAGE_COLORS[0] },
    { label: 'MQL',    value: f.mql,    color: STAGE_COLORS[1] },
    { label: 'SQL',    value: f.sql,    color: STAGE_COLORS[2] },
    { label: 'Vendas', value: f.sales,  color: STAGE_COLORS[3] },
  ];

  // Calculate conversion rates from totals
  const leadToMql = f.leads > 0 ? (f.mql  / f.leads) * 100 : 0;
  const mqlToSql  = f.mql   > 0 ? (f.sql  / f.mql)   * 100 : 0;
  const sqlToSale = f.sql   > 0 ? (f.sales / f.sql)   * 100 : 0;

  const convRates = [
    { label: 'Lead → MQL',  value: leadToMql },
    { label: 'MQL → SQL',   value: mqlToSql  },
    { label: 'SQL → Venda', value: sqlToSale },
  ];

  const costItems = [
    { label: 'Custo por Lead',  value: fmtCurrency(f.cost_per_lead  || 0), color: STAGE_COLORS[0] },
    { label: 'Custo por MQL',   value: fmtCurrency(f.cost_per_mql   || 0), color: STAGE_COLORS[1] },
    { label: 'Custo por SQL',   value: fmtCurrency(f.cost_per_sql   || 0), color: STAGE_COLORS[2] },
    { label: 'Custo por Venda', value: fmtCurrency(f.cost_per_sale  || 0), color: STAGE_COLORS[3] },
  ];

  const maxVal = f.leads || 1;

  return (
    <div className="space-y-6">
      {/* ── Funnel Visualization ─────────────────────────────────────── */}
      <Card title="Funil de Conversão" accent>
        {/* Desktop: horizontal bar funnel | Mobile: stacked vertical list */}
        <div className="hidden sm:flex flex-col items-center gap-0 py-4 px-4">
          {funnelStages.map((stage, i) => {
            const pct = (stage.value / maxVal) * 100;
            const widthPct = Math.max(pct, 18); // min 18% wide so label fits
            const nextStage = funnelStages[i + 1];
            const dropRate = nextStage
              ? ((nextStage.value / Math.max(stage.value, 1)) * 100).toFixed(1)
              : null;

            return (
              <div key={stage.label} className="w-full flex flex-col items-center">
                {/* Funnel bar */}
                <div className="w-full flex justify-center">
                  <div
                    className="relative flex items-center justify-between px-4 rounded-lg transition-all"
                    style={{
                      width: `${widthPct}%`,
                      height: '52px',
                      backgroundColor: stage.color,
                      minWidth: '200px',
                    }}
                  >
                    <span className="text-white font-semibold text-sm">{stage.label}</span>
                    <span className="text-white font-bold text-base">{fmtNum(stage.value)}</span>
                    {/* Percentage of top */}
                    <span className="absolute -right-16 text-xs text-gray-500 font-medium w-12 text-right">
                      {fmtPct(pct)}
                    </span>
                  </div>
                </div>
                {/* Conversion arrow between stages */}
                {dropRate && (
                  <div className="flex items-center gap-1.5 my-1">
                    <div className="w-px h-3 bg-gray-300" />
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {dropRate}% convertem
                    </span>
                    <div className="w-px h-3 bg-gray-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical stacked cards */}
        <div className="sm:hidden space-y-3 py-2">
          {funnelStages.map((stage, i) => {
            const pct = (stage.value / maxVal) * 100;
            const nextStage = funnelStages[i + 1];
            const dropRate = nextStage
              ? ((nextStage.value / Math.max(stage.value, 1)) * 100).toFixed(1)
              : null;
            return (
              <div key={stage.label}>
                <div
                  className="rounded-xl p-4 flex items-center justify-between"
                  style={{ backgroundColor: stage.color }}
                >
                  <div>
                    <div className="text-white/80 text-xs font-medium uppercase tracking-wider">{stage.label}</div>
                    <div className="text-white font-bold text-2xl mt-0.5">{fmtNum(stage.value)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/70 text-xs">do topo</div>
                    <div className="text-white font-bold text-lg">{fmtPct(pct)}</div>
                  </div>
                </div>
                {dropRate && (
                  <div className="flex items-center justify-center py-1 gap-1">
                    <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
                    </svg>
                    <span className="text-xs text-gray-500 font-medium">{dropRate}% convertem</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Cost per Stage ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {costItems.map(item => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="h-1" style={{ backgroundColor: item.color }} />
            <div className="p-4 text-center">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 leading-tight">
                {item.label}
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900">{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Conversion Rates ──────────────────────────────────────────── */}
      <Card title="Taxas de Conversão">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {convRates.map(r => {
            const barColor = r.value >= 30 ? '#22c55e' : r.value >= 15 ? '#eab308' : '#ef4444';
            const clampedPct = Math.min(Math.max(r.value, 0), 100);
            return (
              <div key={r.label} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-600 font-medium">{r.label}</span>
                  <span className="text-lg font-bold text-brand-600">{fmtPct(r.value)}</span>
                </div>
                {/* Progress bar */}
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${clampedPct}%`, backgroundColor: barColor }}
                  />
                </div>
                <div className="text-xs text-gray-400">
                  {r.value >= 30 ? 'Acima da meta' : r.value >= 15 ? 'Atenção' : 'Abaixo da meta'}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── By Campaign ───────────────────────────────────────────────── */}
      {(byCampaign as { campaign_name: string; leads: number; mql: number; sql: number; sales: number }[]).length > 0 && (
        <Card title="Por Campanha">
          <div className="w-full overflow-x-auto">
            <div className="min-w-[480px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={byCampaign as { campaign_name: string; leads: number; mql: number; sql: number; sales: number }[]}
                  margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="campaign_name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="leads"  fill={STAGE_COLORS[0]} name="Leads"  radius={[3, 3, 0, 0]} />
                  <Bar dataKey="mql"    fill={STAGE_COLORS[1]} name="MQL"    radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sql"    fill={STAGE_COLORS[2]} name="SQL"    radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sales"  fill={STAGE_COLORS[3]} name="Vendas" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
