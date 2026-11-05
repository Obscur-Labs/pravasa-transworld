'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, FileSearch, Download, Loader2, UserPlus, X, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Pagination, usePageSize } from '@/components/ui/pagination';
import {
  bulkAssignApplications, bulkUpdateApplicationStatus, exportApplicationsCsv, getApplicationAssignees,
  getApplications, getCountries, getVisaTypes,
} from '@/lib/api';
import { usePermissions } from '@/lib/usePermissions';
import { formatCurrency, formatDateTimeIST, formatNumber } from '@/lib/utils';
import type { Application } from '@/types';
import { STATUS_LABELS, ALL_STATUSES, SELECTABLE_STATUSES } from '@/types';
import { NativeSelect } from '@/components/ui/native-select';

const statusVariant = (s: string) => {
  if (s === 'visa_approved' || s === 'visa_delivered') return 'success';
  if (s === 'visa_rejected') return 'destructive';
  if (s === 'payment_pending' || s === 'submitted') return 'warning';
  return 'info';
};

const COLUMNS = ['', 'Application No.', 'Applicant', 'Visa', 'Status', 'Assignee', 'Amount', 'Submitted', ''];
const EMPTY_FILTERS = { status: '', country: '', visaType: '', assignee: '', from: '', to: '' };

export default function ApplicationsPage() {
  const { can } = usePermissions();
  const canManage = can('applications', 'manage');
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('applications');
  const [countries, setCountries] = useState<{ _id: string; name: string }[]>([]);
  const [visaTypes, setVisaTypes] = useState<{ _id: string; name: string }[]>([]);
  const [assignees, setAssignees] = useState<{ _id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>(SELECTABLE_STATUSES[1]);
  const [bulkNote, setBulkNote] = useState('');
  const [bulkNotify, setBulkNotify] = useState(true);
  const [reload, setReload] = useState(0);

  // Deep links from the dashboard: /applications?status=...
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('status');
    if (status && (ALL_STATUSES as string[]).includes(status)) setFilters((f) => ({ ...f, status }));
    getCountries().then((r) => setCountries(r.data.data)).catch(() => {});
    getApplicationAssignees().then((r) => setAssignees(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setVisaTypes([]);
    if (filters.country) getVisaTypes(filters.country).then((r) => setVisaTypes(r.data.data)).catch(() => {});
  }, [filters.country]);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = useCallback(() => {
    const p: Record<string, string> = {};
    for (const [k, v] of Object.entries(filters)) if (v) p[k] = v;
    if (query) p.search = query;
    return p;
  }, [filters, query]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    getApplications({ ...params(), page, limit: pageSize })
      .then((r) => {
        if (stale) return;
        setApplications(r.data.data.applications);
        setTotal(r.data.data.total);
      })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [params, page, pageSize, reload]);

  useEffect(() => { setSelected(new Set()); }, [filters, query, page, pageSize]);

  const setFilter = (key: keyof typeof EMPTY_FILTERS, value: string) => {
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'country' ? { visaType: '' } : {}) }));
    setPage(1);
  };
  const filtered = Object.values(filters).some(Boolean) || !!query;

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOnPage = applications.length > 0 && applications.every((a) => selected.has(a._id));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(applications.map((a) => a._id)));

  const assign = async (assignee: string) => {
    setBusy(true);
    try {
      const r = await bulkAssignApplications([...selected], assignee || null);
      toast({ title: r.data.message, variant: 'success' });
      setReload((n) => n + 1);
    } catch (err: any) {
      toast({ title: 'Could not assign', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async () => {
    setBusy(true);
    try {
      const r = await bulkUpdateApplicationStatus({ ids: [...selected], status: bulkStatus, note: bulkNote, notify: bulkNotify });
      const skipped: { referenceId: string; reason: string }[] = r.data.data.skipped || [];
      toast({
        title: r.data.message,
        description: skipped.length ? skipped.slice(0, 3).map((x) => `${x.referenceId}: ${x.reason}`).join(' · ') : undefined,
        variant: skipped.length ? 'default' : 'success',
      });
      setStatusDialog(false);
      setBulkNote('');
      setReload((n) => n + 1);
    } catch (err: any) {
      toast({ title: 'Could not change status', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const r = await exportApplicationsCsv(params());
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const selectClass = 'h-9 w-auto text-sm';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Applications</h1>
          <p className="text-muted-foreground text-sm mt-1">{formatNumber(total)} {filtered ? 'matching' : 'total'} applications</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={exporting || total === 0}>
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="ID, name, email, phone or passport no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search applications"
            className="w-full pl-9 pr-3 h-9 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>
        <NativeSelect value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={selectClass} aria-label="Status">
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </NativeSelect>
        <NativeSelect value={filters.country} onChange={(e) => setFilter('country', e.target.value)} className={selectClass} aria-label="Country">
          <option value="">All countries</option>
          {countries.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </NativeSelect>
        {filters.country && (
          <NativeSelect value={filters.visaType} onChange={(e) => setFilter('visaType', e.target.value)} className={selectClass} aria-label="Visa type">
            <option value="">All visa types</option>
            {visaTypes.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
          </NativeSelect>
        )}
        <NativeSelect value={filters.assignee} onChange={(e) => setFilter('assignee', e.target.value)} className={selectClass} aria-label="Assignee">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {assignees.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
        </NativeSelect>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Input type="date" className="h-9 w-36" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} aria-label="Submitted from" />
          to
          <Input type="date" className="h-9 w-36" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} aria-label="Submitted to" />
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => { setFilters(EMPTY_FILTERS); setSearch(''); }}>
            <X className="w-3.5 h-3.5 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* Bulk actions for the ticked rows */}
      {canManage && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <ListChecks className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">{selected.size} selected</span>
          <span className="flex items-center gap-1.5 ml-2">
            <UserPlus className="w-4 h-4 text-muted-foreground" />
            <NativeSelect className="h-8 w-auto text-xs" value="" disabled={busy} onChange={(e) => e.target.value && assign(e.target.value === 'none' ? '' : e.target.value)} aria-label="Assign to">
              <option value="">Assign to...</option>
              <option value="none">Nobody (unassign)</option>
              {assignees.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </NativeSelect>
          </span>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setStatusDialog(true)} disabled={busy}>Change status</Button>
          <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={() => setSelected(new Set())}>Clear selection</Button>
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/40">
              <TableHead className="w-10">
                {canManage && <input type="checkbox" className="h-4 w-4" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" />}
              </TableHead>
              {COLUMNS.slice(1).map((h, i) => <TableHead key={`${h}-${i}`}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {COLUMNS.map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}
                </TableRow>
              ))
            ) : (
              applications.map((app) => (
                <TableRow key={app._id} data-state={selected.has(app._id) ? 'selected' : undefined}>
                  <TableCell>
                    {canManage && <input type="checkbox" className="h-4 w-4" checked={selected.has(app._id)} onChange={() => toggle(app._id)} aria-label={`Select ${app.referenceId}`} />}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {app.referenceId}
                    {(app.travellers?.length ?? 0) > 1 && (
                      <span className="block mt-1 w-fit font-sans text-[10px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5"
                        title={app.travellers!.map((t) => t.ref).join(', ')}>
                        Family · {app.travellers!.length}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground whitespace-nowrap">{app.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{app.user?.phone || app.user?.email}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="flex items-center gap-1.5 text-foreground/90">
                      <img src={`https://flagcdn.com/w20/${app.country?.flag}.png`} alt="" className="w-5 h-3 object-cover rounded" />
                      {app.country?.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{app.visaType?.name}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(app.status) as any} className="text-xs whitespace-nowrap">{STATUS_LABELS[app.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {app.assignedTo
                      ? <span className="inline-flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{app.assignedTo.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>{app.assignedTo.name.split(' ')[0]}</span>
                      : <span className="text-xs text-muted-foreground">Unassigned</span>}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground whitespace-nowrap tabular-nums">{formatCurrency(app.paymentAmount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeIST(app.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={`/applications/${app._id}`} className="text-primary hover:underline text-xs font-medium whitespace-nowrap">
                      Review →
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && applications.length === 0 && (
          <EmptyState
            icon={FileSearch}
            title="No applications found"
            description={filtered ? 'Try adjusting your search or filters.' : 'Applications will show up here once submitted.'}
          />
        )}
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} className="border-t border-border" />
      </Card>

      <Dialog open={statusDialog} onOpenChange={setStatusDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change status of {selected.size} application{selected.size === 1 ? '' : 's'}</DialogTitle>
            <DialogDescription>Each one is logged. Unpaid applications are skipped for stages that need a verified payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5" role="radiogroup" aria-label="New status">
            {SELECTABLE_STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="bulk-status" checked={bulkStatus === s} onChange={() => setBulkStatus(s)} />
                {STATUS_LABELS[s]}
              </label>
            ))}
          </div>
          <Textarea rows={2} maxLength={500} placeholder="Internal note (optional)" value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={bulkNotify} onChange={(e) => setBulkNotify(e.target.checked)} />
            Notify customers (in-app and email)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStatusDialog(false)}>Cancel</Button>
            <Button onClick={changeStatus} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
