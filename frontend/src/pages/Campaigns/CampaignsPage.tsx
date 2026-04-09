import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { api } from '../../api/client';
import { metricsApi } from '../../api/metrics.api';
import { clientsApi, Client } from '../../api/clients.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { fmtCurrency, fmtPct } from '../../utils/formatters';

export default function CampaignsPage() {
  const { selectedClientId, dateRange } = useAppStore();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns', selectedClientId],
    queryFn: () => api.get(`/clients/${selectedClientId}/campaigns`).then(r => r.data),
    enabled: !!selectedClientId,
  });

  const { data: clientData } = useQuery({
    queryKey: ['client', selectedClientId],
    queryFn: () => clientsApi.get(selectedClientId!),
    enabled: !!selectedClientId,
    staleTime: 2 * 60 * 1000,
  });

  if (!selectedClientId) return <EmptyState icon="👆" title="Selecione um cliente" />;
  if (isLoading) return <div className="text-gray-500">Carregando...</div>;
  if (!campaigns.length) return <EmptyState icon="📣" title="Nenhuma campanha encontrada"
    description="Carregue dados mock na página de Clientes." />;

  const client = clientData as Client | undefined;
  const saldoPixBaixo = client?.saldo_pix_enabled &&
    client.saldo_pix_amount !== null &&
    client.saldo_pix_threshold !== null &&
    client.saldo_pix_amount <= client.saldo_pix_threshold;

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-success-100 text-success-700';
    if (s === 'paused') return 'bg-warning-100 text-warning-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-semibold text-gray-900">Campanhas</h2>
        {client?.saldo_pix_enabled && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
            saldoPixBaixo
              ? 'bg-orange-100 text-orange-800 border border-orange-300'
              : 'bg-gray-100 text-gray-700'
          }`}>
            <span>💳</span>
            <span>
              Saldo PIX: <span className="font-bold">{fmtCurrency(client.saldo_pix_amount ?? 0)}</span>
            </span>
            {saldoPixBaixo && <span className="text-xs font-semibold text-orange-700">— Saldo baixo!</span>}
          </div>
        )}
      </div>

      {saldoPixBaixo && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-3 flex items-center gap-2 text-sm text-orange-800">
          <span>⚠️</span>
          <span>
            Saldo PIX abaixo do limite configurado (R$ {(client!.saldo_pix_threshold ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
            Recarregue para evitar interrupção das campanhas.
          </span>
        </div>
      )}

      <div className="space-y-3">
        {(campaigns as { id: number; name: string; status: string; objective: string; platform: string }[]).map(camp => (
          <CampaignRow key={camp.id} campaign={camp} dateRange={dateRange} statusColor={statusColor} />
        ))}
      </div>
    </div>
  );
}

function CampaignRow({ campaign, dateRange, statusColor }: {
  campaign: { id: number; name: string; status: string; objective: string; platform: string };
  dateRange: { start: string; end: string };
  statusColor: (s: string) => string;
}) {
  const { data: metrics } = useQuery({
    queryKey: ['campaign-metrics', campaign.id, dateRange],
    queryFn: () => metricsApi.getCampaignMetrics(campaign.id, dateRange.start, dateRange.end),
  });

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-800">{campaign.name}</h3>
            <Badge label={campaign.status} className={statusColor(campaign.status)} />
            <Badge label={campaign.platform} className="bg-blue-100 text-blue-700" />
          </div>
          {campaign.objective && <div className="text-xs text-gray-500 mt-0.5">{campaign.objective}</div>}
        </div>
        {metrics && (
          <div className="text-right text-sm">
            <div className="font-semibold text-gray-800">{fmtCurrency(metrics.spend)}</div>
            <div className="text-xs text-gray-500">CTR {fmtPct(metrics.ctr)} | Leads {metrics.leads}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
