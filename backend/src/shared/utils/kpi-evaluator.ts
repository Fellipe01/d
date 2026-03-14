export interface KpiDefinition {
  kpi_name: string;
  target_value: number;
  min_value: number | null;
  max_value: number | null;
  weight: number;
  kpi_type: 'lower_is_better' | 'higher_is_better' | 'range';
}

export interface KpiResult {
  kpi_name: string;
  target: number;
  actual: number;
  delta_pct: number;
  raw_score: number;
  weighted_score: number;
  status: 'on_target' | 'warning' | 'breach';
}

export function evaluateKpi(actual: number, kpi: KpiDefinition): KpiResult {
  let rawScore: number;

  if (kpi.kpi_type === 'lower_is_better') {
    rawScore = actual === 0 ? 2.0 : kpi.target_value / actual;
  } else if (kpi.kpi_type === 'higher_is_better') {
    rawScore = kpi.target_value === 0 ? 0 : actual / kpi.target_value;
  } else {
    // range
    const min = kpi.min_value ?? 0;
    const max = kpi.max_value ?? Infinity;
    rawScore = actual >= min && actual <= max ? 1.0 : 0.5;
  }

  rawScore = Math.min(rawScore, 2.0);

  const weightedScore = rawScore * kpi.weight;
  const deltaPct = kpi.target_value !== 0
    ? ((actual - kpi.target_value) / kpi.target_value) * 100
    : 0;

  let status: KpiResult['status'];
  if (rawScore >= 1.0) {
    status = 'on_target';
  } else if (rawScore >= 0.8) {
    status = 'warning';
  } else {
    status = 'breach';
  }

  return {
    kpi_name: kpi.kpi_name,
    target: kpi.target_value,
    actual,
    delta_pct: deltaPct,
    raw_score: rawScore,
    weighted_score: weightedScore,
    status,
  };
}

export function evaluateAllKpis(
  metrics: Record<string, number>,
  kpis: KpiDefinition[]
): KpiResult[] {
  return kpis
    .filter(kpi => metrics[kpi.kpi_name] !== undefined)
    .map(kpi => evaluateKpi(metrics[kpi.kpi_name], kpi));
}

export function computeOverallScore(results: KpiResult[]): number {
  if (results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + r.weighted_score, 0);
  const maxPossible = results.reduce((sum, r) => sum + 2.0 * r.raw_score, 0);
  return maxPossible === 0 ? 0 : Math.min((total / results.length) * 50, 100);
}
