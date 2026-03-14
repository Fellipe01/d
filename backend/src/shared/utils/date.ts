export function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function subDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

export function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  return addDays(d, 6);
}

export function lastWeekRange(): { start: string; end: string } {
  const today = new Date();
  const end = addDays(startOfWeek(today), -1);
  const start = addDays(end, -6);
  return { start: toISODate(start), end: toISODate(end) };
}

export function currentWeekRange(): { start: string; end: string } {
  const today = new Date();
  return {
    start: toISODate(startOfWeek(today)),
    end: toISODate(today),
  };
}

export function formatBR(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}
