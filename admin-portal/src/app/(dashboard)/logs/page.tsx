'use client';
import { useEffect, useState } from 'react';
import { Clock, History, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { getActivityLogs, deleteAllActivityLogs } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ACTION_BADGE } from '@/types';
import type { ActivityLog } from '@/types';

const COLUMNS = ['Time', 'Admin', 'Action', 'Entity Type', 'Details'];

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [retentionDays, setRetentionDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    getActivityLogs()
      .then((r) => {
        setLogs(r.data.data.logs);
        setRetentionDays(r.data.data.retentionDays);
      })
      .finally(() => setLoading(false));
  }, []);

  const { pageItems, paginationProps } = usePagination(logs, 'activity-logs');

  const handleDeleteAll = async () => {
    try {
      await deleteAllActivityLogs();
      setLogs([]);
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
          logs.length > 0 ? (
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

      <div className="flex items-start gap-3 mb-5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
        <Clock className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
        <p className="text-sm text-foreground">
          Logs are kept for {retentionDays} days. Anything older is deleted automatically.
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
                  <TableCell className="text-foreground/90 whitespace-nowrap">{log.entityType}</TableCell>
                  <TableCell className="text-muted-foreground">{log.entityLabel}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && logs.length === 0 && (
          <EmptyState icon={History} title={`No activity in the last ${retentionDays} days`} description="Creating or editing visas, countries and promo codes shows up here." />
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
