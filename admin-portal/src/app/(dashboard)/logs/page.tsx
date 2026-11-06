'use client';
import { useEffect, useState } from 'react';
import { Clock, Download, GitCompareArrows, History, Loader2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { getActivityLogs, exportActivityLogsCsv } from '@/lib/api';
import { formatDateTimeIST, formatNumber } from '@/lib/utils';
import { ADMIN_MODULES } from '@/config/permissions';
import { ACTION_BADGE } from '@/types';
import type { ActivityLog } from '@/types';

const COLUMNS = ['Time (IST)', 'Member', 'Action', 'Module', 'Entity Type', 'Details', ''];

const MODULE_LABELS: Record<string, string> = {
  ...Object.fromEntries(ADMIN_MODULES.map((m) => [m.key, m.label])),
  team: 'Team & Roles',
};
const moduleName = (key: string) => MODULE_LABELS[key] ?? (key || 'Other');

type Filters = { admin: string; module: string; action: string; search: string };
const NO_FILTERS: Filters = { admin: '', module: '', action: '', search: '' };

/** Read-only audit trail: filter, search, export, and open an entry to see what changed. */
export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(2000);
  const [retentionDays, setRetentionDays] = useState(90);
  const [members, setMembers] = useState<{ _id: string; name: string }[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<ActivityLog | null>(null);
  const [exporting, setExporting] = useState(false);

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === search.trim() ? f : { ...f, search: search.trim() })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

  useEffect(() => {
    setLoading(true);
    getActivityLogs(params())
      .then((r) => {
        const d = r.data.data;
        setLogs(d.logs);
        setTotal(d.total);
        setLimit(d.limit);
        setRetentionDays(d.retentionDays);
        setMembers(d.members);
        setModules(d.modules);
      })
      .catch(() => toast({ title: 'Could not load activity logs', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [filters]);

  const { pageItems, paginationProps } = usePagination(logs, 'activity-logs', JSON.stringify(filters));
  const filtered = Object.values(filters).some(Boolean);

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await exportActivityLogsCsv(params());
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Activity Logs"
        description="Who changed what in the console, and when. Entries can't be edited or deleted."
        action={
          <Button variant="outline" onClick={handleExport} disabled={exporting || total === 0}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Export CSV
          </Button>
        }
      />

      <div className="flex items-start gap-3 mb-5 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-sm text-foreground">
          Logs are kept for {retentionDays} days. Anything older is deleted automatically.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="w-full sm:w-64">
          <label htmlFor="f-search" className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input id="f-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Record, type or member"
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="f-member" className="block text-xs font-medium text-muted-foreground mb-1">Member</label>
          <NativeSelect id="f-member" value={filters.admin} onChange={(e) => setFilters({ ...filters, admin: e.target.value })}>
            <option value="">Everyone</option>
            {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </NativeSelect>
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="f-module" className="block text-xs font-medium text-muted-foreground mb-1">Module</label>
          <NativeSelect id="f-module" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}>
            <option value="">All modules</option>
            {[...modules].sort((a, b) => moduleName(a).localeCompare(moduleName(b))).map((m) => (
              <option key={m} value={m}>{moduleName(m)}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-full sm:w-40">
          <label htmlFor="f-action" className="block text-xs font-medium text-muted-foreground mb-1">Action</label>
          <NativeSelect id="f-action" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
            <option value="">Any action</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </NativeSelect>
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => { setFilters(NO_FILTERS); setSearch(''); }}>
            <X className="w-3.5 h-3.5 mr-1" />Clear filters
          </Button>
        )}
        <p className="text-xs text-muted-foreground sm:ml-auto">
          {loading ? 'Loading...' : `${formatNumber(total)} ${total === 1 ? 'entry' : 'entries'}${total > limit ? `, newest ${formatNumber(limit)} shown` : ''}`}
        </p>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/40">
              {COLUMNS.map((h) => <TableHead key={h}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {COLUMNS.map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              pageItems.map((log) => (
                <TableRow key={log._id} className="cursor-pointer" onClick={() => setDetail(log)}>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-xs">{formatDateTimeIST(log.createdAt)}</TableCell>
                  <TableCell className="font-medium text-foreground whitespace-nowrap">{log.adminName}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION_BADGE[log.action]} className="text-xs capitalize">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{moduleName(log.module)}</TableCell>
                  <TableCell className="text-foreground/90 whitespace-nowrap">{log.entityType}</TableCell>
                  <TableCell className="text-muted-foreground">{log.entityLabel}</TableCell>
                  <TableCell>
                    {log.changes?.length ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary whitespace-nowrap">
                        <GitCompareArrows className="w-3.5 h-3.5" />{log.changes.length} change{log.changes.length === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && logs.length === 0 && (
          <EmptyState
            icon={History}
            title={filtered ? 'Nothing matches these filters' : `No activity in the last ${retentionDays} days`}
            description={filtered ? undefined : 'Creating or editing visas, countries and promo codes shows up here.'}
          />
        )}
        <Pagination {...paginationProps} className="border-t border-border" />
      </Card>

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detail && (
            <div className="space-y-5">
              <div>
                <SheetTitle>{detail.entityType}</SheetTitle>
                <p className="text-sm text-muted-foreground mt-1 break-words">{detail.entityLabel}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
                {[['When', formatDateTimeIST(detail.createdAt)], ['Member', detail.adminName], ['Action', detail.action], ['Module', moduleName(detail.module)]].map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium capitalize">{v}</dd></div>
                ))}
              </dl>
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">What changed</h4>
                {detail.changes?.length ? (
                  <ul className="space-y-2">
                    {detail.changes.map((c) => (
                      <li key={c.field} className="rounded-lg border border-border p-3 text-sm">
                        <p className="text-xs font-semibold text-foreground mb-1.5">{c.field}</p>
                        <p className="rounded bg-destructive/10 text-destructive px-2 py-1 font-mono text-xs break-all line-through decoration-destructive/40">{c.from || '(empty)'}</p>
                        <p className="mt-1 rounded bg-success/10 text-success px-2 py-1 font-mono text-xs break-all">{c.to || '(empty)'}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Field-level changes weren&apos;t recorded for this entry.</p>
                )}
              </section>
              {detail.changes?.length ? (
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(JSON.stringify(detail.changes, null, 2)).then(() => toast({ title: 'Copied' }))}>
                  Copy as JSON
                </Button>
              ) : null}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
