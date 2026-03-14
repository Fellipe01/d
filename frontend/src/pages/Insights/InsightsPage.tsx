import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '../../store';
import { insightsApi, Insight } from '../../api/insights.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { impactColor, impactLabel } from '../../utils/formatters';

const REPORT_TYPES = [
  { value: 'manual', label: 'Análise Manual' },
  { value: 'weekly_mon', label: 'Relatório de Segunda (semana anterior)' },
  { value: 'weekly_wed', label: 'Relatório de Quarta (semana atual)' },
  { value: 'weekly_fri', label: 'Relatório de Sexta (atividades)' },
];

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
    mutationFn: ({ id, status }: { id: number; status: string }) => insightsApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights', selectedClientId] }),
  });

  if (!selectedClientId) {
    return <EmptyState icon="👆" title="Selecione um cliente" description="Escolha um cliente para gerar e visualizar insights." />;
  }

  const active = (insights as Insight[]).filter(i => i.status === 'active');
  const archived = (insights as Insight[]).filter(i => i.status !== 'active');

  return (
    <div className="space-y-4">
      {/* Generator */}
      <Card title="Gerar Insight com IA">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo de relatório</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button
            onClick={() => generate()}
            disabled={isPending}
            className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
            {isPending ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Gerando análise...
              </>
            ) : '💡 Gerar Insight'}
          </button>
        </div>
        {isPending && (
          <div className="mt-3 text-sm text-gray-500 animate-pulse">
            A IA está analisando os dados da conta... Isso pode levar alguns segundos.
          </div>
        )}
      </Card>

      {isLoading && <div className="text-gray-500 text-sm">Carregando...</div>}

      {!isLoading && insights.length === 0 && (
        <EmptyState icon="💡" title="Nenhum insight gerado"
          description="Clique em 'Gerar Insight' para que a IA analise os dados deste cliente." />
      )}

      {/* Active insights */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Insights Ativos ({active.length})</h3>
          {active.map(insight => (
            <Card key={insight.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge label={impactLabel(insight.impact_level)} className={impactColor(insight.impact_level)} />
                  <Badge label={insight.category} className="bg-gray-100 text-gray-600" />
                  <span className="text-xs text-gray-400">
                    {new Date(insight.generated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus({ id: insight.id, status: 'actioned' })}
                    className="text-xs px-2 py-1 border border-success-500 text-success-700 rounded hover:bg-success-100">
                    ✓ Acionado
                  </button>
                  <button
                    onClick={() => updateStatus({ id: insight.id, status: 'archived' })}
                    className="text-xs px-2 py-1 border border-gray-300 text-gray-500 rounded hover:bg-gray-50">
                    Arquivar
                  </button>
                </div>
              </div>

              {insight.summary && (
                <p className="text-sm text-gray-700 mt-2">{insight.summary}</p>
              )}

              <button
                onClick={() => setExpanded(expanded === insight.id ? null : insight.id)}
                className="mt-2 text-sm text-brand-600 hover:text-brand-800 font-medium">
                {expanded === insight.id ? '▲ Recolher' : '▼ Ver análise completa'}
              </button>

              {expanded === insight.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 prose text-sm max-w-none">
                  <ReactMarkdown>{insight.content}</ReactMarkdown>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700">
            Histórico arquivado ({archived.length})
          </summary>
          <div className="mt-2 space-y-2">
            {archived.map(insight => (
              <div key={insight.id} className="bg-gray-50 rounded-lg p-3 opacity-75">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge label={impactLabel(insight.impact_level)} className={impactColor(insight.impact_level)} />
                  <Badge label={insight.status} className="bg-gray-200 text-gray-600" />
                  <span className="text-xs text-gray-400">{new Date(insight.generated_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {insight.summary && <p className="text-xs text-gray-600 mt-1">{insight.summary}</p>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
