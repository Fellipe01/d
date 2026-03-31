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
  {
    value: 'weekly_mon',
    icon: '📅',
    label: 'Segunda-feira',
    sublabel: 'Semana Anterior',
    description: 'Análise completa da semana encerrada — métricas, criativos e funil.',
    color: 'border-brand-200 hover:border-brand-400 hover:bg-brand-50',
    badgeClass: 'bg-brand-100 text-brand-700',
  },
  {
    value: 'weekly_wed',
    icon: '📊',
    label: 'Quarta-feira',
    sublabel: 'Semana Atual',
    description: 'Inteligência de meio de semana — tendências e alertas precoces.',
    color: 'border-purple-200 hover:border-purple-400 hover:bg-purple-50',
    badgeClass: 'bg-purple-100 text-purple-700',
  },
  {
    value: 'weekly_fri',
    icon: '✅',
    label: 'Sexta-feira',
    sublabel: 'Atividades',
    description: 'Relatório de trabalho executado — tarefas, otimizações e entregas.',
    color: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 'manual',
    icon: '🖊️',
    label: 'Manual',
    sublabel: 'Sob Demanda',
    description: 'Relatório pontual para apresentação ou alinhamento com cliente.',
    color: 'border-gray-200 hover:border-gray-400 hover:bg-gray-50',
    badgeClass: 'bg-gray-100 text-gray-600',
  },
];

const TYPE_LABELS: Record<string, string> = {
  weekly_mon: 'Segunda-feira',
  weekly_wed: 'Quarta-feira',
  weekly_fri: 'Sexta-feira',
  manual:     'Manual',
};

const TYPE_ICONS: Record<string, string> = {
  weekly_mon: '📅',
  weekly_wed: '📊',
  weekly_fri: '✅',
  manual:     '🖊️',
};

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return 'agora mesmo';
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `há ${hours}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function ReportsPage() {
  const { selectedClientId } = useAppStore();
  const qc = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [generatingType, setGeneratingType] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', selectedClientId],
    queryFn: () => reportsApi.list(selectedClientId!),
    enabled: !!selectedClientId,
  });

  const { mutate: generate, isPending } = useMutation({
    mutationFn: (type: string) => reportsApi.generate(selectedClientId!, type),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['reports', selectedClientId] });
      setSelectedReport(r);
      setGeneratingType(null);
    },
    onError: () => setGeneratingType(null),
  });

  const { data: fullReport } = useQuery({
    queryKey: ['report', selectedReport?.id],
    queryFn: () => reportsApi.get(selectedReport!.id),
    enabled: !!selectedReport?.id,
  });

  if (!selectedClientId) {
    return (
      <EmptyState
        icon="👆"
        title="Selecione um cliente"
        description="Escolha um cliente para gerar e visualizar relatórios."
      />
    );
  }

  // ── Report Detail View ────────────────────────────────────────────────────
  if (selectedReport && fullReport) {
    return (
      <div className="space-y-4">
        {/* Back navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-2 border-b border-gray-100">
          <button
            onClick={() => setSelectedReport(null)}
            className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors self-start"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar aos relatórios
          </button>
          <div className="sm:ml-auto text-right">
            <div className="flex items-center gap-2 justify-end flex-wrap">
              <span className="text-base font-semibold text-gray-900">
                {TYPE_ICONS[fullReport.report_type]} {TYPE_LABELS[fullReport.report_type] || fullReport.report_type}
              </span>
              <Badge
                label={fullReport.status === 'published' ? 'Publicado' : fullReport.status}
                className={fullReport.status === 'published' ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-600'}
              />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {fmtDate(fullReport.period_start)} a {fmtDate(fullReport.period_end)}
            </p>
          </div>
        </div>

        <Card>
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{fullReport.content || ''}</ReactMarkdown>
          </div>
        </Card>
      </div>
    );
  }

  // ── Main List View ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Generation Section ──────────────────────────────────────── */}
      <Card title="Gerar Relatório" subtitle="Escolha o tipo de relatório para gerar com IA" accent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REPORT_TYPES.map(type => {
            const isGeneratingThis = isPending && generatingType === type.value;
            return (
              <button
                key={type.value}
                onClick={() => {
                  setGeneratingType(type.value);
                  generate(type.value);
                }}
                disabled={isPending}
                className={`text-left p-4 border-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${type.color} ${isGeneratingThis ? 'ring-2 ring-brand-400' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{type.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{type.label}</span>
                      <span className="text-xs text-gray-500">{type.sublabel}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{type.description}</p>
                    {isGeneratingThis && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <svg className="animate-spin w-3.5 h-3.5 text-brand-500" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        <span className="text-xs text-brand-600 font-medium">Gerando com IA...</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Generation progress banner */}
        {isPending && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-brand-50 rounded-lg border border-brand-100">
            <svg className="animate-spin w-4 h-4 text-brand-500 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-brand-700">Gerando relatório com IA</p>
              <p className="text-xs text-brand-500">Isso pode levar alguns segundos...</p>
            </div>
          </div>
        )}
      </Card>

      {/* ── History Section ──────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Histórico de Relatórios
        </h3>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin w-6 h-6 text-brand-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        )}

        {!isLoading && reports.length === 0 && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl py-12 text-center">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="text-base font-semibold text-gray-600">Nenhum relatório gerado</h3>
            <p className="text-sm text-gray-400 mt-1">
              Gere o primeiro relatório usando os tipos acima.
            </p>
          </div>
        )}

        {reports.length > 0 && (
          <div className="space-y-2">
            {(reports as Report[]).map(report => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className="w-full text-left flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-brand-300 hover:shadow-sm cursor-pointer transition-all group"
              >
                {/* Icon */}
                <span className="text-xl flex-shrink-0">
                  {TYPE_ICONS[report.report_type] || '📄'}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 text-sm">
                      {TYPE_LABELS[report.report_type] || report.report_type}
                    </span>
                    <Badge
                      label={report.status === 'published' ? 'Publicado' : report.status}
                      className={report.status === 'published' ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-600'}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtDate(report.period_start)} a {fmtDate(report.period_end)}
                    <span className="mx-1.5">·</span>
                    {relativeTime(report.generated_at)}
                  </p>
                </div>

                {/* Arrow */}
                <svg
                  className="w-4 h-4 text-gray-300 group-hover:text-brand-400 transition-colors flex-shrink-0"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
