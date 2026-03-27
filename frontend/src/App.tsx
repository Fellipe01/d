import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ClientsPage from './pages/Clients/ClientsPage';
import CampaignsPage from './pages/Campaigns/CampaignsPage';
import CreativesPage from './pages/Creatives/CreativesPage';
import FunnelPage from './pages/Funnel/FunnelPage';
import InsightsPage from './pages/Insights/InsightsPage';
import ReportsPage from './pages/Reports/ReportsPage';
import AlertsPage from './pages/Alerts/AlertsPage';
import ActivitiesPage from './pages/Activities/ActivitiesPage';
import TasksPage from './pages/Tasks/TasksPage';
import AdminPage from './pages/Admin/AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/creatives" element={<CreativesPage />} />
          <Route path="/funnel" element={<FunnelPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
