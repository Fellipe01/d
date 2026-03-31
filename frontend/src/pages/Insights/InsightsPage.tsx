// TODO: Consider merging InsightsPage and AlertsPage into a single "Intelligence" page
// with two tabs (Insights | Alerts). Both features are AI-generated intelligence outputs
// that share the same conceptual layer — keeping them together would reduce navigation
// steps and let users correlate insights with the alerts that triggered them.
// The combined page could live at /intelligence, with the current routes redirecting.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAppStore } from '../../store';
import { insightsApi, Insight } from '../../api/insights.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { impactColor, impactLabel } from '../../utils/formatters';

const REPORT_TYPES = [
  { value: 'manual',     label: 'Análise Manual',                        icon: '🖊️' },
  { value: 'weekly_mon', label: 'Relatório de Segunda (semana anterior)', icon: '📅' },
  { value: 'weekly_wed', label: 'Relatório de Quarta (semana atual)',     icon: '📊' },
  { value: 'weekly_fri', label: 'Relatório de Sexta (atividades)',        icon: '✅' },
];

function relativeTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return new Date(iso).toLocaleDateString('pt-BR');
  }
}

function InsightCard({
  insight,
  expanded,
  onToggle,
  onAction,
  onArchive,
}: {
  insight: Insight;
  expanded: boolean;
  onToggle: () => void;
  onAction: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Top accent strip colored by impact */}
      <div
        className={`h-1 w-full ${
          insight.impact_level === 'critical' ? 'bg-danger-500' :
          insight.impact_level === 'high'     ? 'bg-orange-500' :
          insight.impact_level === 'medium'   ? 'bg-warning-500' :
                                                'bg-gray-300'
        }`}
      />

      <div className="p-4">
        {/* Header row: badges + timestamp + actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge
              label={impactLabel(insight.impact_level)}
              className={impactColor(insight.impact_level)}
            />
            <Badge
              label={insight.category}
              className="bg-gray-100 text-gray-600 capitalize"
            />
            <span className="text-xs text-gray-400 hidden sm:inline">
              {relativeTime(insight.generated_at)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={onAction}
              className="text-xs px-2.5 py-1 border border-success-500 text-success-700 rounded-lg hover:bg-success-100 transition-colors font-medium whitespace-nowrap"
            >
              ✓ Acionado
            </button>
            <button
              onClick={onArchive}
              className="text-xs px-2.5 py-1 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              Arquivar
            </button>
          </div>
        </div>

        {/* Timestamp on mobile (shown below badges) */}
        <div className="sm:hidden mt-1 text-xs text-gray-400">
          {relativeTime(insight.generated_at)}
        </div>

        {/* Summary */}
        {insight.summary && (
          <p className="text-sm text-gray-700 mt-3 leading-relaxed line-clamp-3 sm:line-clamp-none">
            {insight.summary}
          </p>
        )}

        {/* Expand toggle */}
        <button
          onClick={onToggle}
          className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"
        >
          {expanded ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Recolher análise
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Ver análise completa
            </>
          )}
        </button>

        {/* Full markdown content */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{insight.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const { selectedClientId, dateRange } = useAppStore();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [reportType, setReportType] = useState('manual');

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['insights', selectedClientId],
    queryFn: () => insightsApi.list(selectedClientId!, 50),
    enabled: !!selectedClientId,
  });

  const { mutate: generate, isPending } = useMutation({
    mutationFn: () => insightsApi.generate(selectedClientId!, {
      start: dateRange.start,
      end: dateRange.end,
      report_type: reportType,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights', selectedClientId] }),
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      insightsApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights', selectedClientId] }),
  });

  if (!selectedClientId) {
    return (
      <EmptyState
        icon="👆"
        title="Selecione um cliente"
        description="Escolha um cliente para gerar e visualizar insights."
      />
    );
  }

  const active   = (insights as Insight[]).filter(i => i.status === 'active');
  const archived = (insights as Insight[]).filter(i => i.status !== 'active');

  return (
    <div className="space-y-5">
      {/* ── Generator Card ────────────────────────────────────────────── */}
      <Card title="Gerar Insight com IA" subtitle="A IA analisa KPIs, criativos e funil do período selecionado" accent>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Tipo de relatório
            </label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {REPORT_TYPES.map(t => (
                <option key={t.value} value={t.value}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => generate()}
            disabled={isPending}
            className="sm:flex-shrink-0 px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Gerando análise...
              </>
            ) : (
              <>
                <span>💡</span>
                Gerar Insight
              </>
            )}
          </button>
        </div>

        {isPending && (
          <div className="mt-4 flex items-start gap-3 p-3 bg-brand-50 rounded-lg border border-brand-100">
            <svg className="animate-spin w-4 h-4 text-brand-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-sm text-brand-700">
              A IA está analisando os dados da conta...{' '}
              <span className="text-brand-500">Isso pode levar alguns segundos.</span>
            </p>
          </div>
        )}
      </Card>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-brand-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      )}

      {/* ── Empty State ──────────────────────────────────────────────── */}
      {!isLoading && insights.length === 0 && (
        <EmptyState
          icon="💡"
          title="Nenhum insight gerado"
          description="Clique em 'Gerar Insight' para que a IA analise os dados deste cliente."
        />
      )}

      {/* ── Active Insights ───────────────────────────────────────────── */}
      {active.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Insights Ativos
            </h3>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
              {active.length}
            </span>
          </div>

          {active.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              expanded={expanded === insight.id}
              onToggle={() => setExpanded(expanded === insight.id ? null : insight.id)}
              onAction={() => updateStatus({ id: insight.id, status: 'actioned' })}
              onArchive={() => updateStatus({ id: insight.id, status: 'archived' })}
            />
          ))}
        </section>
      )}

      {/* ── Archived / History ────────────────────────────────────────── */}
      {archived.length > 0 && (
        <details className="group">
          <summary className="list-none cursor-pointer flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 select-none">
            <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Histórico arquivado ({archived.length})
          </summary>

          <div className="mt-3 space-y-2">
            {archived.map(insight => (
              <div
                key={insight.id}
                className="bg-gray-50 border border-gray-100 rounded-xl p-3 opacity-70"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    label={impactLabel(insight.impact_level)}
                    className={impactColor(insight.impact_level)}
                  />
                  <Badge
                    label={insight.status === 'actioned' ? 'Acionado' : 'Arquivado'}
                    className="bg-gray-200 text-gray-600"
                  />
                  <span className="text-xs text-gray-400">
                    {new Date(insight.generated_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {insight.summary && (
                  <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{insight.summary}</p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
