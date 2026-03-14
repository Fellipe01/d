import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store';
import { activitiesApi, Activity } from '../../api/activities.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

const ACTIVITY_TYPES = [
  { value: 'budget_change', label: 'Ajuste de Orçamento', icon: '💰' },
  { value: 'creative_pause', label: 'Criativo Pausado', icon: '⏸️' },
  { value: 'creative_launch', label: 'Criativo Lançado', icon: '🚀' },
  { value: 'campaign_pause', label: 'Campanha Pausada', icon: '⏸️' },
  { value: 'campaign_launch', label: 'Campanha Lançada', icon: '📣' },
  { value: 'kpi_update', label: 'KPI Atualizado', icon: '🎯' },
  { value: 'optimization', label: 'Otimização', icon: '⚙️' },
  { value: 'meeting', label: 'Reunião', icon: '🤝' },
  { value: 'note', label: 'Observação', icon: '📝' },
];

export default function ActivitiesPage() {
  const { selectedClientId } = useAppStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ activity_type: 'optimization', description: '', executed_by: 'DAE Assessoria' });

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

  function typeIcon(type: string) {
    return ACTIVITY_TYPES.find(t => t.value === type)?.icon || '📝';
  }

  function typeLabel(type: string) {
    return ACTIVITY_TYPES.find(t => t.value === type)?.label || type;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Atividades</h2>
          <p className="text-sm text-gray-500">{activities.length} registro(s)</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium">
          + Registrar Atividade
        </button>
      </div>

      {showForm && (
        <Card title="Nova Atividade">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Tipo</label>
              <select value={form.activity_type} onChange={e => setForm(f => ({...f, activity_type: e.target.value}))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {ACTIVITY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Descrição *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                rows={3} placeholder="Descreva a atividade realizada..."
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Executado por</label>
              <input value={form.executed_by} onChange={e => setForm(f => ({...f, executed_by: e.target.value}))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={() => create()} disabled={!form.description || isPending}
                className="flex-1 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {isPending ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {isLoading && <div className="text-gray-500 text-sm">Carregando...</div>}

      {!isLoading && activities.length === 0 && (
        <EmptyState icon="📝" title="Nenhuma atividade registrada"
          description="Registre as ações executadas pela assessoria para documentar o trabalho realizado." />
      )}

      <div className="space-y-2">
        {(activities as Activity[]).map(act => (
          <div key={act.id} className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl">
            <div className="text-xl flex-shrink-0">{typeIcon(act.activity_type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge label={typeLabel(act.activity_type)} className="bg-brand-100 text-brand-700" />
                <span className="text-xs text-gray-400">por {act.executed_by}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{act.description}</p>
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(act.executed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
