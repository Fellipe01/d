import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { clientsApi, Client, ClientKpi } from '../../api/clients.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

const KPI_OPTIONS = [
  { name: 'cpl', label: 'CPL (Custo por Lead)', type: 'lower_is_better' },
  { name: 'ctr', label: 'CTR (%)', type: 'higher_is_better' },
  { name: 'cpc', label: 'CPC (Custo por Clique)', type: 'lower_is_better' },
  { name: 'cpm', label: 'CPM (Custo por Mil)', type: 'lower_is_better' },
  { name: 'frequency', label: 'Frequência Máxima', type: 'lower_is_better' },
  { name: 'cost_per_message', label: 'Custo por Mensagem', type: 'lower_is_better' },
  { name: 'cost_per_follower', label: 'Custo por Seguidor', type: 'lower_is_better' },
  { name: 'leads', label: 'Leads Mínimos', type: 'higher_is_better' },
  { name: 'roas', label: 'ROAS Mínimo', type: 'higher_is_better' },
];

const OBJECTIVES = ['leads', 'whatsapp', 'vendas', 'seguidores', 'trafego', 'alcance'];

function ClientForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', ad_account: '', payment_method: '',
    objectives: [] as string[], monthly_budget: '',
    status: 'active' as const,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: Partial<Client>) => clientsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); onClose(); },
  });

  function toggle(obj: string) {
    setForm(f => ({
      ...f,
      objectives: f.objectives.includes(obj) ? f.objectives.filter(o => o !== obj) : [...f.objectives, obj],
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="font-bold text-lg mb-4">Novo Cliente</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Nome *</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Nome do cliente" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Conta de Anúncios (Meta)</label>
            <input value={form.ad_account} onChange={e => setForm(f => ({...f, ad_account: e.target.value}))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="act_123456789" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Budget Mensal (R$)</label>
            <input type="number" value={form.monthly_budget} onChange={e => setForm(f => ({...f, monthly_budget: e.target.value}))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="5000" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Objetivos</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {OBJECTIVES.map(obj => (
                <button key={obj} type="button" onClick={() => toggle(obj)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.objectives.includes(obj) ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:border-brand-400'}`}>
                  {obj}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => mutate({ ...form, monthly_budget: Number(form.monthly_budget) || undefined })}
            disabled={!form.name || isPending}
            className="flex-1 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {isPending ? 'Salvando...' : 'Criar Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}

function KPIModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: existingKpis = [] } = useQuery({
    queryKey: ['kpis', client.id],
    queryFn: () => clientsApi.getKpis(client.id),
  });

  const [kpis, setKpis] = useState<Partial<ClientKpi>[]>([]);

  const merged = KPI_OPTIONS.map(opt => {
    const existing = existingKpis.find((k: ClientKpi) => k.kpi_name === opt.name);
    const local = kpis.find(k => k.kpi_name === opt.name);
    return { ...opt, ...(existing || {}), ...(local || {}), enabled: !!(existing || local) };
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: Partial<ClientKpi>[]) => clientsApi.upsertKpis(client.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpis', client.id] }); onClose(); },
  });

  function updateKpi(name: string, field: string, value: unknown) {
    setKpis(prev => {
      const existing = prev.find(k => k.kpi_name === name);
      if (existing) return prev.map(k => k.kpi_name === name ? { ...k, [field]: value } : k);
      const opt = KPI_OPTIONS.find(o => o.name === name)!;
      return [...prev, { kpi_name: name, kpi_type: opt.type as ClientKpi['kpi_type'], target_value: 0, weight: 1.0, [field]: value }];
    });
  }

  const activeKpis = merged.filter(k => k.enabled || kpis.find(lk => lk.kpi_name === k.name));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-lg mb-1">KPIs — {client.name}</h2>
        <p className="text-sm text-gray-500 mb-4">Configure as metas e pesos de cada KPI. KPIs com maior peso influenciam mais a análise da IA.</p>
        <div className="space-y-3">
          {KPI_OPTIONS.map(opt => {
            const kpi = merged.find(k => k.name === opt.name)!;
            const isActive = !!(existingKpis.find((k: ClientKpi) => k.kpi_name === opt.name) || kpis.find(k => k.kpi_name === opt.name));
            return (
              <div key={opt.name} className={`border rounded-lg p-3 transition-colors ${isActive ? 'border-brand-300 bg-brand-50' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={isActive}
                    onChange={e => e.target.checked
                      ? updateKpi(opt.name, 'target_value', 0)
                      : setKpis(prev => prev.filter(k => k.kpi_name !== opt.name))}
                    className="w-4 h-4 accent-brand-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.type === 'lower_is_better' ? '↓ menor é melhor' : '↑ maior é melhor'}</div>
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">Meta</div>
                        <input type="number" step="0.01"
                          defaultValue={kpi.target_value || 0}
                          onChange={e => updateKpi(opt.name, 'target_value', Number(e.target.value))}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">Peso (0.5–2.0)</div>
                        <input type="number" step="0.1" min="0.5" max="2.0"
                          defaultValue={kpi.weight || 1.0}
                          onChange={e => updateKpi(opt.name, 'weight', Number(e.target.value))}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => mutate(kpis.filter(k => k.kpi_name && k.target_value !== undefined))}
            disabled={isPending}
            className="flex-1 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {isPending ? 'Salvando...' : 'Salvar KPIs'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const [showNew, setShowNew] = useState(false);
  const [kpiClient, setKpiClient] = useState<Client | null>(null);
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: clientsApi.list,
  });

  const { mutate: seedMock } = useMutation({
    mutationFn: (id: number) => clientsApi.seedMock(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); alert('Dados mock carregados!'); },
  });

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-success-100 text-success-700';
    if (s === 'paused') return 'bg-warning-100 text-warning-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500">{clients.length} cliente(s) cadastrado(s)</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium">
          + Novo Cliente
        </button>
      </div>

      {isLoading && <div className="text-gray-500 text-sm">Carregando...</div>}

      {!isLoading && clients.length === 0 && (
        <EmptyState icon="👥" title="Nenhum cliente cadastrado"
          description="Crie o primeiro cliente para começar a gerenciar campanhas."
          action={<button onClick={() => setShowNew(true)} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg">+ Novo Cliente</button>} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(clients as Client[]).map(client => (
          <Card key={client.id} className="hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{client.name}</h3>
                <div className="text-xs text-gray-500 mt-0.5">{client.ad_account || 'Sem conta vinculada'}</div>
              </div>
              <Badge label={client.status} className={statusColor(client.status)} />
            </div>

            {client.objectives?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {client.objectives.map(obj => (
                  <Badge key={obj} label={obj} className="bg-brand-100 text-brand-700" />
                ))}
              </div>
            )}

            {client.monthly_budget && (
              <div className="text-sm text-gray-600 mb-3">
                Budget mensal: <span className="font-medium">R$ {client.monthly_budget.toLocaleString('pt-BR')}</span>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setKpiClient(client)}
                className="px-3 py-1.5 text-xs border border-brand-300 text-brand-600 rounded-lg hover:bg-brand-50">
                Configurar KPIs
              </button>
              <button
                onClick={() => seedMock(client.id)}
                className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
                Carregar Mock
              </button>
            </div>
          </Card>
        ))}
      </div>

      {showNew && <ClientForm onClose={() => setShowNew(false)} />}
      {kpiClient && <KPIModal client={kpiClient} onClose={() => setKpiClient(null)} />}
    </div>
  );
}
