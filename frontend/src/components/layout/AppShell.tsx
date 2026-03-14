import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAppStore } from '../../store';

export default function AppShell() {
  const collapsed = useAppStore(s => s.sidebarCollapsed);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-64'}`}>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
