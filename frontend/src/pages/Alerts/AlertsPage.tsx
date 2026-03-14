import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { alertsApi, Alert } from '../../api/alerts.api';
import { clientsApi } from '../../api/clients.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { severityColor, fmtDate } from '../../utils/formatters';

export default function AlertsPage() {
  const { selectedClientId } = useAppStore();
  const qc = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts', selectedClientId],
    queryFn: () => alertsApi.list(selectedClientId!),
    enabled: !!selectedClientId,
    refetchInterval: 30000,
  });

  const { mutate: resolve } = useMutation({
    mutationFn: (id: number) => alertsApi.resolve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', selectedClientId] }),
  });

  const { mutate: checkAlerts, isPending: checking } = useMutation({
    mutationFn: () => clientsApi.checkAlerts(selectedClientId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', selectedClientId] }),
  });

  if (!selectedClientId) {
    return <EmptyState icon="👆" title="Selecione um cliente" />;
  }

  const critical = (alerts as Alert[]).filter(a => a.severity === 'critical');
  const warning = (alerts as Alert[]).filter(a => a.severity === 'warning');
  const info = (alerts as Alert[]).filter(a => a.severity === 'info');

  function AlertItem({ alert }: { alert: Alert }) {
    return (
      <div className="flex items-start justify-between gap-3 p-4 bg-white border border-gray-200 rounded-xl">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge label={alert.severity === 'critical' ? 'Crítico' : alert.severity === 'warning' ? 'Atenção' : 'Info'}
              className={severityColor(alert.severity)} />
            <Badge label={alert.alert_type.replace(/_/g, ' ')} className="bg-gray-100 text-gray-600" />
          </div>
          <p className="text-sm text-gray-700">{alert.message}</p>
          {alert.kpi_name && (
            <div className="text-xs text-gray-400 mt-1">
              KPI: {alert.kpi_name} | Real: {alert.actual_value?.toFixed(2)} | Limite: {alert.threshold_value?.toFixed(2)}
            </div>
          )}
          <div className="text-xs text-gray-400 mt-0.5">
            {new Date(alert.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button onClick={() => resolve(alert.id)}
          className="text-xs px-3 py-1.5 border border-success-500 text-success-700 rounded-lg hover:bg-success-100 whitespace-nowrap">
          ✓ Resolver
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Alertas Ativos</h2>
          <p className="text-sm text-gray-500">{alerts.length} alerta(s)</p>
        </div>
        <button onClick={() => checkAlerts()} disabled={checking}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          {checking ? 'Verificando...' : '🔍 Verificar KPIs'}
        </button>
      </div>

      {isLoading && <div className="text-gray-500 text-sm">Carregando...</div>}

      {!isLoading && alerts.length === 0 && (
        <EmptyState icon="✅" title="Nenhum alerta ativo"
          description="Todos os KPIs estão dentro dos limites aceitáveis."
          action={<button onClick={() => checkAlerts()} disabled={checking}
            className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg">Verificar agora</button>} />
      )}

      {critical.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-danger-700 uppercase tracking-wide mb-2">
            🚨 Críticos ({critical.length})
          </div>
          <div className="space-y-2">
            {critical.map(a => <AlertItem key={a.id} alert={a} />)}
          </div>
        </div>
      )}

      {warning.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-warning-700 uppercase tracking-wide mb-2 mt-4">
            ⚠️ Atenção ({warning.length})
          </div>
          <div className="space-y-2">
            {warning.map(a => <AlertItem key={a.id} alert={a} />)}
          </div>
        </div>
      )}

      {info.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2 mt-4">
            ℹ️ Informativo ({info.length})
          </div>
          <div className="space-y-2">
            {info.map(a => <AlertItem key={a.id} alert={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}
