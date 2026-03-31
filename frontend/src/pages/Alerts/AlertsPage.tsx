// TODO: Consider merging AlertsPage and InsightsPage into a single "Intelligence" page
// with two tabs (Insights | Alerts). Both surfaces are AI-generated outputs that
// belong to the same "monitoring" mental model. A combined /intelligence route would
// let users jump between correlated insights and the alerts that triggered them
// without leaving the page. The current individual routes could still exist as
// redirects to the tabbed view.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { alertsApi, Alert } from '../../api/alerts.api';
import { clientsApi } from '../../api/clients.api';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { severityColor } from '../../utils/formatters';

// Left-border accent by severity
const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-l-danger-500',
  warning:  'border-l-warning-500',
  info:     'border-l-blue-400',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'bg-danger-50',
  warning:  'bg-warning-50',
  info:     'bg-blue-50',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  warning:  'Atenção',
  info:     'Info',
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: '🚨',
  warning:  '⚠️',
  info:     'ℹ️',
};

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return 'agora mesmo';
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7)     return `há ${days}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function AlertCard({ alert, onResolve }: { alert: Alert; onResolve: () => void }) {
  const border = SEVERITY_BORDER[alert.severity] ?? 'border-l-gray-400';
  const bg     = SEVERITY_BG[alert.severity]     ?? 'bg-gray-50';

  return (
    <div
      className={`flex items-start gap-0 bg-white border border-gray-200 border-l-4 ${border} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* Body */}
      <div className={`flex-1 min-w-0 px-4 py-3.5 ${bg} bg-opacity-30`}>
        {/* Badge row */}
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <Badge
            label={SEVERITY_LABELS[alert.severity] ?? alert.severity}
            className={severityColor(alert.severity)}
          />
          <Badge
            label={alert.alert_type.replace(/_/g, ' ')}
            className="bg-gray-100 text-gray-600"
          />
          <span className="text-xs text-gray-400 ml-auto">
            {relativeTime(alert.created_at)}
          </span>
        </div>

        {/* Message */}
        <p className="text-sm text-gray-700 leading-relaxed">{alert.message}</p>

        {/* KPI detail */}
        {alert.kpi_name && (
          <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500 bg-white/70 rounded-lg px-2.5 py-1 border border-gray-100">
            <span className="font-medium text-gray-600">{alert.kpi_name}</span>
            <span className="text-gray-300">|</span>
            <span>Real: <span className="font-medium text-gray-700">{alert.actual_value?.toFixed(2)}</span></span>
            <span className="text-gray-300">|</span>
            <span>Limite: <span className="font-medium text-gray-700">{alert.threshold_value?.toFixed(2)}</span></span>
          </div>
        )}
      </div>

      {/* Action column */}
      <div className="flex flex-col items-center justify-center px-3 py-3.5 border-l border-gray-100 shrink-0 self-stretch">
        <button
          onClick={onResolve}
          title="Marcar como resolvido"
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-success-500 text-success-700 rounded-lg hover:bg-success-100 transition-colors font-medium whitespace-nowrap"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="hidden sm:inline">Resolver</span>
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ icon, label, count, colorClass }: {
  icon: string; label: string; count: number; colorClass: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-widest ${colorClass}`}>
      <span>{icon}</span>
      <span>{label}</span>
      <span className="ml-0.5 font-bold">({count})</span>
    </div>
  );
}

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
  const warning  = (alerts as Alert[]).filter(a => a.severity === 'warning');
  const info     = (alerts as Alert[]).filter(a => a.severity === 'info');

  return (
    <div className="space-y-5">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">Alertas Ativos</h2>
          <p className="text-sm text-gray-500">
            {isLoading ? 'Carregando...' : `${alerts.length} alerta(s) · atualiza a cada 30s`}
          </p>
        </div>
        <button
          onClick={() => checkAlerts()}
          disabled={checking}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
        >
          {checking ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Verificando...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Verificar KPIs
            </>
          )}
        </button>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-brand-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      )}

      {/* ── Empty State ──────────────────────────────────────────────── */}
      {!isLoading && alerts.length === 0 && (
        <EmptyState
          icon="✅"
          title="Nenhum alerta ativo"
          description="Todos os KPIs estão dentro dos limites aceitáveis."
          action={
            <button
              onClick={() => checkAlerts()}
              disabled={checking}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors font-medium"
            >
              Verificar agora
            </button>
          }
        />
      )}

      {/* ── Critical ─────────────────────────────────────────────────── */}
      {critical.length > 0 && (
        <section className="space-y-2">
          <SectionHeader
            icon={SEVERITY_ICONS.critical}
            label="Críticos"
            count={critical.length}
            colorClass="text-danger-700"
          />
          {critical.map(a => (
            <AlertCard key={a.id} alert={a} onResolve={() => resolve(a.id)} />
          ))}
        </section>
      )}

      {/* ── Warning ──────────────────────────────────────────────────── */}
      {warning.length > 0 && (
        <section className="space-y-2">
          <SectionHeader
            icon={SEVERITY_ICONS.warning}
            label="Atenção"
            count={warning.length}
            colorClass="text-warning-700"
          />
          {warning.map(a => (
            <AlertCard key={a.id} alert={a} onResolve={() => resolve(a.id)} />
          ))}
        </section>
      )}

      {/* ── Info ─────────────────────────────────────────────────────── */}
      {info.length > 0 && (
        <section className="space-y-2">
          <SectionHeader
            icon={SEVERITY_ICONS.info}
            label="Informativo"
            count={info.length}
            colorClass="text-blue-700"
          />
          {info.map(a => (
            <AlertCard key={a.id} alert={a} onResolve={() => resolve(a.id)} />
          ))}
        </section>
      )}
    </div>
  );
}
