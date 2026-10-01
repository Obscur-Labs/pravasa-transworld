'use client';
import { useEffect, useState } from 'react';
import { Clock, History, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { getActivityLogs, deleteAllActivityLogs } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { usePermissions } from '@/lib/usePermissions';
import { ADMIN_MODULES } from '@/config/permissions';
import { ACTION_BADGE } from '@/types';
import type { ActivityLog } from '@/types';

const COLUMNS = ['Time', 'Member', 'Action', 'Module', 'Entity Type', 'Details'];

const MODULE_LABELS: Record<string, string> = {
  ...Object.fromEntries(ADMIN_MODULES.map((m) => [m.key, m.label])),
  team: 'Team & Roles',
};
const moduleName = (key: string) => MODULE_LABELS[key] ?? (key || 'Other');

type Filters = { admin: string; module: string; action: string };
const NO_FILTERS: Filters = { admin: '', module: '', action: '' };

export default function ActivityLogsPage() {
  const { isSuperAdmin } = usePermissions();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(2000);
  const [retentionDays, setRetentionDays] = useState(90);
  const [members, setMembers] = useState<{ _id: string; name: string }[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    getActivityLogs(params)
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

  const handleDeleteAll = async () => {
    try {
      await deleteAllActivityLogs();
      setLogs([]);
      setTotal(0);
      toast({ title: 'Activity logs cleared', variant: 'success' });
    } catch {
      toast({ title: 'Failed to clear activity logs', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Activity Logs"
        description="Who changed what in the console, and when."
        action={
          isSuperAdmin && logs.length > 0 && !filtered ? (
            <Button
              variant="outline"
              onClick={() => setConfirmClear(true)}
              className="text-destructive border-destructive/20 hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete all
            </Button>
          ) : undefined
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
          <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
            <X className="w-3.5 h-3.5 mr-1" />Clear filters
          </Button>
        )}
        <p className="text-xs text-muted-foreground sm:ml-auto">
          {loading ? 'Loading...' : `${total.toLocaleString('en-IN')} ${total === 1 ? 'entry' : 'entries'}${total > limit ? `, newest ${limit.toLocaleString('en-IN')} shown` : ''}`}
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
                <TableRow key={log._id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                  <TableCell className="font-medium text-foreground whitespace-nowrap">{log.adminName}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION_BADGE[log.action]} className="text-xs capitalize">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{moduleName(log.module)}</TableCell>
                  <TableCell className="text-foreground/90 whitespace-nowrap">{log.entityType}</TableCell>
                  <TableCell className="text-muted-foreground">{log.entityLabel}</TableCell>
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

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Delete all activity logs?"
        description="Every entry is removed for all admins. This cannot be undone."
        confirmLabel="Delete all"
        onConfirm={handleDeleteAll}
      />
    </div>
  );
}
