'use client';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, Download, FileSpreadsheet, IndianRupee, Loader2, Receipt, Timer, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { EmptyState } from '@/components/ui/empty-state';
import { downloadGstRegisterCsv, getAgentReport, getGstRegister, getRevenueReport, getSlaReport } from '@/lib/api';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { STATUS_LABELS } from '@/types';
import type { ApplicationStatus } from '@/types';

type Tab = 'revenue' | 'gst' | 'agents' | 'sla';
const TABS: { key: Tab; label: string; icon: typeof IndianRupee }[] = [
  { key: 'revenue', label: 'Revenue', icon: IndianRupee },
  { key: 'gst', label: 'GST register', icon: Receipt },
  { key: 'agents', label: 'B2B agents', icon: Users },
  { key: 'sla', label: 'Processing time', icon: Timer },
];

// Date maths in IST, since reports are read as India business days.
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const shift = (day: string, days: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

function presets() {
  const today = istToday();
  const [y, m] = today.split('-').map(Number);
  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthEnd = shift(monthStart, -1);
  const fyStartYear = m >= 4 ? y : y - 1;
  return [
    { label: 'This month', from: monthStart, to: today },
    { label: 'Last month', from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd },
    { label: 'Last 30 days', from: shift(today, -29), to: today },
    { label: 'This financial year', from: `${fyStartYear}-04-01`, to: today },
  ];
}

const money = (n: number) => formatCurrency(n);
const twoDp = (n: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('revenue');
  const options = useMemo(presets, []);
  const [range, setRange] = useState({ from: options[0].from, to: options[0].to });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!range.from || !range.to || range.from > range.to) return;
    let stale = false;
    setLoading(true);
    const fetcher = { revenue: getRevenueReport, gst: getGstRegister, agents: getAgentReport, sla: getSlaReport }[tab];
    fetcher(range)
      .then((r) => { if (!stale) setData(r.data.data); })
      .catch(() => { if (!stale) { setData(null); toast({ title: 'Could not load the report', variant: 'destructive' }); } })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [tab, range]);

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const r = await downloadGstRegisterCsv(range);
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gst-register-${range.from}-to-${range.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Reports"
        description="Revenue from verified payments, the GST register for filing, B2B agent business and how long processing takes. All dates are IST."
        action={tab === 'gst' ? (
          <Button variant="outline" onClick={downloadCsv} disabled={downloading || !data?.rows?.length}>
            {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}Export CSV (GSTR-1)
          </Button>
        ) : undefined}
      />

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
        <div role="tablist" className="flex gap-1 bg-muted rounded-xl p-1 w-fit overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setData(null); setTab(key); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === key ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {options.map((o) => (
            <Button key={o.label} size="sm" variant={range.from === o.from && range.to === o.to ? 'default' : 'outline'} onClick={() => setRange({ from: o.from, to: o.to })}>
              {o.label}
            </Button>
          ))}
          <Input type="date" className="h-9 w-36" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="From" />
          <Input type="date" className="h-9 w-36" value={range.to} min={range.from} max={istToday()} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="To" />
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
          <Skeleton className="h-72" />
        </div>
      ) : tab === 'revenue' ? <RevenueView data={data} /> : tab === 'gst' ? <GstView data={data} /> : tab === 'agents' ? <AgentsView data={data} /> : <SlaView data={data} />}
    </div>
  );
}

function RevenueView({ data }: { data: any }) {
  const k = data.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label={`Revenue (${formatNumber(k.payments)} payments)`} value={money(k.revenue)} icon={IndianRupee} tone="text-success bg-success/10" />
        <StatTile label="Service fees (taxable)" value={money(k.taxable)} icon={Receipt} tone="text-primary bg-primary/10" />
        <StatTile label="GST collected" value={money(k.gst)} icon={Receipt} tone="text-warning bg-warning/10" />
        <StatTile label="Visa + VFS fees (pass-through)" value={money(k.passThrough)} icon={IndianRupee} tone="text-info bg-info/10" />
        <StatTile label="Promo discounts" value={money(k.discounts)} icon={IndianRupee} tone="text-destructive bg-destructive/10" />
      </div>
      <Card>
        <div className="p-5 border-b border-border"><h2 className="font-semibold text-sm">Revenue by day</h2></div>
        <CardContent className="p-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={(d) => formatDate(`${d}T12:00:00+05:30`).slice(0, 6)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <YAxis tickFormatter={(v) => `₹${formatNumber(Number(v) / 1000)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v) => money(Number(v))} labelFormatter={(d) => formatDate(`${d}T12:00:00+05:30`)}
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: 12, color: 'hsl(var(--popover-foreground))' }} />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakdownTable title="By country" rows={data.byCountry} />
        <BreakdownTable title="By visa type (top 15)" rows={data.byVisa} />
      </div>
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: { label: string; flag?: string; revenue: number; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <Card>
      <div className="p-5 border-b border-border"><h2 className="font-semibold text-sm">{title}</h2></div>
      {rows.length === 0 ? <EmptyState icon={BarChart3} title="No payments in this period" className="py-10" /> : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.label} className="px-5 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                {r.flag && <img src={`https://flagcdn.com/w20/${r.flag}.png`} alt="" className="w-5 h-3 object-cover rounded" />}
                <span className="flex-1 truncate text-foreground">{r.label}</span>
                <span className="text-xs text-muted-foreground">{formatNumber(r.count)}</span>
                <span className="font-semibold tabular-nums w-28 text-right">{money(r.revenue)}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(r.revenue / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function GstView({ data }: { data: any }) {
  const t = data.totals;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Taxable value" value={twoDp(t.taxable)} icon={Receipt} tone="text-primary bg-primary/10" />
        <StatTile label="CGST" value={twoDp(t.cgst)} icon={Receipt} tone="text-warning bg-warning/10" />
        <StatTile label="SGST" value={twoDp(t.sgst)} icon={Receipt} tone="text-warning bg-warning/10" />
        <StatTile label="IGST" value={twoDp(t.igst)} icon={Receipt} tone="text-warning bg-warning/10" />
        <StatTile label={`Invoices (${formatNumber(t.b2b)} B2B)`} value={formatNumber(data.rows.length)} icon={Download} tone="text-info bg-info/10" />
      </div>
      <Card className="overflow-hidden">
        {data.rows.length === 0 ? <EmptyState icon={Receipt} title="No invoices in this period" className="py-12" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-transparent">
                  {['Invoice', 'Date', 'Billed to', 'GSTIN', 'POS', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'].map((h) => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r: any) => (
                  <TableRow key={`${r.invoice}-${r.date}`}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{r.invoice}<span className="block text-muted-foreground">{r.application}</span></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(r.date)}</TableCell>
                    <TableCell className="text-sm">{r.billedTo}</TableCell>
                    <TableCell className="font-mono text-xs">{r.gstin || <span className="text-muted-foreground">B2C</span>}</TableCell>
                    <TableCell className="text-xs">{r.placeOfSupply}</TableCell>
                    {[r.taxable, r.cgst, r.sgst, r.igst, r.total].map((v: number, i: number) => (
                      <TableCell key={i} className={`text-right tabular-nums whitespace-nowrap ${i === 4 ? 'font-semibold' : ''}`}>{twoDp(v)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        GST is 18% of the service fee only; visa and VFS fees are pass-through and not taxed. Same state as the company (Receipt Config state code): CGST + SGST; otherwise IGST.
        Place of supply comes from the customer&apos;s GSTIN; B2C invoices use the company&apos;s state.
      </p>
    </div>
  );
}

function AgentsView({ data }: { data: any }) {
  return (
    <Card className="overflow-hidden">
      {data.agents.length === 0 ? <EmptyState icon={Users} title="No B2B agent payments in this period" className="py-12" /> : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-transparent">
              {['Agent', 'Payments', 'Service fees', 'Revenue'].map((h) => <TableHead key={h}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.agents.map((a: any) => (
              <TableRow key={a.email}>
                <TableCell><p className="font-medium">{a.agent}</p><p className="text-xs text-muted-foreground">{a.email}</p></TableCell>
                <TableCell className="tabular-nums">{formatNumber(a.payments)}</TableCell>
                <TableCell className="tabular-nums">{money(a.serviceFees)}</TableCell>
                <TableCell className="font-semibold tabular-nums">{money(a.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function SlaView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={`Avg payment verification (${formatNumber(data.paymentsVerified)} payments)`} value={data.paymentVerificationHours === null ? '-' : `${data.paymentVerificationHours} h`} icon={Timer} tone="text-primary bg-primary/10" />
        <StatTile label={`Avg submission to visa (${formatNumber(data.delivered)} delivered)`} value={data.deliveryDays === null ? '-' : `${data.deliveryDays} days`} icon={Timer} tone="text-success bg-success/10" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-5 border-b border-border"><h2 className="font-semibold text-sm">Days to deliver, by country</h2></div>
          {data.byCountry.length === 0 ? <EmptyState icon={Timer} title="No visas delivered in this period" className="py-10" /> : (
            <ul className="divide-y divide-border">
              {data.byCountry.map((c: any) => (
                <li key={c.country} className="px-5 py-2.5 flex items-center text-sm">
                  <span className="flex-1">{c.country}</span>
                  <span className="text-xs text-muted-foreground mr-4">{formatNumber(c.delivered)} delivered</span>
                  <span className="font-semibold tabular-nums">{c.avgDays} days</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="p-5 border-b border-border"><h2 className="font-semibold text-sm">Open for more than a week, by stage</h2></div>
          {data.stuck.length === 0 ? <EmptyState icon={Timer} title="Nothing older than a week" className="py-10" /> : (
            <ul className="divide-y divide-border">
              {data.stuck.map((s: any) => (
                <li key={s.status} className="px-5 py-2.5 flex items-center text-sm">
                  <span className="flex-1">{STATUS_LABELS[s.status as ApplicationStatus] || s.status}</span>
                  <span className="font-semibold tabular-nums">{formatNumber(s.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
