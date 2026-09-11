'use client';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import { useSocket } from '@/components/providers/SocketProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { timeAgo } from '@/lib/utils';

const PREVIEW_COUNT = 8;

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useSocket();

  // The list is already newest first, so unread-then-read keeps both halves in order.
  const preview = [...notifications.filter((n) => !n.read), ...notifications.filter((n) => n.read)].slice(0, PREVIEW_COUNT);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative text-muted-foreground hover:bg-muted hover:text-foreground">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-card" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden rounded-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-xs font-medium text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {preview.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications yet" className="py-10" />
          ) : (
            preview.map((notif) => (
              <div
                key={notif._id}
                onClick={() => !notif.read && markAsRead(notif._id)}
                className={`group px-4 py-3 cursor-pointer border-b border-border last:border-0 transition-colors ${
                  notif.read ? 'hover:bg-muted' : 'bg-accent hover:bg-muted'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`text-sm flex-1 min-w-0 pr-2 ${notif.read ? 'font-medium text-muted-foreground' : 'font-semibold text-foreground'}`}>
                    {notif.title}
                  </h4>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!notif.read && <span className="w-2 h-2 bg-primary rounded-full" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(notif._id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      aria-label="Delete notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{notif.message}</p>
                <span className="text-[11px] text-muted-foreground mt-1.5 block">{timeAgo(notif.createdAt)}</span>
              </div>
            ))
          )}
        </div>
        <DropdownMenuItem asChild className="rounded-none border-t border-border justify-center py-2.5 text-sm font-medium text-primary cursor-pointer">
          <Link href="/notifications">View all notifications</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
