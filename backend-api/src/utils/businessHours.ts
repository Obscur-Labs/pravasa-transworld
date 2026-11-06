/** Weekly opening hours in IST, and the one-line summary the website shows. */
export interface DayHours { day: number; open: boolean; from: string; to: string }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validates a 7-day schedule (Sunday = 0); returns it cleaned or an error. */
export function cleanSchedule(input: unknown): { schedule: DayHours[] } | { error: string } {
  const list = Array.isArray(input) ? input : [];
  const schedule: DayHours[] = [];
  for (let day = 0; day < 7; day++) {
    const raw = (list.find((d: { day?: unknown }) => Number(d?.day) === day) || {}) as Partial<DayHours>;
    const open = raw.open === true;
    const from = String(raw.from || '10:00');
    const to = String(raw.to || '19:00');
    if (open && (!TIME_RE.test(from) || !TIME_RE.test(to))) return { error: `Use HH:MM times for ${DAYS[day]}` };
    if (open && to <= from) return { error: `${DAYS[day]}: closing time must be after opening time` };
    schedule.push({ day, open, from, to });
  }
  if (!schedule.some((d) => d.open)) return { error: 'Open at least one day' };
  return { schedule };
}

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
};

/**
 * "Mon–Sat 10 AM – 7 PM IST", or several groups joined with commas when days differ.
 * Consecutive days (Monday first) with the same hours collapse into a range.
 */
export function summarizeSchedule(schedule: DayHours[]): string {
  const week = [1, 2, 3, 4, 5, 6, 0].map((d) => schedule.find((s) => s.day === d)!).filter(Boolean);
  const groups: { days: number[]; from: string; to: string }[] = [];
  for (const d of week) {
    if (!d.open) continue;
    const last = groups[groups.length - 1];
    const prevDay = last ? last.days[last.days.length - 1] : -1;
    const consecutive = last && (d.day === (prevDay + 1) % 7);
    if (last && consecutive && last.from === d.from && last.to === d.to) last.days.push(d.day);
    else groups.push({ days: [d.day], from: d.from, to: d.to });
  }
  const label = groups.map((g) => {
    const days = g.days.length > 1 ? `${DAYS[g.days[0]]}–${DAYS[g.days[g.days.length - 1]]}` : DAYS[g.days[0]];
    return `${days} ${clock(g.from)} – ${clock(g.to)}`;
  }).join(', ');
  return `${label} IST`;
}

/** Whether the office is open right now, in India time. */
export function openNow(schedule: DayHours[], now = new Date()): boolean {
  const ist = new Date(now.getTime() + 5.5 * 3600000);
  const today = schedule.find((s) => s.day === ist.getUTCDay());
  const hhmm = ist.toISOString().slice(11, 16);
  return !!today?.open && hhmm >= today.from && hhmm < today.to;
}
