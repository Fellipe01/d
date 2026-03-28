import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { metricsApi } from '../../api/metrics.api';
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

const CAMPAIGN_TYPES = ['WPP', 'VP', 'FORM'] as const;
type CampaignType = typeof CAMPAIGN_TYPES[number] | 'Outros';

function extractCampaignType(campaignName: string | null | undefined): CampaignType {
  if (!campaignName) return 'Outros';
  const upper = campaignName.toUpperCase();
  for (const t of CAMPAIGN_TYPES) {
    if (upper.includes(`[${t}]`)) return t;
  }
  return 'Outros';
}

type Creative = {
  id: number; name: string; type: string; status: string;
  campaign_name: string | null;
  spend: number; impressions: number; clicks: number; leads: number;
  ctr: number; cpl: number; frequency: number;
};

function CreativeCard({ c, rank }: { c: Creative; rank: number }) {
  const sat = saturationColor(c.frequency || 0, c.ctr || 0);
  return (
    <div className={`bg-white rounded-xl border-2 ${sat.color} p-4 shadow-sm`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-400">#{rank}</span>
            <Badge label={c.type} className="bg-gray-100 text-gray-600 capitalize" />
            <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Ativo
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
}

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

  // Filter active only and sort by spend
  const activeCreatives = (topCreatives as Creative[])
    .filter(c => !c.status || c.status === 'active')
    .sort((a, b) => b.spend - a.spend);

  // Group by campaign type
  const groups = new Map<CampaignType, Creative[]>();
  for (const t of [...CAMPAIGN_TYPES, 'Outros'] as CampaignType[]) {
    groups.set(t, []);
  }
  for (const c of activeCreatives) {
    const t = extractCampaignType(c.campaign_name);
    groups.get(t)!.push(c);
  }

  // Only render groups that have creatives
  const visibleGroups = ([...CAMPAIGN_TYPES, 'Outros'] as CampaignType[]).filter(t => groups.get(t)!.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Criativos</h2>
        <div className="flex items-center gap-3">
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
          <p className="text-sm text-gray-500">{activeCreatives.length} ativo(s)</p>
        </div>
      </div>

      {visibleGroups.map(groupType => {
        const items = groups.get(groupType)!;
        return (
          <div key={groupType}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-gray-700 text-sm">
                {groupType === 'Outros' ? 'Outros' : `[${groupType}]`}
              </h3>
              <span className="text-xs text-gray-400">{items.length} criativo(s)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((c, i) => (
                <CreativeCard key={c.id} c={c} rank={i + 1} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
