import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { tasksApi, Task } from '../../api/tasks.api';
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
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  return task.status === 'pending' && task.due_date < todayStr;
}

function isDueSoon(task: Task) {
  if (task.status !== 'pending') return false;
  const due = new Date(task.due_date + 'T12:00:00');
  const now = new Date();
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 3;
}

function isToday(dateStr: string) {
  const today = new Date().toDateString();
  return new Date(dateStr + 'T12:00:00').toDateString() === today;
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Returns left-border urgency classes for a pending task card */
function urgencyBorder(task: Task): string {
  if (isOverdue(task))  return 'border-l-4 border-l-red-500';
  if (isDueSoon(task))  return 'border-l-4 border-l-yellow-400';
  return 'border-l-4 border-l-green-400';
}

const LABEL_CLS = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';
const INPUT_CLS =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ' +
  'bg-white placeholder-gray-400 transition';

export default function TasksPage() {
  const { selectedClientId } = useAppStore();
  const qc = useQueryClient();
  const [showForm, setShowForm]     = useState(false);
  const [showDone, setShowDone]     = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', selectedClientId],
    queryFn: () => tasksApi.list(selectedClientId!),
    enabled: !!selectedClientId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tasks', selectedClientId] });
  const refetchNow = () => qc.refetchQueries({ queryKey: ['tasks', selectedClientId] });

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () => tasksApi.create(selectedClientId!, form),
    onMutate: () => {
      setCreateError(null);
    },
    onSuccess: () => {
      invalidate();
      refetchNow();
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: () => {
      setCreateError('Erro ao salvar tarefa. Tente novamente.');
    },
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

  const pending       = (tasks as Task[]).filter(t => t.status === 'pending');
  const done          = (tasks as Task[]).filter(t => t.status === 'done' || t.status === 'cancelled');
  const overdueCount  = pending.filter(isOverdue).length;
  const todayCount    = pending.filter(t => isToday(t.due_date)).length;

  const sortedPending = [...pending].sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Tarefas</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {pending.length} pendente{pending.length !== 1 ? 's' : ''}
            {overdueCount > 0 && (
              <span className="text-red-500 font-semibold ml-1.5">
                · {overdueCount} atrasada{overdueCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Today counter pill */}
          {todayCount > 0 && (
            <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-100 rounded-full px-3 py-1">
              <span className="text-xs text-brand-600 font-semibold">
                {todayCount} para hoje
              </span>
            </div>
          )}

          <button
            onClick={() => { setShowForm(true); setCreateError(null); }}
            className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-semibold shadow-sm transition"
          >
            + Nova Tarefa
          </button>
        </div>
      </div>

      {/* ── Creation form ── */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          {/* Form header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 tracking-tight">Nova Tarefa</h3>
            <button
              onClick={() => { setShowForm(false); setCreateError(null); }}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none transition"
              aria-label="Fechar formulário"
            >
              ×
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>Tipo</label>
                <select
                  value={form.task_type}
                  onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}
                  className={INPUT_CLS}
                >
                  {TASK_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLS}>Data de execução *</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
            </div>

            {form.task_type === 'other' && (
              <div>
                <label className={LABEL_CLS}>Tipo personalizado</label>
                <input
                  value={form.custom_type}
                  onChange={e => setForm(f => ({ ...f, custom_type: e.target.value }))}
                  placeholder="Ex: Teste A/B de copy..."
                  className={INPUT_CLS}
                />
              </div>
            )}

            <div>
              <label className={LABEL_CLS}>Título *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Resumo da tarefa"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Descrição</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Detalhes opcionais..."
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Responsável</label>
              <input
                value={form.assigned_to}
                onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>

            {/* Error banner */}
            {createError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 font-medium">
                <span>⚠</span>
                <span>{createError}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowForm(false); setCreateError(null); }}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => create()}
                disabled={!form.title || !form.due_date || creating}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                {creating ? 'Salvando...' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Carregando tarefas…
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && pending.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4 select-none">✅</div>
          <p className="text-base font-semibold text-gray-700">Nenhuma tarefa pendente</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">
            Tudo em dia! Crie novas tarefas para organizar o trabalho da semana.
          </p>
        </div>
      )}

      {/* ── Pending task cards ── */}
      {!isLoading && sortedPending.length > 0 && (
        <div className="space-y-2.5">
          {sortedPending.map(task => {
            const overduetask = isOverdue(task);
            const soonTask    = !overduetask && isDueSoon(task);
            return (
              <div
                key={task.id}
                className={[
                  'flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm',
                  'border border-gray-100',
                  urgencyBorder(task),
                  overduetask ? 'bg-red-50/60' : soonTask ? 'bg-yellow-50/40' : '',
                ].join(' ')}
              >
                <div className="text-xl flex-shrink-0 mt-0.5 select-none">{typeIcon(task.task_type)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 text-sm">{task.title}</span>
                    <Badge label={typeLabel(task.task_type, task.custom_type)} className="bg-brand-100 text-brand-700" />
                    {overduetask && <Badge label="Atrasada" className="bg-red-100 text-red-700" />}
                    {soonTask    && <Badge label="Urgente"  className="bg-yellow-100 text-yellow-700" />}
                    {isToday(task.due_date) && !overduetask && (
                      <Badge label="Hoje" className="bg-brand-100 text-brand-600 font-semibold" />
                    )}
                  </div>

                  {task.description && (
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{task.description}</p>
                  )}

                  <div className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                    <span>📅</span>
                    <span>{fmtDate(task.due_date)}</span>
                    <span className="mx-1 text-gray-300">·</span>
                    <span>{task.assigned_to}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => complete(task.id)}
                    className="px-2.5 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-semibold transition"
                  >
                    ✓ Concluir
                  </button>
                  <button
                    onClick={() => cancel(task.id)}
                    className="px-2.5 py-1 text-xs bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Done / cancelled section ── */}
      {done.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setShowDone(s => !s)}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium transition flex items-center gap-1"
          >
            <span>{showDone ? '▲' : '▼'}</span>
            <span>{showDone ? 'Ocultar' : 'Ver'} concluídas/canceladas ({done.length})</span>
          </button>

          {showDone && (
            <div className="space-y-2 mt-3">
              {done.map(task => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl opacity-60"
                >
                  <div className="text-lg flex-shrink-0 select-none">{typeIcon(task.task_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-500 line-through">{task.title}</span>
                      <Badge
                        label={task.status === 'done' ? 'Concluída' : 'Cancelada'}
                        className={task.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <span>📅</span>
                      <span>{fmtDate(task.due_date)}</span>
                      <span className="mx-1 text-gray-300">·</span>
                      <span>{task.assigned_to}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(task.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                    aria-label="Remover tarefa"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
