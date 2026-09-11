'use client';
import { useEffect, useState } from 'react';
import { Mail, Phone, Trash2, Eye, MessageSquare, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { getLeads, markLeadRead, deleteLead } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { ContactLead } from '@/types';

export default function LeadsPage() {
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    getLeads()
      .then((r) => setLeads(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await markLeadRead(id);
      setLeads((prev) => prev.map((l) => (l._id === id ? { ...l, read: true } : l)));
      toast({ title: 'Marked as read', variant: 'success' });
    } catch {
      toast({ title: 'Failed to update lead', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLead(id);
      setLeads((prev) => prev.filter((l) => l._id !== id));
      toast({ title: 'Moved to Trash', description: 'Restore it anytime from the Trash page.', variant: 'success' });
    } catch {
      toast({ title: 'Failed to move lead to trash', variant: 'destructive' });
    }
  };

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(s) ||
      l.email.toLowerCase().includes(s) ||
      l.message.toLowerCase().includes(s) ||
      (l.phone || '').includes(s)
    );
  });

  const unread = leads.filter((l) => !l.read).length;
  const { pageItems, paginationProps } = usePagination(filtered, 'leads', search);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Contact Leads"
        description={
          <>
            {leads.length} total &nbsp;·&nbsp;
            <span className="text-primary font-medium">{unread} unread</span>
          </>
        }
      />

      <div className="relative max-w-sm mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title={leads.length === 0 ? 'No contact leads yet' : 'No leads match your search'} />
      ) : (
        <div className="space-y-3">
          {pageItems.map((lead) => (
            <Card
              key={lead._id}
              className={`p-5 flex gap-4 transition-all ${!lead.read ? 'border-primary/30 shadow-sm' : ''}`}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary font-bold text-sm">{lead.name?.[0]?.toUpperCase()}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-semibold text-foreground text-sm">{lead.name}</span>
                    {!lead.read && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        New
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(lead.createdAt)}</span>
                </div>

                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{lead.message}</p>

                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    {lead.email}
                  </span>
                  {lead.phone && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      {lead.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                {!lead.read && (
                  <button
                    onClick={() => handleMarkRead(lead._id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                    title="Mark as read"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setDeleteId(lead._id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete lead"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
          <Pagination {...paginationProps} className="px-0" />
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Move this lead to Trash?"
        description="You can restore it later from the Trash page."
        confirmLabel="Move to Trash"
        onConfirm={async () => { if (deleteId) await handleDelete(deleteId); }}
      />
    </div>
  );
}
