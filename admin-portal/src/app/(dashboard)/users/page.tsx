'use client';
import { useEffect, useState } from 'react';
import { Search, ChevronRight, Users, User, Building2, Tag, Plus, Pencil, Trash2, Download, Loader2, IndianRupee } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CustomerFormDialog } from '@/components/shared/customer-form-dialog';
import { getUsers, toggleUserPromoApplicable, deleteUser, exportUsersCsv } from '@/lib/api';
import { formatCurrency, formatDate, formatNumber, timeAgo } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import type { User as IUser } from '@/types';

type Tab = 'individual' | 'corporate';

export default function CustomersPage() {
  const [allUsers, setAllUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('individual');
  const [toggling, setToggling] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IUser | null>(null);
  const [exporting, setExporting] = useState(false);
  const router = useRouter();

  const exportCsv = async () => {
    setExporting(true);
    try {
      const r = await exportUsersCsv();
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    getUsers()
      .then((r) => setAllUsers(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };

  const openEdit = (e: React.MouseEvent, u: IUser) => {
    e.stopPropagation();
    setEditTarget(u);
    setFormOpen(true);
  };

  const handleSaved = (saved: IUser) => {
    setAllUsers((prev) => {
      const exists = prev.some((x) => x._id === saved._id);
      return exists ? prev.map((x) => (x._id === saved._id ? saved : x)) : [saved, ...prev];
    });
    // Jump to the tab the saved customer lives on so it doesn't look like it vanished.
    setTab((saved.accountType || 'individual') as Tab);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteUser(deleteTarget._id);
    setAllUsers((prev) => prev.filter((x) => x._id !== deleteTarget._id));
    setDeleteTarget(null);
  };

  const handlePromoToggle = async (e: React.MouseEvent, u: IUser) => {
    e.stopPropagation();
    setToggling(u._id);
    setAllUsers((prev) => prev.map((x) => x._id === u._id ? { ...x, promoApplicable: !x.promoApplicable } : x));
    try { await toggleUserPromoApplicable(u._id); } catch { setAllUsers((prev) => prev.map((x) => x._id === u._id ? { ...x, promoApplicable: u.promoApplicable } : x)); }
    setToggling(null);
  };

  const users = allUsers.filter((u) => (u.accountType || 'individual') === tab);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.phone.includes(s);
  });

  const { pageItems, paginationProps } = usePagination(filtered, 'customers', `${tab}|${search}`);

  const individualCount = allUsers.filter((u) => (u.accountType || 'individual') === 'individual').length;
  const corporateCount = allUsers.filter((u) => u.accountType === 'corporate').length;

  const lifetimeTotal = allUsers.reduce((t, u) => t + (u.lifetimeValue || 0), 0);
  const columns = ['Customer', 'Phone', ...(tab === 'corporate' ? ['GST Number'] : []), 'Applications', 'Lifetime value', 'Last active', 'Status', 'Promo', ''];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Customers"
        description={`${formatNumber(allUsers.length)} registered customers`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={exporting || allUsers.length === 0}>
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Export CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Add Customer
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatTile key={i} loading label="" value="" icon={Users} tone="" />)
        ) : (
          <>
            <StatTile label="Total Customers" value={formatNumber(allUsers.length)} icon={Users} tone="text-primary bg-primary/10" />
            <StatTile label="Individual" value={formatNumber(individualCount)} icon={User} tone="text-info bg-info/10" />
            <StatTile label="Corporate & B2B" value={formatNumber(corporateCount)} icon={Building2} tone="text-warning bg-warning/10" />
            <StatTile label="Lifetime value (verified payments)" value={formatCurrency(lifetimeTotal)} icon={IndianRupee} tone="text-success bg-success/10" />
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit mb-5">
        <button
          onClick={() => { setTab('individual'); setSearch(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'individual' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="w-4 h-4" />
          Individual
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === 'individual' ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'}`}>
            {individualCount}
          </span>
        </button>
        <button
          onClick={() => { setTab('corporate'); setSearch(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'corporate' ? 'bg-card text-warning shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Corporate
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === 'corporate' ? 'bg-warning/10 text-warning' : 'bg-muted-foreground/10 text-muted-foreground'}`}>
            {corporateCount}
          </span>
        </button>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/40">
              {columns.map((h) => <TableHead key={h}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length} className="p-0">
                <EmptyState icon={Users} title={`No ${tab} customers found`} description={search ? 'Try a different search.' : 'Customers will appear here once they register.'} />
              </TableCell></TableRow>
            ) : (
              pageItems.map((u) => (
                <TableRow
                  key={u._id}
                  onClick={() => router.push(`/users/${u._id}`)}
                  className="hover:bg-accent cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tab === 'corporate' ? 'bg-warning/10' : 'bg-primary/10'}`}>
                        <span className={`text-xs font-semibold ${tab === 'corporate' ? 'text-warning' : 'text-primary'}`}>{u.name?.[0]?.toUpperCase()}</span>
                      </div>
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{u.name}</span>
                        <span className="block text-xs text-muted-foreground truncate">{u.email}</span>
                      </span>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        u.accountType !== 'corporate' ? 'bg-info/10 text-info' : u.corporateType === 'b2b_agent' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                        {u.accountType !== 'corporate' ? 'Individual' : u.corporateType === 'b2b_agent' ? 'B2B' : 'Corporate'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{u.phone}</TableCell>
                  {tab === 'corporate' && (
                    <TableCell className="text-muted-foreground font-mono text-xs">{u.gstNumber || '-'}</TableCell>
                  )}
                  <TableCell className="tabular-nums">{formatNumber(u.applicationCount || 0)}</TableCell>
                  <TableCell className="font-semibold tabular-nums whitespace-nowrap">{formatCurrency(u.lifetimeValue || 0)}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-xs" title={`Joined ${formatDate(u.createdAt)}`}>
                    {u.lastActiveAt ? timeAgo(u.lastActiveAt) : `Joined ${formatDate(u.createdAt)}`}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => handlePromoToggle(e, u)}
                      disabled={toggling === u._id}
                      title={u.promoApplicable !== false ? 'Disable promos for this user' : 'Enable promos for this user'}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${u.promoApplicable !== false ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-muted text-muted-foreground hover:bg-muted-foreground/10'}`}
                    >
                      <Tag className="w-3 h-3" />
                      {u.promoApplicable !== false ? 'Eligible' : 'Blocked'}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={(e) => openEdit(e, u)}
                        title="Edit customer"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(u); }}
                        title="Delete customer"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive/70 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination {...paginationProps} className="border-t border-border" />
      </div>

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editTarget}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Customer?"
        description={deleteTarget ? `"${deleteTarget.name}" will be moved to trash. Their applications and documents are kept and re-link if the customer is restored.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
