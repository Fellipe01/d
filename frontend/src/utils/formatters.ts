export function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function fmtPct(v: number, decimals = 1): string {
  return `${v.toFixed(decimals)}%`;
}

export function fmtNum(v: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(v));
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function kpiColor(status: 'on_target' | 'warning' | 'breach'): string {
  switch (status) {
    case 'on_target': return 'text-success-700 bg-success-100';
    case 'warning': return 'text-warning-700 bg-warning-100';
    case 'breach': return 'text-danger-700 bg-danger-100';
  }
}

export function impactColor(level: string): string {
  switch (level) {
    case 'critical': return 'bg-danger-100 text-danger-700';
    case 'high': return 'bg-orange-100 text-orange-700';
    case 'medium': return 'bg-warning-100 text-warning-700';
    case 'low': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export function impactLabel(level: string): string {
  switch (level) {
    case 'critical': return 'Crítico';
    case 'high': return 'Alto';
    case 'medium': return 'Médio';
    case 'low': return 'Baixo';
    default: return level;
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-danger-700 bg-danger-100';
    case 'warning': return 'text-warning-700 bg-warning-100';
    default: return 'text-blue-700 bg-blue-100';
  }
}
