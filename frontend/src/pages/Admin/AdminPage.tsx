import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import Badge from '../../components/ui/Badge';

type Tab = 'reports' | 'insights' | 'alerts' | 'tasks' | 'activities';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'reports',    label: 'Relatórios',  icon: '📄' },
  { id: 'insights',   label: 'Insights',    icon: '💡' },
  { id: 'alerts',     label: 'Alertas',     icon: '🔔' },
  { id: 'tasks',      label: 'Tarefas',     icon: '✅' },
  { id: 'activities', label: 'Atividades',  icon: '📝' },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDay(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const REPORT_TYPE: Record<string, string> = {
  weekly_mon: '📅 Segunda',
  weekly_wed: '📊 Quarta',
  weekly_fri: '✅ Sexta',
  manual:     '🖊️ Manual',
};

const IMPACT_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-green-100 text-green-700',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning:  'bg-yellow-100 text-yellow-700',
  info:     'bg-blue-100 text-blue-700',
};

function isOverdue(dueDate: string, status: string) {
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  return status === 'pending' && dueDate < todayStr;
}

// ── Painel de relatórios ──────────────────────────────────────────────────────

function ReportsPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => api.get('/admin/reports').then(r => r.data),
  });
  const { mutate: del } = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/reports/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });
  const [expanded, setExpanded] = useState<number | null>(null);

  if (isLoading) return <p className="text-sm text-gray-400">Carregando...</p>;
  if (!data.length) return <p className="text-sm text-gray-400">Nenhum relatório.</p>;

  return (
    <div className="space-y-2">
      {data.map((r: Record<string, string | number>) => (
        <div key={r.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
            onClick={() => setExpanded(expanded === Number(r.id) ? null : Number(r.id))}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-700">{r.client_name}</span>
                <Badge label={REPORT_TYPE[r.report_type as string] ?? r.report_type as string} className="bg-brand-100 text-brand-700" />
                <span className="text-xs text-gray-400">{String(r.period_start).slice(0,10)} → {String(r.period_end).slice(0,10)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{fmtDate(r.generated_at as string)}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); if (confirm('Apagar este relatório?')) del(Number(r.id)); }}
              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded">🗑</button>
          </div>
          {expanded === Number(r.id) && (
            <div className="px-4 pb-4 border-t border-gray-100">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans mt-3 leading-relaxed">{r.content as string}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Painel de insights ────────────────────────────────────────────────────────

function InsightsPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-insights'],
    queryFn: () => api.get('/admin/insights').then(r => r.data),
  });
  const { mutate: del } = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/insights/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-insights'] }),
  });

  if (isLoading) return <p className="text-sm text-gray-400">Carregando...</p>;
  if (!data.length) return <p className="text-sm text-gray-400">Nenhum insight.</p>;

  return (
    <div className="space-y-2">
      {data.map((r: Record<string, string | number>) => (
        <div key={r.id} className="flex items-start gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">{r.client_name}</span>
              <Badge label={r.impact_level as string} className={IMPACT_COLOR[r.impact_level as string] ?? 'bg-gray-100 text-gray-600'} />
              <Badge label={r.category as string} className="bg-gray-100 text-gray-600" />
              <span className="text-xs text-gray-400">{String(r.period_start).slice(0,10)} → {String(r.period_end).slice(0,10)}</span>
            </div>
            {r.summary && <p className="text-sm text-gray-600 mt-1">{r.summary as string}</p>}
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(r.generated_at as string)}</p>
          </div>
          <button onClick={() => { if (confirm('Apagar este insight?')) del(Number(r.id)); }}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded shrink-0">🗑</button>
        </div>
      ))}
    </div>
  );
}

// ── Painel de alertas ─────────────────────────────────────────────────────────

function AlertsPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: () => api.get('/admin/alerts').then(r => r.data),
  });
  const { mutate: del } = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/alerts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-alerts'] }),
  });

  if (isLoading) return <p className="text-sm text-gray-400">Carregando...</p>;
  if (!data.length) return <p className="text-sm text-gray-400">Nenhum alerta.</p>;

  return (
    <div className="space-y-2">
      {data.map((r: Record<string, string | number>) => (
        <div key={r.id} className="flex items-start gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">{r.client_name}</span>
              <Badge label={r.severity as string} className={SEVERITY_COLOR[r.severity as string] ?? 'bg-gray-100 text-gray-600'} />
              <Badge label={r.alert_type as string} className="bg-gray-100 text-gray-600" />
              {r.resolved_at && <Badge label="Resolvido" className="bg-green-100 text-green-700" />}
            </div>
            <p className="text-sm text-gray-600 mt-1">{r.message as string}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(r.created_at as string)}</p>
          </div>
          <button onClick={() => { if (confirm('Apagar este alerta?')) del(Number(r.id)); }}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded shrink-0">🗑</button>
        </div>
      ))}
    </div>
  );
}

// ── Painel de tarefas ─────────────────────────────────────────────────────────

function TasksPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-tasks'],
    queryFn: () => api.get('/admin/tasks').then(r => r.data),
  });
  const { mutate: del } = useMutation({
    mutationFn: (id: number) => api.delete(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tasks'] }),
  });
  const { mutate: complete } = useMutation({
    mutationFn: (id: number) => api.patch(`/tasks/${id}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tasks'] }),
  });

  if (isLoading) return <p className="text-sm text-gray-400">Carregando...</p>;
  if (!data.length) return <p className="text-sm text-gray-400">Nenhuma tarefa.</p>;

  const pending = data.filter((t: Record<string, string>) => t.status === 'pending');
  const done    = data.filter((t: Record<string, string>) => t.status !== 'pending');

  return (
    <div className="space-y-2">
      {pending.map((r: Record<string, string | number>) => {
        const overdue = isOverdue(r.due_date as string, r.status as string);
        return (
          <div key={r.id} className={`flex items-start gap-3 px-4 py-3 bg-white border rounded-xl ${overdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-700">{r.client_name}</span>
                <span className="text-sm text-gray-800">{r.title as string}</span>
                {overdue && <Badge label="Atrasada" className="bg-red-100 text-red-700" />}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">📅 {fmtDay(r.due_date as string)} · {r.assigned_to as string}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => complete(Number(r.id))} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">✓</button>
              <button onClick={() => { if (confirm('Apagar tarefa?')) del(Number(r.id)); }} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded">🗑</button>
            </div>
          </div>
        );
      })}
      {done.length > 0 && (
        <p className="text-xs text-gray-400 pt-1">{done.length} concluída(s)/cancelada(s) oculta(s)</p>
      )}
    </div>
  );
}

// ── Painel de atividades ──────────────────────────────────────────────────────

function ActivitiesPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-activities'],
    queryFn: () => api.get('/admin/activities').then(r => r.data),
  });
  const { mutate: del } = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/activities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-activities'] }),
  });

  if (isLoading) return <p className="text-sm text-gray-400">Carregando...</p>;
  if (!data.length) return <p className="text-sm text-gray-400">Nenhuma atividade.</p>;

  return (
    <div className="space-y-2">
      {data.map((r: Record<string, string | number>) => (
        <div key={r.id} className="flex items-start gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">{r.client_name}</span>
              <Badge label={r.activity_type as string} className="bg-brand-100 text-brand-700" />
              {r.archived_at && <Badge label="Arquivada" className="bg-gray-200 text-gray-500" />}
            </div>
            <p className="text-sm text-gray-600 mt-1">{r.description as string}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(r.executed_at as string)} · {r.executed_by as string}</p>
          </div>
          <button onClick={() => { if (confirm('Apagar esta atividade?')) del(Number(r.id)); }}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded shrink-0">🗑</button>
        </div>
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('reports');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Painel Admin</h2>
        <p className="text-sm text-gray-500">Visão geral de todos os clientes</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 text-sm rounded-lg transition-colors font-medium ${tab === t.id ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {tab === 'reports'    && <ReportsPanel />}
      {tab === 'insights'   && <InsightsPanel />}
      {tab === 'alerts'     && <AlertsPanel />}
      {tab === 'tasks'      && <TasksPanel />}
      {tab === 'activities' && <ActivitiesPanel />}
    </div>
  );
}
