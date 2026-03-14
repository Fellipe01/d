import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { metricsApi, KpiResult } from '../../api/metrics.api';
import { alertsApi, Alert } from '../../api/alerts.api';
import { insightsApi } from '../../api/insights.api';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import { fmtCurrency, fmtPct, fmtNum, fmtDate, kpiColor, impactColor, impactLabel, severityColor } from '../../utils/formatters';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DashboardPage() {
  const { selectedClientId, dateRange } = useAppStore();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['metrics-summary', selectedClientId, dateRange],
    queryFn: () => metricsApi.getClientSummary(selectedClientId!, dateRange.start, dateRange.end),
    enabled: !!selectedClientId,
  });

  const { data: timeseries = [] } = useQuery({
    queryKey: ['timeseries', selectedClientId, dateRange],
    queryFn: () => metricsApi.getTimeseries(selectedClientId!, dateRange.start, dateRange.end),
    enabled: !!selectedClientId,
  });

  const { data: topCreatives = [] } = useQuery({
    queryKey: ['top-creatives', selectedClientId, dateRange],
    queryFn: () => metricsApi.getTopCreatives(selectedClientId!, dateRange.start, dateRange.end, 5),
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

  if (!selectedClientId) {
    return (
      <EmptyState
        icon="👆"
        title="Selecione um cliente"
        description="Escolha um cliente no menu superior para ver o dashboard de desempenho."
      />
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Carregando...</div>;
  }

  const m = summary?.metrics;
  const kpiResults: KpiResult[] = summary?.kpi_results || [];
  const critAlerts = alerts.filter((a: Alert) => a.severity === 'critical');
  const warnAlerts = alerts.filter((a: Alert) => a.severity === 'warning');

  const overviewCards = [
    { label: 'Investimento', value: fmtCurrency(m?.spend || 0), icon: '💰' },
    { label: 'Impressões', value: fmtNum(m?.impressions || 0), icon: '👁️' },
    { label: 'Leads', value: fmtNum(m?.leads || 0), icon: '🎯' },
    { label: 'CPL', value: fmtCurrency(m?.cpl || 0), icon: '📊' },
    { label: 'CTR', value: fmtPct(m?.ctr || 0), icon: '🖱️' },
    { label: 'Frequência', value: (m?.frequency || 0).toFixed(2), icon: '🔄' },
    { label: 'Mensagens', value: fmtNum(m?.messages || 0), icon: '💬' },
    { label: 'CPC', value: fmtCurrency(m?.cpc || 0), icon: '📈' },
  ];

  return (
    <div className="space-y-6">
      {/* Alert banners */}
      {critAlerts.length > 0 && (
        <div className="bg-danger-100 border border-red-200 rounded-xl p-4">
          <div className="font-semibold text-danger-700 mb-2">🚨 {critAlerts.length} alerta(s) crítico(s)</div>
          {critAlerts.slice(0, 3).map((a: Alert) => (
            <div key={a.id} className="text-sm text-danger-700">{a.message}</div>
          ))}
        </div>
      )}

      {/* KPI Overview grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {overviewCards.map(card => (
          <Card key={card.label} className="!p-0">
            <div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</span>
                <span>{card.icon}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Spend trend chart */}
      <Card title={`Evolução do Investimento — ${fmtDate(dateRange.start)} a ${fmtDate(dateRange.end)}`}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timeseries as { date: string; spend: number; leads: number }[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
            <Tooltip formatter={(v: number, name: string) => [name === 'spend' ? fmtCurrency(v) : fmtNum(v), name === 'spend' ? 'Gasto' : 'Leads']} />
            <Area type="monotone" dataKey="spend" stroke="#4f46e5" fill="#e0e9ff" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPI Results */}
        {kpiResults.length > 0 && (
          <Card title="KPIs vs Metas">
            <div className="space-y-3">
              {kpiResults.map(r => (
                <div key={r.kpi_name} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">{r.kpi_name}</span>
                      <Badge label={r.status === 'on_target' ? 'OK' : r.status === 'warning' ? 'Atenção' : 'Fora'} className={kpiColor(r.status)} />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Meta: {r.target.toFixed(2)} | Real: {r.actual.toFixed(2)} ({r.delta_pct > 0 ? '+' : ''}{r.delta_pct.toFixed(1)}%)
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${r.status === 'on_target' ? 'bg-success-500' : r.status === 'warning' ? 'bg-warning-500' : 'bg-danger-500'}`}
                        style={{ width: `${Math.min(r.raw_score * 50, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Top Creatives */}
        {topCreatives.length > 0 && (
          <Card title="Top Criativos">
            <div className="space-y-3">
              {(topCreatives as { id: number; name: string; type: string; spend: number; ctr: number; cpl: number; leads: number; frequency: number }[]).map((c, i) => (
                <div key={c.id} className="flex items-start gap-3">
                  <div className="w-6 h-6 flex items-center justify-center rounded-full bg-brand-100 text-brand-600 text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      {fmtCurrency(c.spend)} | CTR {fmtPct(c.ctr)} | CPL {fmtCurrency(c.cpl)} | Freq {c.frequency?.toFixed(1)}
                    </div>
                  </div>
                  <Badge label={c.type} className="bg-gray-100 text-gray-600 capitalize" />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Recent Insights */}
      {insights.length > 0 && (
        <Card title="Insights Recentes">
          <div className="space-y-3">
            {(insights as { id: number; summary: string | null; impact_level: string; category: string; generated_at: string }[]).map(ins => (
              <div key={ins.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Badge label={impactLabel(ins.impact_level)} className={impactColor(ins.impact_level)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{ins.summary || '(ver insight completo)'}</p>
                  <div className="text-xs text-gray-400 mt-0.5">{ins.category} · {new Date(ins.generated_at).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Active warnings */}
      {warnAlerts.length > 0 && (
        <Card title={`Alertas Ativos (${warnAlerts.length})`}>
          <div className="space-y-2">
            {warnAlerts.slice(0, 5).map((a: Alert) => (
              <div key={a.id} className="flex items-start gap-2 text-sm">
                <Badge label={a.severity} className={severityColor(a.severity)} />
                <span className="text-gray-700">{a.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
