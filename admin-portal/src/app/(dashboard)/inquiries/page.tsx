'use client';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Mail, Phone, MapPin, Trash2, Eye, MessageSquare, Search, Plane, Hotel, Bus, ShieldCheck, Banknote, MessageCircle, Briefcase,
  Reply, FilePlus2, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReplyDrawer, type ReplyTarget } from '@/components/inquiries/reply-drawer';
import { TemplatesDialog } from '@/components/inquiries/templates-dialog';
import { ConvertDialog, type ConvertTarget } from '@/components/inquiries/convert-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import {
  getLeads, markLeadRead, deleteLead, getServiceInquiries, markServiceInquiryRead, deleteServiceInquiry, setInquiryStatus,
  getReplyTemplates, getApplicationAssignees, assignInquiry,
} from '@/lib/api';
import { formatDateTimeIST } from '@/lib/utils';
import type { ContactLead, InquiryReply, InquiryService, InquiryStatus, ReplyTemplate, ServiceInquiry } from '@/types';
import { useBadgesStore } from '@/store/badges.store';

type Tab = 'contact' | InquiryService;

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'contact', label: 'Contact', icon: MessageSquare },
  { key: 'flight', label: 'Flights', icon: Plane },
  { key: 'hotel', label: 'Hotels', icon: Hotel },
  { key: 'transport', label: 'Transport', icon: Bus },
  { key: 'insurance', label: 'Insurance', icon: ShieldCheck },
  { key: 'forex', label: 'Forex', icon: Banknote },
  { key: 'b2b_agent', label: 'B2B agents', icon: Briefcase },
];

const STATUSES: { key: InquiryStatus; label: string; tone: string }[] = [
  { key: 'new', label: 'New', tone: 'bg-primary/10 text-primary' },
  { key: 'open', label: 'Open', tone: 'bg-info/10 text-info' },
  { key: 'awaiting_customer', label: 'Awaiting customer', tone: 'bg-warning/10 text-warning' },
  { key: 'converted', label: 'Converted', tone: 'bg-success/10 text-success' },
  { key: 'closed', label: 'Closed', tone: 'bg-muted text-muted-foreground' },
];

/** Contact leads and service inquiries in one shape, so a single card renders both. */
interface Item {
  _id: string;
  tab: Tab;
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  message: string;
  details: { label: string; value: string }[];
  read: boolean;
  status: InquiryStatus;
  assignedTo: string | null;
  replies: InquiryReply[];
  convertedTo: { visaName: string; at: string } | null;
  createdAt: string;
}

const kindOf = (item: { tab: Tab }) => (item.tab === 'contact' ? 'lead' : 'inquiry') as 'lead' | 'inquiry';

const fromLead = (l: ContactLead): Item => ({
  _id: l._id, tab: 'contact', name: l.name, email: l.email, phone: l.phone || '', location: '',
  summary: '', message: l.message, details: [], read: l.read, status: l.status || (l.read ? 'open' : 'new'), createdAt: l.createdAt,
  assignedTo: l.assignedTo || null, replies: l.replies || [], convertedTo: l.convertedTo || null,
});

// Free-text notes read better as a paragraph than as a grid cell.
const fromInquiry = (q: ServiceInquiry): Item => ({
  _id: q._id, tab: q.service, name: q.name, email: q.email, phone: q.phone, location: q.location,
  summary: q.summary, message: q.details.find((d) => d.key === 'notes')?.value || '',
  details: q.details.filter((d) => d.key !== 'notes'), read: q.read, status: q.status || (q.read ? 'open' : 'new'), createdAt: q.createdAt,
  assignedTo: q.assignedTo || null, replies: q.replies || [], convertedTo: q.convertedTo || null,
});

const TAB_PARAM = 'tab';

export default function InquiriesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('contact');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | ''>('');
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [team, setTeam] = useState<{ _id: string; name: string }[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [convertFor, setConvertFor] = useState<ConvertTarget | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(TAB_PARAM);
    if (TABS.some((t) => t.key === fromUrl)) setTab(fromUrl as Tab);

    Promise.all([getLeads(), getServiceInquiries()])
      .then(([leads, inquiries]) => {
        const all = [
          ...(leads.data.data as ContactLead[]).map(fromLead),
          ...(inquiries.data.data as ServiceInquiry[]).map(fromInquiry),
        ];
        setItems(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      })
      .catch(() => toast({ title: 'Could not load inquiries', variant: 'destructive' }))
      .finally(() => setLoading(false));
    getReplyTemplates().then((r) => setTemplates(r.data.data)).catch(() => {});
    getApplicationAssignees().then((r) => setTeam(r.data.data)).catch(() => {});
  }, []);

  const patch = (id: string, change: Partial<Item>) => setItems((prev) => prev.map((i) => (i._id === id ? { ...i, ...change } : i)));

  const handleAssign = async (item: Item, assignee: string) => {
    const before = item.assignedTo;
    patch(item._id, { assignedTo: assignee || null });
    try {
      await assignInquiry(kindOf(item), item._id, assignee || null);
    } catch {
      patch(item._id, { assignedTo: before });
      toast({ title: 'Could not assign', variant: 'destructive' });
    }
  };

  const openReply = (item: Item) => setReplyTo({
    kind: kindOf(item), id: item._id, name: item.name, email: item.email, phone: item.phone,
    source: TABS.find((t) => t.key === item.tab)!.label, message: item.summary ? `${item.summary}${item.message ? `\n${item.message}` : ''}` : item.message,
    createdAt: item.createdAt, replies: item.replies,
  });

  const selectTab = (next: Tab) => {
    setTab(next);
    setSearch('');
    setStatusFilter('');
    const url = new URL(window.location.href);
    url.searchParams.set(TAB_PARAM, next);
    window.history.replaceState(null, '', url);
  };

  const handleMarkRead = async (item: Item) => {
    try {
      await (item.tab === 'contact' ? markLeadRead(item._id) : markServiceInquiryRead(item._id));
      setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, read: true } : i)));
      useBadgesStore.getState().refresh();
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleStatus = async (item: Item, status: InquiryStatus) => {
    const before = items;
    setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, status, read: true } : i)));
    try {
      await setInquiryStatus(kindOf(item), item._id, status);
      useBadgesStore.getState().refresh();
    } catch {
      setItems(before);
      toast({ title: 'Could not update the status', variant: 'destructive' });
    }
  };

  const handleDelete = async (item: Item) => {
    try {
      await (item.tab === 'contact' ? deleteLead(item._id) : deleteServiceInquiry(item._id));
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      useBadgesStore.getState().refresh();
      toast({ title: 'Moved to Trash', description: 'Restore it anytime from the Trash page.', variant: 'success' });
    } catch {
      toast({ title: 'Failed to move to trash', variant: 'destructive' });
    }
  };

  const inTab = items.filter((i) => i.tab === tab);
  const s = search.trim().toLowerCase();
  const byStatus = statusFilter ? inTab.filter((i) => i.status === statusFilter) : inTab;
  const filtered = !s ? byStatus : byStatus.filter((i) =>
    [i.name, i.email, i.phone, i.location, i.summary, i.message, ...i.details.map((d) => d.value)]
      .some((v) => v.toLowerCase().includes(s)));
  const { pageItems, paginationProps } = usePagination(filtered, 'inquiries', `${tab}|${search}|${statusFilter}`);
  const totalUnread = items.filter((i) => !i.read).length;
  const activeLabel = TABS.find((t) => t.key === tab)!.label.toLowerCase();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Inquiries"
        description={
          <>
            Contact messages and service requests from the website &nbsp;·&nbsp;
            <span className="text-primary font-medium">{totalUnread} unread</span>
          </>
        }
      />

      {/* Tabs */}
      <div className="mb-5 -mx-1 overflow-x-auto px-1">
        <div role="tablist" aria-label="Inquiry type" className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            const count = items.filter((i) => i.tab === key).length;
            const unread = items.filter((i) => i.tab === key && !i.read).length;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                <span
                  title={unread ? `${unread} unread` : undefined}
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                    unread ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'
                  }`}
                >
                  {unread || count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4" role="group" aria-label="Status">
        {[{ key: '' as const, label: 'All' }, ...STATUSES].map((st) => {
          const count = st.key ? inTab.filter((i) => i.status === st.key).length : inTab.length;
          return (
            <button key={st.key || 'all'} type="button" aria-pressed={statusFilter === st.key} onClick={() => setStatusFilter(st.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === st.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {st.label} <span className="tabular-nums opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="relative max-w-sm mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, route, details..."
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
        <EmptyState
          icon={TABS.find((t) => t.key === tab)!.icon}
          title={inTab.length === 0 ? `No ${activeLabel} inquiries yet` : 'Nothing matches your filters'}
        />
      ) : (
        <div className="space-y-3">
          {pageItems.map((item) => {
            const digits = item.phone.replace(/\D/g, '');
            return (
              <Card key={item._id} className={`p-5 flex gap-4 transition-all ${!item.read ? 'border-primary/30 shadow-sm' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">{item.name?.[0]?.toUpperCase()}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-semibold text-foreground text-sm">{item.name}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUSES.find((st) => st.key === item.status)?.tone}`}>
                        {STATUSES.find((st) => st.key === item.status)?.label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDateTimeIST(item.createdAt)}</span>
                  </div>

                  {item.summary && <p className="text-sm font-medium text-foreground mb-3">{item.summary}</p>}

                  {item.details.length > 0 && (
                    <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 rounded-lg bg-muted/40 p-3 mb-3">
                      {item.details.map((d) => (
                        <div key={d.label} className="min-w-0">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d.label}</dt>
                          <dd className="text-sm text-foreground break-words">{d.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {item.message && <p className="text-sm text-muted-foreground mb-3 leading-relaxed whitespace-pre-line">{item.message}</p>}

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {item.phone && (
                      <a href={`tel:${item.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                        <Phone className="w-3.5 h-3.5" />{item.phone}
                      </a>
                    )}
                    {item.tab !== 'contact' && digits && (
                      <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold text-success hover:underline">
                        <MessageCircle className="w-3.5 h-3.5" />WhatsApp
                      </a>
                    )}
                    {item.email && (
                      <a href={`mailto:${item.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                        <Mail className="w-3.5 h-3.5" />{item.email}
                      </a>
                    )}
                    {item.location && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />{item.location}
                      </span>
                    )}
                  </div>

                  {item.replies.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Last reply by {item.replies[item.replies.length - 1].by} · {formatDateTimeIST(item.replies[item.replies.length - 1].at)}
                      {item.replies.length > 1 ? ` · ${item.replies.length} replies` : ''}
                    </p>
                  )}
                  {item.convertedTo && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success">
                      <CheckCircle2 className="w-3.5 h-3.5" />Application started: {item.convertedTo.visaName}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openReply(item)}>
                      <Reply className="w-3.5 h-3.5 mr-1.5" />Reply
                    </Button>
                    {!item.convertedTo && (
                      <Button size="sm" variant="ghost" onClick={() => setConvertFor({ kind: kindOf(item), id: item._id, name: item.name, email: item.email })}>
                        <FilePlus2 className="w-3.5 h-3.5 mr-1.5" />Convert to application
                      </Button>
                    )}
                    {item.status !== 'closed' && (
                      <Button size="sm" variant="ghost" onClick={() => handleStatus(item, 'closed')}>Mark closed</Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <NativeSelect className="h-8 w-auto text-xs" value={item.status} aria-label="Status"
                    onChange={(e) => handleStatus(item, e.target.value as InquiryStatus)}>
                    {STATUSES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                  </NativeSelect>
                  <NativeSelect className="h-8 w-auto text-xs" value={item.assignedTo || ''} aria-label="Assigned to"
                    onChange={(e) => handleAssign(item, e.target.value)}>
                    <option value="">Unassigned</option>
                    {team.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </NativeSelect>
                  {!item.read && (
                    <button
                      onClick={() => handleMarkRead(item)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                      title="Mark as read"
                      aria-label="Mark as read"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Move to Trash"
                    aria-label="Move to Trash"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
          <Pagination {...paginationProps} className="px-0" />
        </div>
      )}

      <ReplyDrawer
        target={replyTo}
        templates={templates}
        onClose={() => setReplyTo(null)}
        onSent={(doc) => replyTo && patch(replyTo.id, { replies: doc.replies, status: doc.status as InquiryStatus, read: true })}
        onManageTemplates={() => setTemplatesOpen(true)}
      />
      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} templates={templates} onSaved={setTemplates} />
      <ConvertDialog
        target={convertFor}
        onClose={() => setConvertFor(null)}
        onConverted={(doc) => convertFor && patch(convertFor.id, {
          status: doc.status as InquiryStatus, read: true, convertedTo: { visaName: doc.convertedTo.visaName, at: new Date().toISOString() },
        })}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Move this inquiry to Trash?"
        description="You can restore it later from the Trash page."
        confirmLabel="Move to Trash"
        onConfirm={async () => { if (deleteTarget) await handleDelete(deleteTarget); }}
      />
    </div>
  );
}
