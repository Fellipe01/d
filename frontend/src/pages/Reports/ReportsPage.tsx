import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '../../store';
import { reportsApi, Report } from '../../api/reports.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { fmtDate } from '../../utils/formatters';

const REPORT_TYPES = [
  { value: 'weekly_mon', label: '📅 Segunda — Semana Anterior', description: 'Análise completa da semana encerrada' },
  { value: 'weekly_wed', label: '📊 Quarta — Semana Atual', description: 'Inteligência de meio de semana' },
  { value: 'weekly_fri', label: '✅ Sexta — Atividades', description: 'Relatório de trabalho executado' },
  { value: 'manual', label: '📝 Manual', description: 'Relatório pontual sob demanda' },
];

const TYPE_LABELS: Record<string, string> = {
  weekly_mon: 'Segunda-feira',
  weekly_wed: 'Quarta-feira',
  weekly_fri: 'Sexta-feira',
  manual: 'Manual',
};

export default function ReportsPage() {
  const { selectedClientId } = useAppStore();
  const qc = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', selectedClientId],
    queryFn: () => reportsApi.list(selectedClientId!),
    enabled: !!selectedClientId,
  });

  const { mutate: generate, isPending } = useMutation({
    mutationFn: (type: string) => reportsApi.generate(selectedClientId!, type),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['reports', selectedClientId] }); setSelectedReport(r); },
  });

  const { data: fullReport } = useQuery({
    queryKey: ['report', selectedReport?.id],
    queryFn: () => reportsApi.get(selectedReport!.id),
    enabled: !!selectedReport?.id,
  });

  if (!selectedClientId) {
    return <EmptyState icon="👆" title="Selecione um cliente" />;
  }

  if (selectedReport && fullReport) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedReport(null)} className="text-sm text-brand-600 hover:text-brand-800">← Voltar</button>
          <div>
            <h2 className="font-semibold text-gray-900">Relatório de {TYPE_LABELS[fullReport.report_type] || fullReport.report_type}</h2>
            <p className="text-sm text-gray-500">{fmtDate(fullReport.period_start)} a {fmtDate(fullReport.period_end)}</p>
          </div>
        </div>
        <Card>
          <div className="prose text-sm max-w-none">
            <ReactMarkdown>{fullReport.content || ''}</ReactMarkdown>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generation buttons */}
      <Card title="Gerar Relatório">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REPORT_TYPES.map(type => (
            <button key={type.value}
              onClick={() => generate(type.value)}
              disabled={isPending}
              className="text-left p-4 border border-gray-200 rounded-xl hover:border-brand-300 hover:bg-brand-50 transition-colors disabled:opacity-50">
              <div className="font-medium text-gray-800">{type.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{type.description}</div>
            </button>
          ))}
        </div>
        {isPending && (
          <div className="mt-3 text-sm text-gray-500 animate-pulse flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Gerando relatório com IA...
          </div>
        )}
      </Card>

      {/* History */}
      {isLoading && <div className="text-gray-500 text-sm">Carregando...</div>}
      {!isLoading && reports.length === 0 && (
        <EmptyState icon="📋" title="Nenhum relatório gerado" description="Gere o primeiro relatório acima." />
      )}

      <div className="space-y-2">
        {(reports as Report[]).map(report => (
          <div key={report.id}
            onClick={() => setSelectedReport(report)}
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-brand-300 cursor-pointer transition-colors">
            <div>
              <div className="font-medium text-gray-800">{TYPE_LABELS[report.report_type] || report.report_type}</div>
              <div className="text-sm text-gray-500">{fmtDate(report.period_start)} a {fmtDate(report.period_end)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {new Date(report.generated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <Badge label={report.status} className={report.status === 'published' ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-600'} />
              <span className="text-gray-400">→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
