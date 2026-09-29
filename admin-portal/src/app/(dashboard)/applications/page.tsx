'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Filter, FileSearch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, usePageSize } from '@/components/ui/pagination';
import { getApplications } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Application, ApplicationStatus } from '@/types';
import { STATUS_LABELS, ALL_STATUSES } from '@/types';
import { NativeSelect } from '@/components/ui/native-select';

const statusVariant = (s: string) => {
  if (s === 'visa_approved' || s === 'visa_delivered') return 'success';
  if (s === 'visa_rejected') return 'destructive';
  if (s === 'payment_pending' || s === 'submitted') return 'warning';
  return 'info';
};

const COLUMNS = ['Application No.', 'Applicant', 'Visa Type', 'Country', 'Amount', 'Date', 'Status', ''];

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('applications');

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    getApplications({ status: statusFilter || undefined, search: query || undefined, page, limit: pageSize })
      .then((r) => {
        if (stale) return;
        setApplications(r.data.data.applications);
        setTotal(r.data.data.total);
      })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [statusFilter, query, page, pageSize]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Applications</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} {statusFilter || query ? 'matching' : 'total'} applications</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, application no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <NativeSelect
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 w-auto"
          >
            <option value="">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </NativeSelect>
        </div>
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
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {COLUMNS.map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              applications.map((app) => (
                <TableRow key={app._id}>
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{app.referenceId}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground whitespace-nowrap">{app.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{app.user?.email}</p>
                  </TableCell>
                  <TableCell className="text-foreground/90 whitespace-nowrap">{app.visaType?.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <img src={`https://flagcdn.com/w20/${app.country?.flag}.png`} alt="" className="w-5 h-3 object-cover rounded" />
                      {app.country?.name}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground whitespace-nowrap tabular-nums">{formatCurrency(app.paymentAmount)}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(app.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(app.status) as any} className="text-xs whitespace-nowrap">
                      {STATUS_LABELS[app.status]}
                    </Badge>
                  </TableCell>
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
            description={search || statusFilter ? 'Try adjusting your search or filter.' : 'Applications will show up here once submitted.'}
          />
        )}
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} className="border-t border-border" />
      </Card>
    </div>
  );
}
