'use client';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle, BadgeCheck, CalendarClock, IndianRupee, Timer, Workflow } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { formatCurrency, formatNumber } from '@/lib/utils';
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

const shortDate = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

const dueText = (mins: number) => {
  const abs = Math.abs(mins);
  const span = abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs}m`;
  return mins < 0 ? `Overdue ${span}` : `${span} left`;
};

/** Money, workload and the items that need someone today, at the top of the dashboard. */
export function OperationsOverview({ stats, loading }: { stats: OperationsStats | null; loading: boolean }) {
  const money = stats?.money;
  const tiles = [
    ...(money ? [
      { label: "Today's revenue (IST)", value: formatCurrency(money.today), icon: IndianRupee, tone: 'text-success bg-success/10' },
      { label: 'This month', value: formatCurrency(money.month), icon: IndianRupee, tone: 'text-primary bg-primary/10' },
    ] : []),
    {
      label: stats?.overduePayments ? `Payments to verify (${stats.overduePayments} overdue)` : 'Payments to verify',
      value: formatNumber(stats?.pendingPayments ?? 0), icon: BadgeCheck, tone: stats?.overduePayments ? 'text-destructive bg-destructive/10' : 'text-warning bg-warning/10',
    },
    { label: 'In progress', value: formatNumber(stats?.inProgress ?? 0), icon: Workflow, tone: 'text-info bg-info/10' },
    { label: 'Avg days to deliver (30 days)', value: stats?.avgDeliveryDays ?? '-', icon: Timer, tone: 'text-primary bg-primary/10' },
  ];
  const chart = money ? money.trend.map((p, i) => ({ date: p.date, revenue: p.revenue, previous: money.previous[i]?.revenue ?? 0 })) : [];

  return (
    <div className="space-y-6 mb-6">
      <div className={`grid grid-cols-2 ${money ? 'lg:grid-cols-5' : 'lg:grid-cols-3'} gap-4`}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <StatTile key={i} loading label="" value="" icon={IndianRupee} tone="" />)
          : tiles.map((t) => <StatTile key={t.label} label={t.label} value={t.value} icon={t.icon} tone={t.tone} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {money && (
          <Card className="lg:col-span-2">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold text-sm text-foreground">Revenue, last 14 days vs the 14 before</h2>
            </div>
            <CardContent className="p-5">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                    <YAxis tickFormatter={(v) => `₹${formatNumber(Number(v) / 1000)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={52} />
                    <Tooltip
                      labelFormatter={(v) => shortDate(String(v))}
                      formatter={(v) => formatCurrency(Number(v))}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: 12, color: 'hsl(var(--popover-foreground))' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="revenue" name="This period" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="previous" name="Previous 14 days" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={money ? '' : 'lg:col-span-2'}>
          <div className="p-5 border-b border-border flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h2 className="font-semibold text-sm text-foreground">Needs attention</h2>
          </div>
          <CardContent className="p-0">
            {!stats?.attention.length ? (
              <p className="p-5 text-sm text-muted-foreground">Nothing waiting. Payments past their deadline and applications without an update for 3 days show here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {stats.attention.map((a) => (
                  <li key={`${a.kind}-${a.referenceId}`}>
                    <Link href={a.kind === 'payment' ? '/payments' : `/applications/${a.applicationId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate"><span className="font-mono">{a.referenceId}</span> · {a.applicant}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.visa} · {a.label}</p>
                      </div>
                      {a.dueInMinutes !== null && (
                        <Badge variant={a.dueInMinutes < 0 ? 'destructive' : a.dueInMinutes < 120 ? 'warning' : 'secondary'} className="whitespace-nowrap">
                          <CalendarClock className="w-3 h-3 mr-1" />{dueText(a.dueInMinutes)}
                        </Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {!money && (
          <StageOverview counts={stats?.statusCounts ?? {}} />
        )}
      </div>
      {money && <StageOverview counts={stats?.statusCounts ?? {}} wide />}
    </div>
  );
}

function StageOverview({ counts, wide = false }: { counts: Partial<Record<ApplicationStatus, number>>; wide?: boolean }) {
  return (
    <Card>
      <div className="p-5 border-b border-border">
        <h2 className="font-semibold text-sm text-foreground">Applications by stage</h2>
      </div>
      <CardContent className={`p-5 grid gap-3 ${wide ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2'}`}>
        {PIPELINE_STAGES.map((s) => (
          <Link key={s.label} href={`/applications?status=${s.status}`} className="rounded-lg border border-border p-3 hover:bg-muted/40">
            <p className="text-xl font-bold text-foreground tabular-nums">{formatNumber(s.statuses.reduce((t, st) => t + (counts[st] || 0), 0))}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
