import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { funnelApi } from '../../api/funnel.api';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { fmtCurrency, fmtPct, fmtNum } from '../../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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
  if (isLoading) return <div className="text-gray-500">Carregando...</div>;

  const f = funnel as Record<string, number> | null;
  if (!f || !f.leads) {
    return <EmptyState icon="🔻" title="Sem dados de funil"
      description="Integre o CRM (RD Station) ou carregue dados mock para ver o funil." />;
  }

  const funnelStages = [
    { label: 'Leads', value: f.leads, color: '#4f46e5' },
    { label: 'MQL', value: f.mql, color: '#7c3aed' },
    { label: 'SQL', value: f.sql, color: '#db2777' },
    { label: 'Vendas', value: f.sales, color: '#059669' },
  ];

  // Calculate rates from totals (not stored averages which are mathematically wrong)
  const leadToMql = f.leads > 0 ? (f.mql / f.leads) * 100 : 0;
  const mqlToSql  = f.mql > 0  ? (f.sql / f.mql)  * 100 : 0;
  const sqlToSale = f.sql > 0  ? (f.sales / f.sql) * 100 : 0;

  const convRates = [
    { label: 'Lead → MQL', value: leadToMql },
    { label: 'MQL → SQL',  value: mqlToSql },
    { label: 'SQL → Venda', value: sqlToSale },
  ];

  return (
    <div className="space-y-6">
      {/* Funnel visual */}
      <Card title="Funil de Conversão">
        <div className="flex items-end justify-center gap-3 py-4">
          {funnelStages.map((stage, i) => {
            const maxVal = f.leads || 1;
            const pct = (stage.value / maxVal) * 100;
            return (
              <div key={stage.label} className="flex flex-col items-center">
                <div className="text-lg font-bold text-gray-800">{fmtNum(stage.value)}</div>
                <div
                  className="rounded-lg mt-1 flex items-center justify-center text-white text-xs font-medium transition-all"
                  style={{ width: `${Math.max(pct, 20)}px`, height: '48px', backgroundColor: stage.color, minWidth: '80px' }}>
                  {stage.label}
                </div>
                {i < funnelStages.length - 1 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {((funnelStages[i + 1].value / Math.max(stage.value, 1)) * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Costs per stage */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Custo por Lead',  value: fmtCurrency(f.cost_per_lead  || 0) },
          { label: 'Custo por MQL',   value: fmtCurrency(f.cost_per_mql   || 0) },
          { label: 'Custo por SQL',   value: fmtCurrency(f.cost_per_sql   || 0) },
          { label: 'Custo por Venda', value: fmtCurrency(f.cost_per_sale  || 0) },
        ].map(item => (
          <Card key={item.label} className="!p-0">
            <div className="p-4 text-center">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{item.label}</div>
              <div className="text-2xl font-bold text-gray-900">{item.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Conversion rates */}
      <Card title="Taxas de Conversão">
        <div className="grid grid-cols-3 gap-4">
          {convRates.map(r => (
            <div key={r.label} className="text-center">
              <div className="text-3xl font-bold text-brand-600">{fmtPct(r.value)}</div>
              <div className="text-sm text-gray-500 mt-1">{r.label}</div>
              <div className={`mt-2 h-2 rounded-full ${r.value >= 30 ? 'bg-success-500' : r.value >= 15 ? 'bg-warning-500' : 'bg-danger-500'}`}
                style={{ width: `${Math.min(r.value, 100)}%`, margin: '8px auto 0' }} />
            </div>
          ))}
        </div>
      </Card>

      {/* By campaign */}
      {(byCampaign as { campaign_name: string; leads: number; mql: number; sql: number; sales: number }[]).length > 0 && (
        <Card title="Por Campanha">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCampaign as { campaign_name: string; leads: number; mql: number; sql: number; sales: number }[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="campaign_name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="leads" fill="#4f46e5" name="Leads" />
              <Bar dataKey="mql" fill="#7c3aed" name="MQL" />
              <Bar dataKey="sql" fill="#db2777" name="SQL" />
              <Bar dataKey="sales" fill="#059669" name="Vendas" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
