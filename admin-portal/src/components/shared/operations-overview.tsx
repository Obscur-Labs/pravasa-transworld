'use client';
import Link from 'next/link';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BadgeCheck, IndianRupee, Timer, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/types';
import type { ApplicationStatus } from '@/types';

export interface OperationsStats {
  money: { today: number; month: number; trend: { date: string; revenue: number }[]; previous: { date: string; revenue: number }[] } | null;
  pendingPayments: number;
  overduePayments: number;
  inProgress: number;
  avgDeliveryDays: number | null;
  attention: { kind: 'payment' | 'stale'; applicationId: string; referenceId: string; applicant: string; visa: string; label: string; dueInMinutes: number | null }[];
  statusCounts: Partial<Record<ApplicationStatus, number>>;
}

export const shortDate = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
export const tooltipStyle = { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: 12, color: 'hsl(var(--popover-foreground))' };

const dueText = (mins: number) => {
  const abs = Math.abs(mins);
  const span = abs >= 1440 ? `${Math.floor(abs / 1440)}d ${Math.floor((abs % 1440) / 60)}h` : abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs}m`;
  return mins < 0 ? `-${span}` : span;
};
const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

/** The KPI row: revenue (for staff who see money), payments to verify, work in progress and delivery time. */
export function KpiTiles({ stats, loading }: { stats: OperationsStats | null; loading: boolean }) {
  const money = stats?.money;
  const tiles = [
    ...(money ? [
      { label: "Today's revenue", value: formatCurrency(money.today), icon: IndianRupee, tone: 'text-success bg-success/10' },
      { label: 'This month', value: formatCurrency(money.month), icon: IndianRupee, tone: 'text-primary bg-primary/10' },
    ] : []),
    {
      label: stats?.overduePayments ? `Pending payments (${stats.overduePayments} overdue)` : 'Pending payments',
      value: formatNumber(stats?.pendingPayments ?? 0), icon: BadgeCheck, tone: stats?.overduePayments ? 'text-destructive bg-destructive/10' : 'text-warning bg-warning/10',
    },
    { label: 'In processing', value: formatNumber(stats?.inProgress ?? 0), icon: Workflow, tone: 'text-info bg-info/10' },
    { label: 'Avg processing (30 days)', value: stats?.avgDeliveryDays != null ? `${stats.avgDeliveryDays} days` : '-', icon: Timer, tone: 'text-primary bg-primary/10' },
  ];
  return (
    <div className={cn('grid grid-cols-2 gap-4 mb-6', loading || money ? 'lg:grid-cols-5' : 'lg:grid-cols-3')}>
      {loading
        ? Array.from({ length: 5 }).map((_, i) => <StatTile key={i} loading label="" value="" icon={IndianRupee} tone="" />)
        : tiles.map((t) => <StatTile key={t.label} label={t.label} value={t.value} icon={t.icon} tone={t.tone} />)}
    </div>
  );
}

/** Revenue for the last 14 days (gold) against the 14 before (dashed). */
export function RevenueChart({ money }: { money: NonNullable<OperationsStats['money']> }) {
  const chart = money.trend.map((p, i) => ({ date: p.date, revenue: p.revenue, previous: money.previous[i]?.revenue ?? 0 }));
  const total = money.trend.reduce((s, p) => s + p.revenue, 0);
  return (
    <Card className="lg:col-span-2">
      <div className="p-5 pb-0 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-foreground">Revenue</h2>
          <p className="text-xs text-muted-foreground">Last 14 days · {formatCurrency(total)} total</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-chart-6" />This period</span>
          <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-primary" />Previous</span>
        </div>
      </div>
      <CardContent className="p-5">
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-6))" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="hsl(var(--chart-6))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `₹${formatNumber(Math.round(Number(v) / 1000))}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip labelFormatter={(v) => shortDate(String(v))} formatter={(v) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="revenue" name="This period" stroke="hsl(var(--chart-6))" strokeWidth={2.5} fill="url(#revenueFill)"
                dot={{ r: 3, fill: 'hsl(var(--card))', stroke: 'hsl(var(--chart-6))', strokeWidth: 2 }} />
              <Line type="monotone" dataKey="previous" name="Previous 14 days" stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/** Horizontal bars, busiest country first in gold. */
export function CountryBars({ data }: { data: { country: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <Card>
      <div className="p-5 pb-3">
        <h2 className="font-semibold text-foreground">Applications by country</h2>
        <p className="text-xs text-muted-foreground">{formatNumber(total)} applications</p>
      </div>
      <CardContent className="px-5 pb-5 pt-0 space-y-3">
        {data.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No data yet</p>}
        {data.slice(0, 8).map((d, i) => (
          <div key={d.country} className="grid grid-cols-[96px_1fr_36px] items-center gap-3 text-sm">
            <span className="truncate text-foreground">{d.country}</span>
            <span className="h-3 rounded-full bg-muted overflow-hidden">
              <span className={cn('block h-full rounded-full', i === 0 ? 'bg-chart-6' : 'bg-primary')} style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className="text-right font-semibold tabular-nums">{formatNumber(d.count)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Payments near or past their deadline and applications with no update for 3+ days. */
export function NeedsAttention({ items }: { items: OperationsStats['attention'] }) {
  const atRisk = items.filter((a) => a.dueInMinutes !== null && a.dueInMinutes < 120).length;
  return (
    <Card className="lg:col-span-2">
      <div className="p-5 pb-3 flex items-center gap-3">
        <h2 className="font-semibold text-foreground">Needs attention</h2>
        {atRisk > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{atRisk} SLA at risk</span>}
        <Button asChild variant="outline" size="sm" className="ml-auto"><Link href="/applications">View all</Link></Button>
      </div>
      <CardContent className="p-0">
        {!items.length ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">Nothing waiting. Payments past their deadline and applications without an update for 3 days show here.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <li key={`${a.kind}-${a.referenceId}`}>
                <Link href={a.kind === 'payment' ? '/payments' : `/applications/${a.applicationId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{initials(a.applicant)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{a.applicant} <span className="font-mono text-xs font-normal text-muted-foreground">{a.referenceId}</span></p>
                    <p className="text-xs text-muted-foreground truncate">{a.visa}</p>
                  </div>
                  <span className={cn('hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded-full', a.kind === 'payment' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning')}>{a.label}</span>
                  {a.dueInMinutes !== null && (
                    <span className={cn('w-16 text-right text-xs font-bold tabular-nums', a.dueInMinutes < 0 ? 'text-destructive' : a.dueInMinutes < 120 ? 'text-warning' : 'text-success')}>
                      {dueText(a.dueInMinutes)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const STAGE_TONES = ['bg-info/10 text-info', 'bg-primary/10 text-primary', 'bg-warning/10 text-warning', 'bg-accent text-accent-foreground', 'bg-success/10 text-success', 'bg-muted text-foreground'];

/** One row per pipeline stage with its count, each linking to the filtered list. */
export function StatusOverview({ counts }: { counts: Partial<Record<ApplicationStatus, number>> }) {
  return (
    <Card>
      <div className="p-5 pb-3"><h2 className="font-semibold text-foreground">Status overview</h2></div>
      <CardContent className="px-5 pb-5 pt-0">
        <ul className="divide-y divide-border">
          {PIPELINE_STAGES.map((s, i) => (
            <li key={s.label}>
              <Link href={`/applications?status=${s.status}`} className="flex items-center justify-between py-2.5 hover:opacity-80">
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STAGE_TONES[i])}>{s.label}</span>
                <span className="font-semibold tabular-nums">{formatNumber(s.statuses.reduce((t, st) => t + (counts[st] || 0), 0))}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
