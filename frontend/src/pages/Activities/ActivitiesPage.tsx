import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { activitiesApi, Activity } from '../../api/activities.api';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

const ACTIVITY_TYPES = [
  { value: 'budget_change',   label: 'Ajuste de Orçamento', icon: '💰', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'creative_pause',  label: 'Criativo Pausado',    icon: '⏸️',  color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'creative_launch', label: 'Criativo Lançado',    icon: '🚀', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'campaign_pause',  label: 'Campanha Pausada',    icon: '⏸️',  color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'campaign_launch', label: 'Campanha Lançada',    icon: '📣', color: 'bg-brand-100 text-brand-700 border-brand-200' },
  { value: 'kpi_update',      label: 'KPI Atualizado',      icon: '🎯', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'optimization',    label: 'Otimização',          icon: '⚙️',  color: 'bg-brand-100 text-brand-700 border-brand-200' },
  { value: 'meeting',         label: 'Reunião',             icon: '🤝', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'note',            label: 'Observação',          icon: '📝', color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

function typeIcon(type: string) {
  return ACTIVITY_TYPES.find(t => t.value === type)?.icon || '📝';
}
function typeLabel(type: string) {
  return ACTIVITY_TYPES.find(t => t.value === type)?.label || type;
}
function typeDotColor(type: string) {
  return ACTIVITY_TYPES.find(t => t.value === type)?.color || 'bg-gray-100 text-gray-600 border-gray-200';
}

function fmtTimestamp(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDateGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(d, today)) return 'Hoje';
  if (isSameDay(d, yesterday)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function groupByDate(activities: Activity[]) {
  const groups: Record<string, Activity[]> = {};
  for (const act of activities) {
    const key = new Date(act.executed_at).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(act);
  }
  return Object.entries(groups).map(([key, items]) => ({
    dateKey: key,
    label: fmtDateGroup(items[0].executed_at),
    items,
  }));
}

export default function ActivitiesPage() {
  const { selectedClientId } = useAppStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    activity_type: 'optimization',
    description: '',
    executed_by: 'DAE Assessoria',
  });

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', selectedClientId],
    queryFn: () => activitiesApi.list(selectedClientId!, 100),
    enabled: !!selectedClientId,
  });

  const { mutate: create, isPending } = useMutation({
    mutationFn: () => activitiesApi.create(selectedClientId!, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities', selectedClientId] });
      setShowForm(false);
      setForm({ activity_type: 'optimization', description: '', executed_by: 'DAE Assessoria' });
    },
  });

  if (!selectedClientId) {
    return <EmptyState icon="👆" title="Selecione um cliente" />;
  }

  const groups = groupByDate(activities as Activity[]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Atividades</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {(activities as Activity[]).length} registro(s) documentado(s)
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 active:bg-brand-700 font-medium transition-colors shadow-sm self-start sm:self-auto"
        >
          <span aria-hidden="true">+</span>
          Registrar Atividade
        </button>
      </div>

      {/* New Activity Form */}
      {showForm && (
        <div className="bg-white border border-brand-200 rounded-xl shadow-sm overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-brand-500 via-indigo-400 to-purple-500" />
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Nova Atividade</h3>
            <p className="text-xs text-gray-400 mt-0.5">Documente as ações executadas para este cliente</p>
          </div>
          <div className="p-5 space-y-4">
            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Tipo de Atividade
              </label>
              <select
                value={form.activity_type}
                onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              >
                {ACTIVITY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Descrição <span className="text-danger-500 normal-case font-normal">*obrigatório</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Descreva a atividade realizada com detalhes relevantes..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition resize-none"
              />
            </div>

            {/* Executed by */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Executado por
              </label>
              <input
                value={form.executed_by}
                onChange={e => setForm(f => ({ ...f, executed_by: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row pt-1">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => create()}
                disabled={!form.description || isPending}
                className="flex-1 px-4 py-2.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {isPending ? 'Salvando...' : 'Registrar Atividade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-8 justify-center text-gray-400 text-sm">
          <span className="animate-spin">⟳</span>
          Carregando atividades...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (activities as Activity[]).length === 0 && (
        <EmptyState
          icon="📝"
          title="Nenhuma atividade registrada"
          description="Registre as ações executadas pela assessoria para documentar o trabalho realizado."
          action={
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors"
            >
              + Registrar primeira atividade
            </button>
          }
        />
      )}

      {/* Timeline grouped by date */}
      {!isLoading && groups.length > 0 && (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.dateKey}>
              {/* Date divider */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Timeline entries */}
              <div className="relative">
                {/* Vertical connector line */}
                <div className="absolute left-4 top-5 bottom-1 w-0.5 bg-gradient-to-b from-gray-300 to-transparent" aria-hidden="true" />

                <div className="space-y-3">
                  {group.items.map((act) => {
                    const dotColorClass = typeDotColor(act.activity_type);
                    return (
                      <div key={act.id} className="relative flex items-start gap-4 pl-11">
                        {/* Timeline dot */}
                        <div
                          className={[
                            'absolute left-0 top-3 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm flex-shrink-0 shadow-sm bg-white z-10',
                            dotColorClass,
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          {typeIcon(act.activity_type)}
                        </div>

                        {/* Card */}
                        <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <Badge label={typeLabel(act.activity_type)} className="bg-brand-100 text-brand-700" />
                              <span className="text-xs text-gray-400">
                                por <span className="font-medium text-gray-500">{act.executed_by}</span>
                              </span>
                            </div>
                            <time className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                              {fmtTimestamp(act.executed_at)}
                            </time>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                            {act.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
