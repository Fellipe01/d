import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/clients', label: 'Clientes', icon: '👥' },
  { to: '/campaigns', label: 'Campanhas', icon: '📣' },
  { to: '/creatives', label: 'Criativos', icon: '🎨' },
  { to: '/funnel', label: 'Funil', icon: '🔻' },
  { to: '/insights', label: 'Insights', icon: '💡' },
  { to: '/reports', label: 'Relatórios', icon: '📋' },
  { to: '/alerts', label: 'Alertas', icon: '🔔' },
  { to: '/activities', label: 'Atividades', icon: '📝' },
  { to: '/tasks', label: 'Tarefas', icon: '✅' },
  { to: '/admin', label: 'Admin', icon: '⚙️' },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, selectedClientId } = useAppStore();

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-brand-900 text-white transition-all duration-200 z-30 flex flex-col ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-brand-700">
        {!sidebarCollapsed && (
          <div>
            <div className="font-bold text-lg leading-tight">DAE</div>
            <div className="text-xs text-brand-100 opacity-70">Central de Mídia</div>
          </div>
        )}
        <button onClick={toggleSidebar} className="p-1 rounded hover:bg-brand-700 text-brand-100">
          {sidebarCollapsed ? '→' : '←'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg mb-0.5 text-sm transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white font-medium'
                  : 'text-brand-100 hover:bg-brand-700 hover:text-white'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Client indicator */}
      {!sidebarCollapsed && selectedClientId && (
        <div className="p-4 border-t border-brand-700">
          <div className="text-xs text-brand-100 opacity-70">Cliente ativo</div>
          <div className="text-sm font-medium text-white mt-0.5">ID #{selectedClientId}</div>
        </div>
      )}
    </aside>
  );
}
