import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, Client, ClientKpi } from '../../api/clients.api';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

// NOTE: The OBJECTIVES list and KPI_OPTIONS here belong to the client configuration
// experience and are intentionally kept on this page for discoverability. However,
// a case can be made for moving them to AdminPage (or a dedicated "Settings" page)
// so that non-admin operators cannot accidentally change client objectives/KPI targets.
// If that separation is desired, move KPI_OPTIONS + OBJECTIVES + KPIModal into AdminPage
// and expose a read-only view of objectives here.

const KPI_OPTIONS = [
  { name: 'cpl',               label: 'CPL (Custo por Lead)',    type: 'lower_is_better'  },
  { name: 'ctr',               label: 'CTR (%)',                  type: 'higher_is_better' },
  { name: 'cpc',               label: 'CPC (Custo por Clique)',   type: 'lower_is_better'  },
  { name: 'cpm',               label: 'CPM (Custo por Mil)',      type: 'lower_is_better'  },
  { name: 'frequency',         label: 'Frequência Máxima',        type: 'lower_is_better'  },
  { name: 'cost_per_message',  label: 'Custo por Mensagem',       type: 'lower_is_better'  },
  { name: 'messages',          label: 'Mensagens Mínimas',        type: 'higher_is_better' },
  { name: 'cost_per_follower', label: 'Custo por Seguidor',       type: 'lower_is_better'  },
  { name: 'leads',             label: 'Leads Mínimos',            type: 'higher_is_better' },
  { name: 'roas',              label: 'ROAS Mínimo',              type: 'higher_is_better' },
];

const OBJECTIVES = ['leads', 'whatsapp', 'vendas', 'seguidores', 'trafego', 'alcance'];

// ── Shared input style ─────────────────────────────────────────────────────────
const inputCls =
  'mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors placeholder-gray-400';

const labelCls = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide';

// ── Avatar ─────────────────────────────────────────────────────────────────────
function ClientAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  // Deterministic color from name
  const palette = [
    'from-brand-500 to-brand-700',
    'from-purple-500 to-purple-700',
    'from-emerald-500 to-emerald-700',
    'from-orange-500 to-orange-700',
    'from-pink-500 to-pink-700',
    'from-teal-500 to-teal-700',
  ];
  const idx = name.charCodeAt(0) % palette.length;
  return (
    <div
      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${palette[idx]} flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm`}
    >
      {initials || '?'}
    </div>
  );
}

// ── Status dot + badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { dot: string; bg: string; text: string; label: string }> = {
    active:  { dot: 'bg-success-500', bg: 'bg-success-100', text: 'text-success-700', label: 'Ativo' },
    paused:  { dot: 'bg-warning-500', bg: 'bg-warning-100', text: 'text-warning-700', label: 'Pausado' },
    churned: { dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-600',    label: 'Churned' },
  };
  const s = map[status] ?? map.churned;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Objective pill colors ──────────────────────────────────────────────────────
const objectiveColor: Record<string, string> = {
  leads:     'bg-blue-100 text-blue-700',
  whatsapp:  'bg-green-100 text-green-700',
  vendas:    'bg-purple-100 text-purple-700',
  seguidores:'bg-pink-100 text-pink-700',
  trafego:   'bg-orange-100 text-orange-700',
  alcance:   'bg-teal-100 text-teal-700',
};

// ── Sync row ───────────────────────────────────────────────────────────────────
function SyncRow({
  label, syncedAt, syncing, disabled, onSync,
}: {
  label: string; syncedAt: string | null | undefined;
  syncing: boolean; disabled?: boolean;
  onSync: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="min-w-0">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {syncedAt ? (
          <span className="ml-2 text-xs text-gray-400">
            {new Date(syncedAt).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        ) : (
          <span className="ml-2 text-xs text-gray-300">{disabled ? 'sem token' : 'nunca'}</span>
        )}
      </div>
      <button
        onClick={onSync}
        disabled={syncing || !!disabled}
        className="ml-3 shrink-0 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors
          border-gray-200 text-gray-500 hover:bg-gray-50
          disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {syncing ? (
          <span className="inline-flex items-center gap-1">
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Sync
          </span>
        ) : (
          '↺ Sync'
        )}
      </button>
    </div>
  );
}

// ── New Client Modal ───────────────────────────────────────────────────────────
function ClientForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', ad_account: '', rdstation_token: '', payment_method: '',
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
      objectives: f.objectives.includes(obj)
        ? f.objectives.filter(o => o !== obj)
        : [...f.objectives, obj],
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl sm:rounded-t-2xl">
          <h2 className="font-bold text-gray-900 text-base">Novo Cliente</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls}
              placeholder="Nome do cliente"
            />
          </div>
          <div>
            <label className={labelCls}>Conta de Anúncios (Meta)</label>
            <input
              value={form.ad_account}
              onChange={e => setForm(f => ({ ...f, ad_account: e.target.value }))}
              className={inputCls}
              placeholder="act_123456789"
            />
          </div>
          <div>
            <label className={labelCls}>Token RD Station</label>
            <input
              value={form.rdstation_token}
              onChange={e => setForm(f => ({ ...f, rdstation_token: e.target.value }))}
              className={inputCls}
              placeholder="Token de acesso do RD Station"
            />
          </div>
          <div>
            <label className={labelCls}>Budget Mensal (R$)</label>
            <input
              type="number"
              value={form.monthly_budget}
              onChange={e => setForm(f => ({ ...f, monthly_budget: e.target.value }))}
              className={inputCls}
              placeholder="5000"
            />
          </div>
          <div>
            <label className={labelCls}>Objetivos</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {OBJECTIVES.map(obj => (
                <button
                  key={obj}
                  type="button"
                  onClick={() => toggle(obj)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                    form.objectives.includes(obj)
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-brand-400 hover:text-brand-600 bg-white'
                  }`}
                >
                  {obj}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutate({
              ...form,
              monthly_budget: Number(form.monthly_budget) || undefined,
              rdstation_token: form.rdstation_token || undefined,
            })}
            disabled={!form.name || isPending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Salvando...' : 'Criar Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Client Modal ──────────────────────────────────────────────────────────
function EditClientModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: client.name,
    ad_account: client.ad_account ?? '',
    rdstation_token: client.rdstation_token ?? '',
    rd_fonte_field: client.rd_fonte_field ?? '',
    rd_campanha_field: client.rd_campanha_field ?? '',
    rd_criativo_field: client.rd_criativo_field ?? '',
    rd_pipeline_id: client.rd_pipeline_id ?? '',
    rd_mql_stage: client.rd_mql_stage ?? '',
    rd_sql_stage: client.rd_sql_stage ?? '',
    rd_venda_stage: client.rd_venda_stage ?? '',
    payment_method: client.payment_method ?? '',
    monthly_budget: client.monthly_budget?.toString() ?? '',
    status: client.status,
    objectives: client.objectives ?? [] as string[],
    saldo_pix_enabled: client.saldo_pix_enabled ?? false,
    saldo_pix_amount: client.saldo_pix_amount?.toString() ?? '',
    saldo_pix_threshold: client.saldo_pix_threshold?.toString() ?? '',
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: Partial<Client>) => clientsApi.update(client.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); onClose(); },
  });

  function toggle(obj: string) {
    setForm(f => ({
      ...f,
      objectives: f.objectives.includes(obj)
        ? f.objectives.filter(o => o !== obj)
        : [...f.objectives, obj],
    }));
  }

  // Group sections for cleaner layout
  const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
    <div className="border-t border-gray-100 pt-4 mt-2">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{title}</p>
      {description && <p className="text-xs text-gray-400 mb-3">{description}</p>}
      <div className="space-y-3">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <ClientAvatar name={client.name} />
            <div>
              <h2 className="font-bold text-gray-900 text-sm leading-tight">Editar Cliente</h2>
              <p className="text-xs text-gray-400">{client.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {/* Basic */}
          <div>
            <label className={labelCls}>Nome *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Client['status'] }))}
                className={inputCls}
              >
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
                <option value="churned">Churned</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Budget Mensal (R$)</label>
              <input
                type="number"
                value={form.monthly_budget}
                onChange={e => setForm(f => ({ ...f, monthly_budget: e.target.value }))}
                className={inputCls}
                placeholder="5000"
              />
            </div>
          </div>

          {/* Objectives */}
          <div>
            <label className={labelCls}>Objetivos</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {OBJECTIVES.map(obj => (
                <button
                  key={obj}
                  type="button"
                  onClick={() => toggle(obj)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                    form.objectives.includes(obj)
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-brand-400 hover:text-brand-600 bg-white'
                  }`}
                >
                  {obj}
                </button>
              ))}
            </div>
          </div>

          {/* Meta */}
          <Section title="Meta Ads">
            <div>
              <label className={labelCls}>Conta de Anúncios</label>
              <input
                value={form.ad_account}
                onChange={e => setForm(f => ({ ...f, ad_account: e.target.value }))}
                className={inputCls}
                placeholder="act_123456789"
              />
            </div>
          </Section>

          {/* RD Station */}
          <Section
            title="RD Station"
            description="Informe o nome exato do campo personalizado no RD Station para cada variável."
          >
            <div>
              <label className={labelCls}>Token de Acesso</label>
              <input
                value={form.rdstation_token}
                onChange={e => setForm(f => ({ ...f, rdstation_token: e.target.value }))}
                className={inputCls}
                placeholder="Token de acesso do RD Station"
              />
              {client.rdstation_token && (
                <p className="text-xs text-success-700 mt-1 font-medium">Token configurado</p>
              )}
            </div>
            <div>
              <label className={labelCls}>ID do Pipeline (Funil)</label>
              <input
                value={form.rd_pipeline_id}
                onChange={e => setForm(f => ({ ...f, rd_pipeline_id: e.target.value }))}
                className={inputCls}
                placeholder="ex: 694e75b478da140017c63c10"
              />
              <p className="text-xs text-gray-400 mt-0.5">Opcional — filtra os deals de um pipeline específico</p>
            </div>
            <div>
              <label className={labelCls}>Valor do Campo "Fonte"</label>
              <input
                value={form.rd_fonte_field}
                onChange={e => setForm(f => ({ ...f, rd_fonte_field: e.target.value }))}
                className={inputCls}
                placeholder="ex: Meta/Ads, Facebook, Meta Ads"
              />
              <p className="text-xs text-gray-400 mt-0.5">Valor que aparece no campo "Fonte" dos deals</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Campo: Campanha</label>
                <input
                  value={form.rd_campanha_field}
                  onChange={e => setForm(f => ({ ...f, rd_campanha_field: e.target.value }))}
                  className={inputCls}
                  placeholder="campanha_de_anuncio"
                />
              </div>
              <div>
                <label className={labelCls}>Campo: Criativo</label>
                <input
                  value={form.rd_criativo_field}
                  onChange={e => setForm(f => ({ ...f, rd_criativo_field: e.target.value }))}
                  className={inputCls}
                  placeholder="criativo"
                />
              </div>
            </div>
          </Section>

          {/* Kanban stages */}
          <Section
            title="Estágios do Kanban"
            description="Nome exato da coluna do Kanban que representa cada etapa do funil."
          >
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>MQL</label>
                <input
                  value={form.rd_mql_stage}
                  onChange={e => setForm(f => ({ ...f, rd_mql_stage: e.target.value }))}
                  className={inputCls}
                  placeholder="ex: Qualificado"
                />
              </div>
              <div>
                <label className={labelCls}>SQL</label>
                <input
                  value={form.rd_sql_stage}
                  onChange={e => setForm(f => ({ ...f, rd_sql_stage: e.target.value }))}
                  className={inputCls}
                  placeholder="ex: Proposta"
                />
              </div>
              <div>
                <label className={labelCls}>Venda</label>
                <input
                  value={form.rd_venda_stage}
                  onChange={e => setForm(f => ({ ...f, rd_venda_stage: e.target.value }))}
                  className={inputCls}
                  placeholder="ex: Fechado"
                />
              </div>
            </div>
          </Section>

          {/* Saldo PIX */}
          <Section title="Saldo PIX">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.saldo_pix_enabled}
                onChange={e => setForm(f => ({ ...f, saldo_pix_enabled: e.target.checked }))}
                className="w-4 h-4 accent-brand-600"
              />
              <span className="text-sm font-medium text-gray-700">Cliente paga via Saldo PIX</span>
            </label>
            {form.saldo_pix_enabled && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className={labelCls}>Saldo disponível (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.saldo_pix_amount}
                    onChange={e => setForm(f => ({ ...f, saldo_pix_amount: e.target.value }))}
                    className={inputCls}
                    placeholder="ex: 1500.00"
                  />
                  <p className="text-xs text-gray-400 mt-0.5">Saldo atual na conta</p>
                </div>
                <div>
                  <label className={labelCls}>Alertar abaixo de (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.saldo_pix_threshold}
                    onChange={e => setForm(f => ({ ...f, saldo_pix_threshold: e.target.value }))}
                    className={inputCls}
                    placeholder="ex: 300.00"
                  />
                  <p className="text-xs text-gray-400 mt-0.5">Gera alerta automático</p>
                </div>
              </div>
            )}
          </Section>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutate({
              ...form,
              monthly_budget: Number(form.monthly_budget) || undefined,
              rdstation_token: form.rdstation_token || undefined,
              rd_fonte_field: form.rd_fonte_field || undefined,
              rd_campanha_field: form.rd_campanha_field || undefined,
              rd_criativo_field: form.rd_criativo_field || undefined,
              rd_pipeline_id: form.rd_pipeline_id || undefined,
              rd_mql_stage: form.rd_mql_stage || undefined,
              rd_sql_stage: form.rd_sql_stage || undefined,
              rd_venda_stage: form.rd_venda_stage || undefined,
              saldo_pix_amount: form.saldo_pix_enabled ? (Number(form.saldo_pix_amount) || 0) : undefined,
              saldo_pix_threshold: form.saldo_pix_enabled ? (Number(form.saldo_pix_threshold) || 0) : undefined,
            })}
            disabled={!form.name || isPending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KPI Modal ──────────────────────────────────────────────────────────────────
function KPIModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: existingKpis = [] } = useQuery({
    queryKey: ['kpis', client.id],
    queryFn: () => clientsApi.getKpis(client.id),
  });

  // activeKpis: starts from what's in the DB, user can toggle/edit
  const [activeKpis, setActiveKpis] = useState<Partial<ClientKpi>[] | null>(null);

  // Initialise once existingKpis loads
  const working: Partial<ClientKpi>[] = activeKpis ?? (existingKpis as ClientKpi[]).map(k => ({ ...k }));

  const isActive = (name: string) => working.some(k => k.kpi_name === name);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: Partial<ClientKpi>[]) => clientsApi.upsertKpis(client.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpis', client.id] }); onClose(); },
  });

  function toggleKpi(name: string, checked: boolean) {
    const base = activeKpis ?? (existingKpis as ClientKpi[]).map(k => ({ ...k }));
    if (checked) {
      const opt = KPI_OPTIONS.find(o => o.name === name)!;
      setActiveKpis([...base, { kpi_name: name, kpi_type: opt.type as ClientKpi['kpi_type'], target_value: 0, weight: 1.0 }]);
    } else {
      setActiveKpis(base.filter(k => k.kpi_name !== name));
    }
  }

  function updateKpi(name: string, field: string, value: unknown) {
    const base = activeKpis ?? (existingKpis as ClientKpi[]).map(k => ({ ...k }));
    if (base.some(k => k.kpi_name === name)) {
      setActiveKpis(base.map(k => k.kpi_name === name ? { ...k, [field]: value } : k));
    } else {
      const opt = KPI_OPTIONS.find(o => o.name === name)!;
      setActiveKpis([...base, { kpi_name: name, kpi_type: opt.type as ClientKpi['kpi_type'], target_value: 0, weight: 1.0, [field]: value }]);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Configurar KPIs</h2>
            <p className="text-xs text-gray-400 mt-0.5">{client.name} — maior peso = mais influência na análise IA</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-2">
          {KPI_OPTIONS.map(opt => {
            const active = isActive(opt.name);
            const kpiRow = working.find(k => k.kpi_name === opt.name);
            return (
              <label
                key={opt.name}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  active ? 'border-brand-300 bg-brand-50' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => toggleKpi(opt.name, e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-brand-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{opt.label}</div>
                  <div className="text-xs text-gray-400">
                    {opt.type === 'lower_is_better' ? '↓ menor é melhor' : '↑ maior é melhor'}
                  </div>
                </div>
                {active && (
                  <div className="flex items-center gap-3 shrink-0">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Meta</div>
                      <input
                        type="number"
                        step="0.01"
                        value={kpiRow?.target_value ?? 0}
                        onChange={e => updateKpi(opt.name, 'target_value', Number(e.target.value))}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Peso</div>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="2.0"
                        value={kpiRow?.weight ?? 1.0}
                        onChange={e => updateKpi(opt.name, 'weight', Number(e.target.value))}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                )}
              </label>
            );
          })}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutate(working.filter(k => k.kpi_name && k.target_value !== undefined))}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Salvando...' : 'Salvar KPIs'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Client Card ────────────────────────────────────────────────────────────────
function ClientCard({
  client,
  syncingMeta,
  syncingRd,
  onSyncMeta,
  onSyncRd,
  onEdit,
  onKpi,
  onDelete,
}: {
  client: Client;
  syncingMeta: number | null;
  syncingRd: number | null;
  onSyncMeta: (c: Client) => void;
  onSyncRd: (c: Client) => void;
  onEdit: (c: Client) => void;
  onKpi: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden">
      {/* Card header */}
      <div className="p-5 flex items-start gap-4">
        <ClientAvatar name={client.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{client.name}</h3>
            <StatusBadge status={client.status} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {client.ad_account || 'Sem conta de anúncios vinculada'}
          </p>
        </div>
      </div>

      {/* Budget + objectives */}
      <div className="px-5 pb-4 flex-1">
        {client.monthly_budget ? (
          <div className="mb-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-gray-900 tracking-tight">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(client.monthly_budget)}
            </span>
            <span className="text-xs text-gray-400 font-medium">/mês</span>
          </div>
        ) : (
          <div className="mb-3 text-sm text-gray-300 italic">Sem budget definido</div>
        )}

        {client.objectives?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {client.objectives.map(obj => (
              <Badge
                key={obj}
                label={obj}
                className={objectiveColor[obj] ?? 'bg-gray-100 text-gray-600'}
              />
            ))}
          </div>
        )}

        {/* Saldo PIX */}
        {client.saldo_pix_enabled && (
          <div className={`flex items-center gap-2 mb-3 text-sm ${
            client.saldo_pix_amount !== null && client.saldo_pix_threshold !== null && client.saldo_pix_amount <= client.saldo_pix_threshold
              ? 'text-orange-700 font-semibold'
              : 'text-gray-500'
          }`}>
            <span>💳</span>
            <span>
              Saldo PIX:{' '}
              <span className="font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.saldo_pix_amount ?? 0)}
              </span>
            </span>
            {client.saldo_pix_amount !== null && client.saldo_pix_threshold !== null && client.saldo_pix_amount <= client.saldo_pix_threshold && (
              <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">Baixo</span>
            )}
          </div>
        )}

        {/* Sync section */}
        <div className="border-t border-gray-100 pt-3 space-y-0.5">
          <SyncRow
            label="Meta Ads"
            syncedAt={client.last_meta_sync_at}
            syncing={syncingMeta === client.id}
            onSync={() => onSyncMeta(client)}
          />
          <SyncRow
            label="RD Station"
            syncedAt={client.last_rd_sync_at}
            syncing={syncingRd === client.id}
            disabled={!client.rdstation_token}
            onSync={() => onSyncRd(client)}
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center gap-2">
        <button
          onClick={() => onEdit(client)}
          className="px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-white hover:shadow-sm transition-all"
        >
          Editar
        </button>
        <button
          onClick={() => onKpi(client)}
          className="px-3 py-1.5 text-xs font-semibold border border-brand-200 text-brand-600 rounded-lg hover:bg-brand-50 transition-all"
        >
          Configurar KPIs
        </button>
        {client.status !== 'active' && (
          <button
            onClick={() => onDelete(client)}
            title="Excluir cliente"
            className="ml-auto px-2.5 py-1.5 text-xs font-semibold text-danger-600 border border-danger-200 rounded-lg hover:bg-danger-50 transition-all"
          >
            Excluir
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const [showNew, setShowNew] = useState(false);
  const [kpiClient, setKpiClient] = useState<Client | null>(null);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: clientsApi.list,
  });

  const { mutate: seedMock } = useMutation({
    mutationFn: (id: number) => clientsApi.seedMock(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); alert('Dados mock carregados!'); },
  });
  void seedMock; // referenced by card actions; suppress lint

  const [syncingMeta, setSyncingMeta] = useState<number | null>(null);
  const [syncingRd, setSyncingRd] = useState<number | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllProgress, setSyncAllProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleSyncAll() {
    const activeClients = (clients as Client[]).filter(c => c.status === 'active' && c.ad_account);
    if (!activeClients.length) return;
    setSyncingAll(true);
    setSyncAllProgress({ done: 0, total: activeClients.length });
    for (let i = 0; i < activeClients.length; i++) {
      const c = activeClients[i];
      try { await clientsApi.syncMetaAds(c.id); } catch { /* continua */ }
      if (c.rdstation_token) {
        try { await clientsApi.syncRdStation(c.id); } catch { /* continua */ }
      }
      setSyncAllProgress({ done: i + 1, total: activeClients.length });
    }
    setSyncingAll(false);
    setSyncAllProgress(null);
    qc.invalidateQueries({ queryKey: ['clients'] });
  }

  async function handleSyncMeta(client: Client) {
    setSyncingMeta(client.id);
    try {
      await clientsApi.syncMetaAds(client.id);
      qc.invalidateQueries({ queryKey: ['clients'] });
    } catch (err: unknown) {
      alert((err as Error).message || 'Erro ao sincronizar Meta Ads.');
    } finally {
      setSyncingMeta(null);
    }
  }

  async function handleSyncRd(client: Client) {
    if (!client.rdstation_token) {
      alert('Configure o Token RD Station no cliente antes de sincronizar.');
      return;
    }
    setSyncingRd(client.id);
    try {
      await clientsApi.syncRdStation(client.id);
      qc.invalidateQueries({ queryKey: ['clients'] });
    } finally {
      setSyncingRd(null);
    }
  }

  const { mutate: deleteClient } = useMutation({
    mutationFn: (id: number) => clientsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); },
  });

  function handleDelete(client: Client) {
    if (window.confirm(`Excluir "${client.name}"? Esta ação não pode ser desfeita.`)) {
      deleteClient(client.id);
    }
  }

  const activeCount  = (clients as Client[]).filter(c => c.status === 'active').length;
  const pausedCount  = (clients as Client[]).filter(c => c.status === 'paused').length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {(clients as Client[]).length} cadastrado(s)
            {activeCount > 0 && <> · <span className="text-success-700 font-medium">{activeCount} ativos</span></>}
            {pausedCount > 0 && <> · <span className="text-warning-700 font-medium">{pausedCount} pausados</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <span className={syncingAll ? 'animate-spin' : ''}>↻</span>
            {syncingAll && syncAllProgress
              ? `Sync ${syncAllProgress.done}/${syncAllProgress.total}`
              : 'Sync Geral'}
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 shadow-sm transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 h-56 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (clients as Client[]).length === 0 && (
        <EmptyState
          icon="👥"
          title="Nenhum cliente cadastrado"
          description="Crie o primeiro cliente para começar a gerenciar campanhas."
          action={
            <button
              onClick={() => setShowNew(true)}
              className="px-4 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700"
            >
              + Novo Cliente
            </button>
          }
        />
      )}

      {/* Client grid */}
      {!isLoading && (clients as Client[]).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(clients as Client[]).map(client => (
            <ClientCard
              key={client.id}
              client={client}
              syncingMeta={syncingMeta}
              syncingRd={syncingRd}
              onSyncMeta={handleSyncMeta}
              onSyncRd={handleSyncRd}
              onEdit={setEditClient}
              onKpi={setKpiClient}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showNew && <ClientForm onClose={() => setShowNew(false)} />}
      {editClient && <EditClientModal client={editClient} onClose={() => setEditClient(null)} />}
      {kpiClient && <KPIModal client={kpiClient} onClose={() => setKpiClient(null)} />}
    </div>
  );
}
