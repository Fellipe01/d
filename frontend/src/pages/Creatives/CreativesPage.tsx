import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { metricsApi } from '../../api/metrics.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { fmtCurrency, fmtPct, fmtNum } from '../../utils/formatters';

function saturationColor(frequency: number, ctr: number): { color: string; label: string } {
  if (frequency >= 5.0 || (ctr < 0.5 && frequency >= 2.5)) return { color: 'border-danger-500', label: '🔴 Saturado' };
  if (frequency >= 3.5) return { color: 'border-warning-500', label: '🟡 Saturando' };
  if (frequency >= 2.5) return { color: 'border-yellow-300', label: '🟡 Atenção' };
  return { color: 'border-success-500', label: '🟢 Saudável' };
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

const today = toISO(new Date());

const RANGE_OPTIONS = [
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: 'Máximo', days: 365 },
];

export default function CreativesPage() {
  const { selectedClientId } = useAppStore();
  const [rangeDays, setRangeDays] = useState(60);

  const start = toISO(new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000));

  const { data: topCreatives = [], isLoading } = useQuery({
    queryKey: ['top-creatives', selectedClientId, start, today],
    queryFn: () => metricsApi.getTopCreatives(selectedClientId!, start, today, 50),
    enabled: !!selectedClientId,
  });

  if (!selectedClientId) return <EmptyState icon="👆" title="Selecione um cliente" />;
  if (isLoading) return <div className="text-gray-500">Carregando...</div>;
  if (!topCreatives.length) return <EmptyState icon="🎨" title="Nenhum criativo encontrado"
    description="Carregue dados mock na página de Clientes." />;

  const sorted = [...(topCreatives as {
    id: number; name: string; type: string; status: string;
    spend: number; impressions: number; clicks: number; leads: number;
    ctr: number; cpl: number; frequency: number;
  }[])].sort((a, b) => b.spend - a.spend);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Criativos</h2>
        <div className="flex items-center gap-3">
          {/* Period selector — independent from global date range */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setRangeDays(opt.days)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  rangeDays === opt.days
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500">{sorted.length} criativo(s)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((c, i) => {
          const sat = saturationColor(c.frequency || 0, c.ctr || 0);
          const isActive = !c.status || c.status === 'active';
          return (
            <div key={c.id} className={`bg-white rounded-xl border-2 ${sat.color} p-4 shadow-sm`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-gray-400">#{i + 1}</span>
                    <Badge label={c.type} className="bg-gray-100 text-gray-600 capitalize" />
                    {/* Active/Paused status */}
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {isActive ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-800 text-sm mt-1 truncate">{c.name}</h3>
                </div>
                <span className="text-xs ml-2 whitespace-nowrap">{sat.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-400">Gasto</div>
                  <div className="font-semibold">{fmtCurrency(c.spend)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">CTR</div>
                  <div className={`font-semibold ${c.ctr >= 1 ? 'text-success-700' : c.ctr >= 0.5 ? 'text-warning-700' : 'text-danger-700'}`}>
                    {fmtPct(c.ctr || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">CPL</div>
                  <div className="font-semibold">{c.leads > 0 ? fmtCurrency(c.cpl || 0) : '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Frequência</div>
                  <div className={`font-semibold ${c.frequency >= 4 ? 'text-danger-700' : c.frequency >= 2.5 ? 'text-warning-700' : 'text-success-700'}`}>
                    {(c.frequency || 0).toFixed(1)}x
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Leads</div>
                  <div className="font-semibold">{fmtNum(c.leads || 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Impressões</div>
                  <div className="font-semibold">{fmtNum(c.impressions || 0)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
