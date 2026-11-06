'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AtSign, Bell, CheckCheck, Clock, CreditCard, FileText, Layers, Loader2, MessageSquare, RefreshCw, Settings2, Trash2, Truck, X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/api';
import { useSocket } from '@/components/providers/SocketProvider';
import { cn, formatDate, formatDateTimeIST, timeAgo } from '@/lib/utils';
import type { AdminNotification } from '@/types';

const TYPE_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  new_application: { icon: FileText, tone: 'bg-primary/10 text-primary' },
  new_lead: { icon: MessageSquare, tone: 'bg-info/10 text-info' },
  payment_received: { icon: CreditCard, tone: 'bg-success/10 text-success' },
  payment_submitted: { icon: CreditCard, tone: 'bg-warning/10 text-warning' },
  payment_reminder: { icon: Clock, tone: 'bg-warning/10 text-warning' },
  payment_failed: { icon: CreditCard, tone: 'bg-destructive/10 text-destructive' },
  courier_shipped: { icon: Truck, tone: 'bg-warning/10 text-warning' },
  status_update: { icon: RefreshCw, tone: 'bg-info/10 text-info' },
  mention: { icon: AtSign, tone: 'bg-warning/10 text-warning' },
};

type Filter = 'all' | 'unread' | 'mentions' | 'payments';
const PAYMENT_TYPES = new Set(['payment_received', 'payment_submitted', 'payment_reminder', 'payment_failed']);
const FILTERS: Record<Filter, (n: AdminNotification) => boolean> = {
  all: () => true,
  unread: (n) => !n.read,
  mentions: (n) => n.type === 'mention',
  payments: (n) => PAYMENT_TYPES.has(n.type),
};

const CATEGORY_LABELS: Record<string, { label: string; hint: string }> = {
  applications: { label: 'Applications', hint: 'New applications, status changes, courier updates' },
  payments: { label: 'Payments', hint: 'Payments submitted, verified, reminders' },
  inquiries: { label: 'Inquiries', hint: 'Contact messages and service requests' },
  general: { label: 'Other', hint: 'Extra documents uploaded, broken family links' },
};

/** Notifications about the same application sit together, newest group first. */
function groupByApplication(items: AdminNotification[]) {
  const groups = new Map<string, { label: string; application: string | null; items: AdminNotification[] }>();
  for (const n of items) {
    const key = n.application || 'none';
    const g = groups.get(key) ?? { label: n.applicationRef || (n.application ? 'Application' : 'Other'), application: n.application, items: [] };
    g.items.push(n);
    groups.set(key, g);
  }
  return [...groups.values()];
}
const FALLBACK_STYLE = { icon: Bell, tone: 'bg-muted text-muted-foreground' };

function groupByDay(items: AdminNotification[]) {
  const now = new Date();
  const today = now.toDateString();
  now.setDate(now.getDate() - 1);
  const yesterday = now.toDateString();
  const dayLabel = (date: string) => {
    const day = new Date(date).toDateString();
    return day === today ? 'Today' : day === yesterday ? 'Yesterday' : formatDate(date);
  };

  const groups: { label: string; items: AdminNotification[] }[] = [];
  for (const n of items) {
    const label = dayLabel(n.createdAt);
    if (groups[groups.length - 1]?.label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(n);
  }
  return groups;
}

export default function AdminNotificationsPage() {
  const {
    notifications, unreadCount, loading, hasMore, loadMore, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications,
  } = useSocket();
  const [filter, setFilter] = useState<Filter>('all');
  const [byApplication, setByApplication] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState<{ categories: string[]; muted: string[] } | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (prefsOpen && !prefs) getNotificationPreferences().then((r) => setPrefs(r.data.data)).catch(() => {});
  }, [prefsOpen, prefs]);

  const savePrefs = async () => {
    if (!prefs) return;
    setSavingPrefs(true);
    try {
      await updateNotificationPreferences(prefs.muted);
      toast({ title: 'Preferences saved', description: 'Muted categories stop appearing from now on.', variant: 'success' });
      setPrefsOpen(false);
    } catch {
      toast({ title: 'Could not save', variant: 'destructive' });
    } finally {
      setSavingPrefs(false);
    }
  };

  const visible = notifications.filter(FILTERS[filter]);
  const mentionCount = notifications.filter((n) => n.type === 'mention' && !n.read).length;
  const { pageItems, paginationProps } = usePagination(visible, 'notifications', filter);
  const onLastPage = !paginationProps.pageSize || paginationProps.page * paginationProps.pageSize >= visible.length;

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadMore();
    setLoadingMore(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        action={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <CheckCheck className="w-4 h-4 mr-2" />Mark all read
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setPrefsOpen(true)}>
              <Settings2 className="w-4 h-4 mr-2" />Preferences
            </Button>
            {notifications.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteAll(true)} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />Delete all
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}</TabsTrigger>
            <TabsTrigger value="mentions">Mentions{mentionCount > 0 ? ` (${mentionCount})` : ''}</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
        </Tabs>
        <button type="button" onClick={() => setByApplication((v) => !v)} aria-pressed={byApplication}
          className={cn('ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            byApplication ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
          <Layers className="w-3.5 h-3.5" />Group by application
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? 'No unread notifications' : filter === 'mentions' ? 'Nobody has mentioned you' : filter === 'payments' ? 'No payment notifications' : 'No notifications yet'}
          description="New applications, payments and courier updates appear here."
        />
      ) : (
        <div className="space-y-6">
          {(byApplication ? groupByApplication(pageItems) : groupByDay(pageItems)).map((group) => (
            <section key={group.label + ('application' in group ? String(group.application) : '')}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                <span className={byApplication ? 'font-mono normal-case' : ''}>{group.label}</span>
                {byApplication && <span className="normal-case font-normal">{group.items.length} update{group.items.length === 1 ? '' : 's'}</span>}
                {byApplication && 'application' in group && typeof group.application === 'string' ? (
                  <Link href={`/applications/${group.application}`} className="ml-auto normal-case font-medium text-primary hover:underline">Open</Link>
                ) : null}
              </h2>
              <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
                {group.items.map((n) => {
                  const { icon: Icon, tone } = TYPE_STYLE[n.type] ?? FALLBACK_STYLE;
                  return (
                    <div
                      key={n._id}
                      onClick={() => !n.read && markAsRead(n._id)}
                      className={cn('group flex items-start gap-3 p-4 cursor-pointer transition-colors', n.read ? 'hover:bg-muted' : 'bg-accent hover:bg-muted')}
                    >
                      <span className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', tone)}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm font-semibold truncate', n.read ? 'text-muted-foreground' : 'text-foreground')}>{n.title}</p>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span title={formatDateTimeIST(n.createdAt)}>{timeAgo(n.createdAt)}</span>
                          {n.application && (
                            <Link
                              href={`/applications/${n.application}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-primary hover:underline"
                            >
                              Open application
                            </Link>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
                        aria-label="Delete notification"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <Pagination {...paginationProps} className="px-0" />

          {hasMore && onLastPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Load older notifications
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notification preferences</DialogTitle>
            <DialogDescription>Choose what shows up in your bell. @mentions always come through.</DialogDescription>
          </DialogHeader>
          {!prefs ? <Skeleton className="h-40 w-full" /> : (
            <div className="space-y-2">
              {prefs.categories.map((c) => {
                const on = !prefs.muted.includes(c);
                return (
                  <label key={c} className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={on}
                      onChange={() => setPrefs({ ...prefs, muted: on ? [...prefs.muted, c] : prefs.muted.filter((m) => m !== c) })} />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{CATEGORY_LABELS[c]?.label ?? c}</span>
                      <span className="block text-xs text-muted-foreground">{CATEGORY_LABELS[c]?.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPrefsOpen(false)}>Cancel</Button>
            <Button onClick={savePrefs} disabled={!prefs || savingPrefs}>{savingPrefs && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Delete all notifications?"
        description="This cannot be undone."
        confirmLabel="Delete all"
        onConfirm={deleteAllNotifications}
      />
    </div>
  );
}
