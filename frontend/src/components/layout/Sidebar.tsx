import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store';

// ── Nav items ──────────────────────────────────────────────────────────────────
// Priority items (shown in the mobile bottom nav — max 5 slots)
const NAV_PRIMARY = [
  { to: '/',           label: 'Dashboard',  icon: DashboardIcon  },
  { to: '/clients',    label: 'Clientes',   icon: ClientsIcon    },
  { to: '/campaigns',  label: 'Campanhas',  icon: CampaignsIcon  },
  { to: '/insights',   label: 'Insights',   icon: InsightsIcon   },
  { to: '/alerts',     label: 'Alertas',    icon: AlertsIcon     },
];

const NAV_SECONDARY = [
  { to: '/creatives',  label: 'Criativos',  icon: CreativesIcon  },
  { to: '/funnel',     label: 'Funil',      icon: FunnelIcon     },
  { to: '/reports',    label: 'Relatórios', icon: ReportsIcon    },
  { to: '/activities', label: 'Atividades', icon: ActivitiesIcon },
  { to: '/tasks',      label: 'Tarefas',    icon: TasksIcon      },
  { to: '/admin',      label: 'Admin',      icon: AdminIcon      },
];

// ── Inline SVG icons (no external dep needed) ─────────────────────────────────
function DashboardIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}
function ClientsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function CampaignsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function CreativesIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}
function FunnelIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function InsightsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  );
}
function ReportsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function AlertsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function ActivitiesIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function TasksIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function AdminIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  );
}
function ChevronLeftIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Component props ───────────────────────────────────────────────────────────
interface SidebarProps {
  /** Whether the mobile overlay drawer is open (only relevant on mobile) */
  mobileDrawerOpen: boolean;
  /** Called when the user taps the close button or backdrop (mobile drawer) */
  onCloseDrawer: () => void;
  /**
   * When true, render the mobile bottom navigation bar instead of the sidebar.
   * Used by AppShell to render a second Sidebar instance purely as bottom nav.
   */
  mobileBottomNav?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Sidebar({ onCloseDrawer, mobileBottomNav = false }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar, selectedClientId } = useAppStore();

  // ── Mobile bottom nav bar ──────────────────────────────────────────────────
  if (mobileBottomNav) {
    return (
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] flex items-center justify-around px-1 h-16 md:hidden"
      >
        {NAV_PRIMARY.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl min-w-[52px] transition-colors ${
                isActive
                  ? 'text-brand-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-brand-50' : ''}`}>
                  <item.icon size={22} />
                </span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    );
  }

  // ── Desktop / mobile-drawer sidebar ───────────────────────────────────────
  return (
    <aside
      className={`
        flex flex-col h-screen
        bg-gradient-to-b from-brand-900 via-brand-900 to-[#16134a]
        text-white z-30
        transition-[width] duration-300 ease-in-out
        ${sidebarCollapsed ? 'w-16' : 'w-64'}
        /* On mobile this is the drawer — fixed positioning is handled by AppShell */
        md:fixed md:left-0 md:top-0
      `}
    >
      {/* ── Brand / logo area ── */}
      <div
        className={`
          flex items-center border-b border-white/10 shrink-0
          ${sidebarCollapsed ? 'justify-center p-3 h-16' : 'justify-between px-4 h-16'}
        `}
      >
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo mark */}
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0 shadow-md">
              <span className="text-white font-black text-sm leading-none">D</span>
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base leading-tight tracking-tight text-white">DAE</div>
              <div className="text-[11px] text-brand-100/60 leading-tight truncate">Media Intelligence</div>
            </div>
          </div>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={sidebarCollapsed ? toggleSidebar : toggleSidebar}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-brand-100/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>

        {/* Close button — mobile drawer only */}
        <button
          onClick={onCloseDrawer}
          className="md:hidden flex items-center justify-center w-7 h-7 rounded-md text-brand-100/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title="Fechar menu"
        >
          <CloseIcon />
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden scrollbar-none" aria-label="Menu principal">
        {/* Primary nav items */}
        <div className="mb-1">
          {!sidebarCollapsed && (
            <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-brand-100/40">
              Principal
            </p>
          )}
          {NAV_PRIMARY.map(item => (
            <NavItem key={item.to} item={item} collapsed={sidebarCollapsed} />
          ))}
        </div>

        {/* Divider */}
        <div className="mx-4 my-2 border-t border-white/10" />

        {/* Secondary nav items */}
        <div>
          {!sidebarCollapsed && (
            <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-brand-100/40">
              Ferramentas
            </p>
          )}
          {NAV_SECONDARY.map(item => (
            <NavItem key={item.to} item={item} collapsed={sidebarCollapsed} />
          ))}
        </div>
      </nav>

      {/* ── Footer — active client indicator ── */}
      <div className="border-t border-white/10 shrink-0">
        {selectedClientId ? (
          <div className={`flex items-center gap-3 p-4 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            {/* Avatar placeholder */}
            <div className="w-8 h-8 rounded-full bg-brand-500/50 border border-brand-400/40 flex items-center justify-center shrink-0 text-xs font-bold text-white">
              {String(selectedClientId).charAt(0)}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-[11px] text-brand-100/50 leading-tight">Cliente ativo</div>
                <div className="text-sm font-semibold text-white leading-tight truncate">ID #{selectedClientId}</div>
              </div>
            )}
          </div>
        ) : (
          !sidebarCollapsed && (
            <div className="px-4 py-3">
              <div className="text-[11px] text-brand-100/40 italic">Nenhum cliente selecionado</div>
            </div>
          )
        )}
      </div>
    </aside>
  );
}

// ── Nav item sub-component ────────────────────────────────────────────────────
function NavItem({
  item,
  collapsed,
}: {
  item: { to: string; label: string; icon: React.ComponentType<{ size?: number }> };
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `
          flex items-center gap-3 mx-2 mb-0.5 rounded-lg
          text-sm font-medium transition-all duration-150 group
          ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
          ${
            isActive
              ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/10'
              : 'text-brand-100/70 hover:bg-white/8 hover:text-white'
          }
        `
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`
              shrink-0 transition-transform duration-150
              ${isActive ? 'text-white' : 'text-brand-100/60 group-hover:text-white'}
              ${!collapsed ? '' : 'mx-auto'}
            `}
          >
            <item.icon size={18} />
          </span>
          {!collapsed && (
            <span className="truncate">{item.label}</span>
          )}
          {/* Active indicator bar */}
          {isActive && !collapsed && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
          )}
        </>
      )}
    </NavLink>
  );
}
