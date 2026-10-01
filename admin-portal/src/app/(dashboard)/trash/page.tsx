'use client';
import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Trash2, AlertTriangle, Globe2, CreditCard, LayoutTemplate, MessageSquare, FileText, Users, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { getTrash, restoreTrashItem, deleteTrashItem, emptyTrash } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import type { TrashItem, TrashEntityType } from '@/types';

const TYPE_ICON: Record<TrashEntityType, React.ComponentType<{ className?: string }>> = {
  country: Globe2,
  visaType: CreditCard,
  formPreset: LayoutTemplate,
  termPreset: ScrollText,
  contactLead: MessageSquare,
  serviceInquiry: MessageSquare,
  application: FileText,
  user: Users,
};

const TYPE_BADGE: Record<TrashEntityType, string> = {
  country: 'bg-info/10 text-info border-info/20',
  visaType: 'bg-primary/10 text-primary border-primary/20',
  formPreset: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  termPreset: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  contactLead: 'bg-warning/10 text-warning border-warning/20',
  serviceInquiry: 'bg-warning/10 text-warning border-warning/20',
  application: 'bg-success/10 text-success border-success/20',
  user: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrashItem | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const load = () => {
    setLoading(true);
    getTrash().then((r) => setItems(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleRestore = async (item: TrashItem) => {
    setBusy(item._id);
    try {
      const res = await restoreTrashItem(item._id);
      toast({ title: res.data.message || 'Restored', variant: 'success' });
      setItems((prev) => prev.filter((i) => i._id !== item._id));
    } catch (err: any) {
      toast({ title: 'Restore failed', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (item: TrashItem) => {
    setBusy(item._id);
    try {
      await deleteTrashItem(item._id);
      toast({ title: 'Permanently deleted' });
      setItems((prev) => prev.filter((i) => i._id !== item._id));
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleEmpty = async () => {
    if (items.length === 0) return;
    try {
      await emptyTrash();
      toast({ title: 'Trash emptied' });
      setItems([]);
    } catch {
      toast({ title: 'Failed to empty trash', variant: 'destructive' });
    }
  };

  const { pageItems, paginationProps } = usePagination(items, 'trash');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Trash"
        description="Deleted records are kept here. Restore them or delete permanently."
        action={
          items.length > 0 ? (
            <Button variant="outline" onClick={() => setConfirmEmpty(true)} className="text-destructive border-destructive/20 hover:bg-destructive/10">
              <Trash2 className="w-4 h-4 mr-2" /> Empty Trash
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Trash2} title="Trash is empty" description="Deleted visa types, countries, presets, and inquiries will appear here." />
      ) : (
        <>
          <div className="flex items-start gap-2.5 p-3 mb-4 bg-warning/5 border border-warning/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warning/90">Items here are removed from the live app. Restoring a visa type also re-links any applications that referenced it.</p>
          </div>
          <div className="bg-card rounded-2xl border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/40">
                  {['Type', 'Name', 'Deleted', ''].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((item) => {
                  const Icon = TYPE_ICON[item.entityType] || Trash2;
                  return (
                    <TableRow key={item._id}>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_BADGE[item.entityType] || 'bg-muted text-muted-foreground border-border'}`}>
                          <Icon className="w-3 h-3" /> {item.entityLabel}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-foreground">{item.label}</p>
                        {item.sublabel && <p className="text-xs text-muted-foreground">{item.sublabel}</p>}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{timeAgo(item.deletedAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleRestore(item)} disabled={busy === item._id}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-success hover:bg-success/10 border border-success/20 disabled:opacity-50">
                            {busy === item._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore
                          </button>
                          <button onClick={() => setDeleteTarget(item)} disabled={busy === item._id}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 border border-destructive/20 disabled:opacity-50">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination {...paginationProps} className="border-t border-border" />
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Permanently delete this item?"
        description={deleteTarget ? `"${deleteTarget.label}" will be permanently deleted. This cannot be undone.` : undefined}
        confirmLabel="Delete Permanently"
        onConfirm={async () => { if (deleteTarget) await handleDelete(deleteTarget); }}
      />
      <ConfirmDialog
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        title="Empty the trash?"
        description={`All ${items.length} item(s) will be permanently deleted. This cannot be undone.`}
        confirmLabel="Empty Trash"
        onConfirm={handleEmpty}
      />
    </div>
  );
}
