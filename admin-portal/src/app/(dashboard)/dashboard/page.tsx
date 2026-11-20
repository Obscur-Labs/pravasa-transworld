'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowRight, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PendingPaymentsCard } from '@/components/shared/pending-payments-card';
import {
  CountryBars, KpiTiles, NeedsAttention, RevenueChart, StatusOverview, shortDate, tooltipStyle,
} from '@/components/shared/operations-overview';
import type { OperationsStats } from '@/components/shared/operations-overview';
import { getDashboardStats, getApplications } from '@/lib/api';
import { usePermissions } from '@/lib/usePermissions';
import { formatDate } from '@/lib/utils';
import type { Application } from '@/types';
import { STATUS_LABELS } from '@/types';

interface Stats extends OperationsStats { trend: { date: string; count: number }[]; byCountry: { country: string; flag: string; count: number }[] }

const statusVariant = (s: string) => {
  if (s === 'visa_approved' || s === 'visa_delivered') return 'success';
  if (s === 'visa_rejected') return 'destructive';
  if (s === 'payment_pending' || s === 'submitted') return 'warning';
  return 'info';
};

/** Staff without money access see application volume where the revenue chart would be. */
function ApplicationsTrend({ trend }: { trend: Stats['trend'] }) {
  return (
    <Card className="lg:col-span-2">
      <div className="p-5 pb-0">
        <h2 className="font-semibold text-foreground">Applications</h2>
        <p className="text-xs text-muted-foreground">Last 14 days</p>
      </div>
      <CardContent className="p-5">
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip labelFormatter={(v) => shortDate(String(v))} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" name="Applications" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#trendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const { can } = usePermissions();
  // Widgets from other modules appear only for members who have those modules.
  const showApplications = can('applications');
  const showPayments = can('payments');

  useEffect(() => {
    Promise.all([getDashboardStats(), showApplications ? getApplications({ limit: 6 }) : null])
      .then(([statsRes, appsRes]) => {
        setStats(statsRes.data.data);
        if (appsRes) setRecent(appsRes.data.data.applications);
      })
      .finally(() => setLoading(false));
  }, [showApplications]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Dashboard" description="Money, workload and what needs attention today." />

      {showPayments && <PendingPaymentsCard />}

      <KpiTiles stats={stats} loading={loading} />

      {loading || !stats ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Skeleton className="h-80 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {stats.money ? <RevenueChart money={stats.money} /> : <ApplicationsTrend trend={stats.trend} />}
            <CountryBars data={stats.byCountry} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <NeedsAttention items={stats.attention} />
            <StatusOverview counts={stats.statusCounts} />
          </div>
        </>
      )}

      {showApplications && (
        <Card>
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent applications</h2>
            <Link href="/applications" className="text-sm text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Application No.', 'Applicant', 'Visa', 'Country', 'Date', 'Status'].map((h) => <TableHead key={h}>{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>
              )) : recent.map((app) => (
                <TableRow key={app._id}>
                  <TableCell><Link href={`/applications/${app._id}`} className="font-mono text-xs text-primary hover:underline">{app.referenceId}</Link></TableCell>
                  <TableCell><p className="font-medium text-foreground">{app.user?.name}</p><p className="text-xs text-muted-foreground">{app.user?.email}</p></TableCell>
                  <TableCell className="text-foreground/90">{app.visaType?.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <img src={`https://flagcdn.com/w20/${app.country?.flag}.png`} alt="" className="w-5 h-3 object-cover rounded" />{app.country?.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(app.createdAt)}</TableCell>
                  <TableCell><Badge variant={statusVariant(app.status) as any} className="text-xs">{STATUS_LABELS[app.status]}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!loading && recent.length === 0 && <EmptyState icon={Inbox} title="No applications yet" description="New visa applications will show up here as they come in." />}
        </Card>
      )}
    </div>
  );
}
