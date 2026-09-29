'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { FileText, Clock, CheckCircle, XCircle, Activity, ArrowRight, Inbox, TrendingUp, Globe2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PendingPaymentsCard } from '@/components/shared/pending-payments-card';
import { getDashboardStats, getApplications } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Application } from '@/types';
import { STATUS_LABELS } from '@/types';

interface TrendPoint { date: string; count: number }
interface CountryPoint { country: string; flag: string; count: number }
interface Stats { total: number; pending: number; processing: number; approved: number; rejected: number; trend: TrendPoint[]; byCountry: CountryPoint[] }

const shortDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const CHART_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-6))',
  'hsl(var(--muted-foreground))',
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getApplications({ limit: 8 })])
      .then(([statsRes, appsRes]) => {
        setStats(statsRes.data.data);
        setRecent(appsRes.data.data.applications);
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: 'Total Applications', value: stats.total, icon: Activity, tone: 'text-primary bg-primary/10' },
    { label: 'Pending Review', value: stats.pending, icon: Clock, tone: 'text-warning bg-warning/10' },
    { label: 'In Processing', value: stats.processing, icon: FileText, tone: 'text-info bg-info/10' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, tone: 'text-success bg-success/10' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'text-destructive bg-destructive/10' },
  ] : [];

  const statusVariant = (s: string) => {
    if (s === 'visa_approved' || s === 'visa_delivered') return 'success';
    if (s === 'visa_rejected') return 'destructive';
    if (s === 'payment_pending' || s === 'submitted') return 'warning';
    return 'info';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Dashboard" description="Overview of all visa applications." />

      <PendingPaymentsCard />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <StatTile key={i} loading label="" value="" icon={Activity} tone="" />)
        ) : (
          cards.map((c) => <StatTile key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} />)
        )}
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Applications, last 14 days</h2>
          </div>
          <CardContent className="p-5">
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.trend ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={false}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      labelFormatter={(v) => shortDate(String(v))}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        fontSize: 12,
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Area type="monotone" dataKey="count" name="Applications" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#trendFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Applications by Country</h2>
          </div>
          <CardContent className="p-5">
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : !stats?.byCountry?.length ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.byCountry}
                      dataKey="count"
                      nameKey="country"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {stats.byCountry.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [value, name]}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        fontSize: 12,
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications */}
      <Card>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground">Recent Applications</h2>
          <Link href="/applications" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {['Application No.', 'Applicant', 'Visa', 'Country', 'Date', 'Status', ''].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              recent.map((app) => (
                <TableRow key={app._id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{app.referenceId}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{app.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{app.user?.email}</p>
                  </TableCell>
                  <TableCell className="text-foreground/90">{app.visaType?.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <img src={`https://flagcdn.com/w20/${app.country?.flag}.png`} alt="" className="w-5 h-3 object-cover rounded" />
                      {app.country?.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(app.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(app.status) as any} className="text-xs">
                      {STATUS_LABELS[app.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/applications/${app._id}`} className="text-primary hover:underline text-xs font-medium">View</Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && recent.length === 0 && (
          <EmptyState icon={Inbox} title="No applications yet" description="New visa applications will show up here as they come in." />
        )}
      </Card>
    </div>
  );
}
