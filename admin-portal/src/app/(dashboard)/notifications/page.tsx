'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Bell, CheckCheck, Clock, CreditCard, FileText, Loader2, MessageSquare, RefreshCw, Trash2, Truck, X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSocket } from '@/components/providers/SocketProvider';
import { cn, formatDate, timeAgo } from '@/lib/utils';
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
};
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
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const visible = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;
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
            {notifications.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteAll(true)} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />Delete all
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')} className="mb-5">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description="New applications, payments and courier updates appear here."
        />
      ) : (
        <div className="space-y-6">
          {groupByDay(pageItems).map((group) => (
            <section key={group.label}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{group.label}</h2>
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
                          <span title={new Date(n.createdAt).toLocaleString()}>{timeAgo(n.createdAt)}</span>
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
