import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { tasksApi, Task } from '../../api/tasks.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

const TASK_TYPES = [
  { value: 'budget_change',   label: 'Ajuste de Orçamento', icon: '💰' },
  { value: 'creative_pause',  label: 'Pausar Criativo',     icon: '⏸️' },
  { value: 'creative_launch', label: 'Lançar Criativo',     icon: '🚀' },
  { value: 'campaign_pause',  label: 'Pausar Campanha',     icon: '⏸️' },
  { value: 'campaign_launch', label: 'Lançar Campanha',     icon: '📣' },
  { value: 'kpi_update',      label: 'Atualizar KPI',       icon: '🎯' },
  { value: 'optimization',    label: 'Otimização',          icon: '⚙️' },
  { value: 'meeting',         label: 'Reunião',             icon: '🤝' },
  { value: 'note',            label: 'Observação',          icon: '📝' },
  { value: 'other',           label: 'Outro',               icon: '🔧' },
];

const EMPTY_FORM = {
  task_type: 'optimization',
  custom_type: '',
  title: '',
  description: '',
  due_date: '',
  assigned_to: 'DAE Assessoria',
};

function typeIcon(type: string) { return TASK_TYPES.find(t => t.value === type)?.icon || '📝'; }
function typeLabel(type: string, custom: string | null) {
  if (type === 'other' && custom) return custom;
  return TASK_TYPES.find(t => t.value === type)?.label || type;
}

function isOverdue(task: Task) {
  return task.status === 'pending' && new Date(task.due_date) < new Date(new Date().toDateString());
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TasksPage() {
  const { selectedClientId } = useAppStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', selectedClientId],
    queryFn: () => tasksApi.list(selectedClientId!),
    enabled: !!selectedClientId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tasks', selectedClientId] });

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () => tasksApi.create(selectedClientId!, form),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(EMPTY_FORM); },
  });

  const { mutate: complete } = useMutation({
    mutationFn: (id: number) => tasksApi.complete(id),
    onSuccess: invalidate,
  });

  const { mutate: cancel } = useMutation({
    mutationFn: (id: number) => tasksApi.cancel(id),
    onSuccess: invalidate,
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id: number) => tasksApi.remove(id),
    onSuccess: invalidate,
  });

  if (!selectedClientId) return <EmptyState icon="👆" title="Selecione um cliente" />;

  const pending = (tasks as Task[]).filter(t => t.status === 'pending');
  const done    = (tasks as Task[]).filter(t => t.status === 'done' || t.status === 'cancelled');
  const overdue = pending.filter(isOverdue).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Tarefas</h2>
          <p className="text-sm text-gray-500">
            {pending.length} pendente(s){overdue > 0 && <span className="text-red-500 font-medium ml-1">· {overdue} atrasada(s)</span>}
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium">
          + Nova Tarefa
        </button>
      </div>

      {showForm && (
        <Card title="Nova Tarefa">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo</label>
                <select value={form.task_type} onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Data de execução *</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            {form.task_type === 'other' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo personalizado</label>
                <input value={form.custom_type} onChange={e => setForm(f => ({ ...f, custom_type: e.target.value }))}
                  placeholder="Ex: Teste A/B de copy..."
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">Título *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Resumo da tarefa"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Descrição</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="Detalhes opcionais..."
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Responsável</label>
              <input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={() => create()} disabled={!form.title || !form.due_date || creating}
                className="flex-1 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {creating ? 'Salvando...' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {isLoading && <div className="text-gray-500 text-sm">Carregando...</div>}

      {!isLoading && pending.length === 0 && (
        <EmptyState icon="✅" title="Nenhuma tarefa pendente" description="Crie tarefas para organizar o trabalho da semana." />
      )}

      <div className="space-y-2">
        {pending.sort((a, b) => a.due_date.localeCompare(b.due_date)).map(task => {
          const overduetask = isOverdue(task);
          return (
            <div key={task.id} className={`flex items-start gap-3 p-4 bg-white border rounded-xl ${overduetask ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
              <div className="text-xl flex-shrink-0 mt-0.5">{typeIcon(task.task_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-800 text-sm">{task.title}</span>
                  <Badge label={typeLabel(task.task_type, task.custom_type)} className="bg-brand-100 text-brand-700" />
                  {overduetask && <Badge label="Atrasada" className="bg-red-100 text-red-700" />}
                </div>
                {task.description && <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>}
                <div className="text-xs text-gray-400 mt-1">
                  📅 {fmtDate(task.due_date)} · por {task.assigned_to}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => complete(task.id)}
                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium">
                  ✓ Concluir
                </button>
                <button onClick={() => cancel(task.id)}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200">
                  Cancelar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone(s => !s)} className="text-xs text-gray-400 hover:text-gray-600">
            {showDone ? '▲ Ocultar' : '▼ Ver'} concluídas/canceladas ({done.length})
          </button>
          {showDone && (
            <div className="space-y-2 mt-2">
              {done.map(task => (
                <div key={task.id} className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl opacity-60">
                  <div className="text-lg flex-shrink-0">{typeIcon(task.task_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-500 line-through">{task.title}</span>
                      <Badge
                        label={task.status === 'done' ? 'Concluída' : 'Cancelada'}
                        className={task.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'} />
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      📅 {fmtDate(task.due_date)} · {task.assigned_to}
                    </div>
                  </div>
                  <button onClick={() => remove(task.id)} className="text-xs text-gray-400 hover:text-red-500">🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
