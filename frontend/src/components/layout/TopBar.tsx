import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import { clientsApi } from '../../api/clients.api';
import { alertsApi } from '../../api/alerts.api';
import { format, subDays } from 'date-fns';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clientes',
  '/campaigns': 'Campanhas',
  '/creatives': 'Criativos',
  '/funnel': 'Funil de Vendas',
  '/insights': 'Insights',
  '/reports': 'Relatórios',
  '/alerts': 'Alertas',
  '/activities': 'Atividades',
};

const RANGES = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
];

export default function TopBar() {
  const location = useLocation();
  const { selectedClientId, setSelectedClientId, dateRange, setDateRange } = useAppStore();

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clientsApi.list,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', selectedClientId],
    queryFn: () => selectedClientId ? alertsApi.list(selectedClientId) : Promise.resolve([]),
    enabled: !!selectedClientId,
    refetchInterval: 60000,
  });

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  )?.[1] || 'DAE';

  function setRange(days: number) {
    setDateRange({
      start: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    });
  }

  const criticalCount = alerts.filter((a: { severity: string }) => a.severity === 'critical').length;
  const warnCount = alerts.filter((a: { severity: string }) => a.severity === 'warning').length;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-20">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Date range */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {RANGES.map(r => {
            const active = format(subDays(new Date(), r.days), 'yyyy-MM-dd') === dateRange.start;
            return (
              <button
                key={r.days}
                onClick={() => setRange(r.days)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${active ? 'bg-white shadow font-medium text-brand-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Client selector */}
        <select
          value={selectedClientId ?? ''}
          onChange={e => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Selecionar cliente</option>
          {clients.map((c: { id: number; name: string; status: string }) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.status !== 'active' ? `(${c.status})` : ''}
            </option>
          ))}
        </select>

        {/* Alert bell */}
        {selectedClientId && (criticalCount > 0 || warnCount > 0) && (
          <div className="relative">
            <span className="text-xl">🔔</span>
            <span className={`absolute -top-1 -right-1 text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full text-white ${criticalCount > 0 ? 'bg-red-500' : 'bg-yellow-500'}`}>
              {criticalCount + warnCount}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
