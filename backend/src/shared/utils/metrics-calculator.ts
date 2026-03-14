export function calcCTR(clicks: number, impressions: number): number {
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
}

export function calcCPM(spend: number, impressions: number): number {
  return impressions > 0 ? (spend / impressions) * 1000 : 0;
}

export function calcCPC(spend: number, clicks: number): number {
  return clicks > 0 ? spend / clicks : 0;
}

export function calcCPL(spend: number, leads: number): number {
  return leads > 0 ? spend / leads : 0;
}

export function calcCostPerMessage(spend: number, messages: number): number {
  return messages > 0 ? spend / messages : 0;
}

export function calcFrequency(impressions: number, reach: number): number {
  return reach > 0 ? impressions / reach : 0;
}

export function calcHookRate(videoViews3s: number, impressions: number): number {
  return impressions > 0 ? (videoViews3s / impressions) * 100 : 0;
}

export function deltaPct(current: number, previous: number): number {
  return previous !== 0 ? ((current - previous) / previous) * 100 : 0;
}

export type SaturationLevel = 'healthy' | 'watch' | 'saturating' | 'saturated';

export function detectSaturation(
  frequency: number,
  ctr: number,
  ctrDeltaPct: number,
  cplDeltaPct: number
): SaturationLevel {
  if (frequency >= 5.0 || (ctr < 0.5 && frequency >= 2.5)) return 'saturated';
  if (frequency >= 3.5 && ctrDeltaPct <= -15 && cplDeltaPct >= 20) return 'saturating';
  if (frequency >= 2.5 || ctrDeltaPct <= -15) return 'watch';
  return 'healthy';
}
