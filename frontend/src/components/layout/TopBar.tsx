import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import { clientsApi } from '../../api/clients.api';
import { alertsApi } from '../../api/alerts.api';
import { format, subDays } from 'date-fns';

// ── Page title map ─────────────────────────────────────────────────────────────
const PAGE_TITLES: Record<string, string> = {
  '/':            'Dashboard',
  '/clients':     'Clientes',
  '/campaigns':   'Campanhas',
  '/creatives':   'Criativos',
  '/funnel':      'Funil de Vendas',
  '/insights':    'Insights',
  '/reports':     'Relatórios',
  '/alerts':      'Alertas',
  '/activities':  'Atividades',
};

const RANGES = [
  { label: '7d',  days: 7  },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
];

// ── Inline SVG icons ──────────────────────────────────────────────────────────
function HamburgerIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function ChevronDownIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function DotsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5"  cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}
function CalendarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}
function UserIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface TopBarProps {
  /** Opens the mobile overlay drawer (hamburger tap on mobile) */
  onOpenMobileDrawer: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TopBar({ onOpenMobileDrawer }: TopBarProps) {
  const location = useLocation();
  const { selectedClientId, setSelectedClientId, dateRange, setDateRange } = useAppStore();

  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

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

  // Derive page title
  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  )?.[1] ?? 'DAE';

  // Date range helpers
  function setRange(days: number) {
    setDateRange({
      start: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      end:   format(new Date(), 'yyyy-MM-dd'),
    });
  }

  function activeRangeDays(): number | null {
    for (const r of RANGES) {
      if (format(subDays(new Date(), r.days), 'yyyy-MM-dd') === dateRange.start) {
        return r.days;
      }
    }
    return null;
  }

  const showDateRange = location.pathname !== '/creatives';
  const criticalCount = alerts.filter((a: { severity: string }) => a.severity === 'critical').length;
  const warnCount     = alerts.filter((a: { severity: string }) => a.severity === 'warning').length;
  const alertCount    = criticalCount + warnCount;
  const hasAlerts     = !!selectedClientId && alertCount > 0;

  // Currently selected client name (for the compact selector label)
  const selectedClient = (clients as { id: number; name: string; status: string }[]).find(
    c => c.id === selectedClientId
  );

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 shadow-sm">
      <div className="flex items-center gap-3 px-4 md:px-6 h-14 md:h-[60px]">

        {/* ── Left: hamburger (mobile) + page title ── */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Hamburger — mobile only (opens drawer) */}
          <button
            onClick={onOpenMobileDrawer}
            className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Abrir menu"
          >
            <HamburgerIcon size={20} />
          </button>

          <h1 className="text-base md:text-lg font-semibold text-gray-900 truncate leading-tight">
            {title}
          </h1>
        </div>

        {/* ── Right: controls group ── */}
        <div className="flex items-center gap-2 shrink-0">

          {/* ── Desktop controls (hidden on mobile) ── */}
          <div className="hidden md:flex items-center gap-2">

            {/* Date range pill */}
            {showDateRange && (
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1">
                <span className="text-gray-400 pl-1.5 pr-0.5">
                  <CalendarIcon size={13} />
                </span>
                {RANGES.map(r => {
                  const isActive = activeRangeDays() === r.days;
                  return (
                    <button
                      key={r.days}
                      onClick={() => setRange(r.days)}
                      className={`
                        px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150
                        ${isActive
                          ? 'bg-white text-brand-700 shadow-sm ring-1 ring-gray-200'
                          : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
                        }
                      `}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200" />

            {/* Client selector */}
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                <UserIcon size={13} />
              </span>
              <select
                value={selectedClientId ?? ''}
                onChange={e => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
                className="
                  appearance-none pl-7 pr-7 py-1.5 text-sm
                  border border-gray-200 rounded-lg bg-white text-gray-700
                  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                  hover:border-gray-300 transition-colors cursor-pointer
                  min-w-[160px] max-w-[220px]
                "
              >
                <option value="">Selecionar cliente</option>
                {(clients as { id: number; name: string; status: string }[]).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.status !== 'active' ? ` (${c.status})` : ''}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <ChevronDownIcon size={13} />
              </span>
            </div>
          </div>

          {/* ── Alert bell ── */}
          <div className="relative">
            <button
              onClick={() => setBellOpen(v => !v)}
              className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${bellOpen ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
              aria-label="Notificações"
            >
              <span className={hasAlerts ? (criticalCount > 0 ? 'text-red-500' : 'text-yellow-500') : 'text-gray-400'}>
                <BellIcon size={20} />
              </span>
              {hasAlerts && (
                <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold flex items-center justify-center rounded-full text-white leading-none ${criticalCount > 0 ? 'bg-red-500' : 'bg-yellow-500'}`}>
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setBellOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-30 w-80 bg-white rounded-xl shadow-xl border border-gray-200/80 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <span className="text-sm font-semibold text-gray-800">Notificações</span>
                    {hasAlerts && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${criticalCount > 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {alertCount} ativo{alertCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Alert list */}
                  <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
                    {!selectedClientId && (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        Selecione um cliente para ver alertas
                      </div>
                    )}
                    {selectedClientId && !hasAlerts && (
                      <div className="px-4 py-8 text-center">
                        <div className="text-2xl mb-2">✅</div>
                        <p className="text-sm font-medium text-gray-600">Nenhum alerta ativo</p>
                        <p className="text-xs text-gray-400 mt-1">Tudo dentro dos KPIs configurados</p>
                      </div>
                    )}
                    {(alerts as { id: number; severity: string; message: string; alert_type: string; kpi_name?: string; actual_value?: number; threshold_value?: number; created_at: string }[]).map(alert => (
                      <div key={alert.id} className={`flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${alert.severity === 'critical' ? 'border-l-2 border-l-red-500' : 'border-l-2 border-l-yellow-400'}`}>
                        <span className="text-base mt-0.5 shrink-0">
                          {alert.severity === 'critical' ? '🚨' : '⚠️'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 leading-snug">{alert.message}</p>
                          {alert.kpi_name && (
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              KPI: <span className="font-medium text-gray-500">{alert.kpi_name}</span>
                              {alert.actual_value != null && ` · Real: ${alert.actual_value.toFixed(2)}`}
                              {alert.threshold_value != null && ` · Meta: ${alert.threshold_value.toFixed(2)}`}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-300 mt-0.5">
                            {new Date(alert.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  {hasAlerts && (
                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                      <a href="/alerts" onClick={() => setBellOpen(false)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                        Ver todos os alertas →
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Mobile "..." overflow button ── */}
          <div className="relative md:hidden">
            <button
              onClick={() => setMobileControlsOpen(v => !v)}
              className={`
                flex items-center justify-center w-9 h-9 rounded-lg transition-colors
                ${mobileControlsOpen ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}
              `}
              aria-label="Mais opções"
            >
              <DotsIcon size={18} />
            </button>

            {/* Mobile overflow panel */}
            {mobileControlsOpen && (
              <>
                {/* Backdrop to close panel */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMobileControlsOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-20 w-72 bg-white rounded-xl shadow-xl border border-gray-200/80 p-4 space-y-4">

                  {/* Client selector in overflow panel */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Cliente
                    </label>
                    <select
                      value={selectedClientId ?? ''}
                      onChange={e => {
                        setSelectedClientId(e.target.value ? Number(e.target.value) : null);
                        setMobileControlsOpen(false);
                      }}
                      className="
                        w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                        bg-white text-gray-700 focus:outline-none focus:ring-2
                        focus:ring-brand-500 focus:border-transparent
                      "
                    >
                      <option value="">Selecionar cliente</option>
                      {(clients as { id: number; name: string; status: string }[]).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.status !== 'active' ? ` (${c.status})` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedClient && (
                      <p className="mt-1 text-xs text-gray-400 truncate">
                        Selecionado: {selectedClient.name}
                      </p>
                    )}
                  </div>

                  {/* Date range in overflow panel */}
                  {showDateRange && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Período
                      </label>
                      <div className="flex items-center gap-1.5">
                        {RANGES.map(r => {
                          const isActive = activeRangeDays() === r.days;
                          return (
                            <button
                              key={r.days}
                              onClick={() => {
                                setRange(r.days);
                                setMobileControlsOpen(false);
                              }}
                              className={`
                                flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150
                                ${isActive
                                  ? 'bg-brand-600 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }
                              `}
                            >
                              {r.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
