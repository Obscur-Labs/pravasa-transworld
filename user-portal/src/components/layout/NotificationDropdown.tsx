'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, X } from 'lucide-react';
import { useSocket } from '@/components/providers/SocketProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useSocket();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // A rejected document has to be re-uploaded on the application page, take the user
  // straight there rather than leaving them to hunt for it.
  const handleClick = (notif: { _id: string; read: boolean; application?: string | null }) => {
    if (!notif.read) markAsRead(notif._id);
    if (notif.application) {
      setOpen(false);
      router.push(`/applications/${notif.application}`);
    }
  };

  const sorted = [...notifications].sort((a, b) => {
    if (a.read === b.read) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return a.read ? 1 : -1;
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className="relative text-slate-600 hover:bg-slate-100 data-[state=open]:bg-slate-100"
        >
          <Bell className="w-5 h-5" aria-hidden />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-[18px] text-center tabular-nums ring-2 ring-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden border border-slate-200 shadow-xl rounded-xl bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-800">Notifications</h3>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</div>
          ) : (
            sorted.map((notif) => (
              <div
                key={notif._id}
                role="button"
                tabIndex={0}
                onClick={() => handleClick(notif)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(notif); } }}
                className={`group px-4 py-3 cursor-pointer border-b border-slate-100 last:border-0 transition-colors focus-visible:outline-none focus-visible:bg-slate-100 ${
                  notif.read ? 'bg-white hover:bg-slate-50' : 'bg-brand-50/60 hover:bg-brand-50'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`text-sm flex-1 min-w-0 pr-2 ${notif.read ? 'font-medium text-slate-600' : 'font-semibold text-slate-900'}`}>
                    {notif.title}
                  </h4>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!notif.read && <span className="w-2 h-2 bg-brand-600 rounded-full" aria-label="Unread" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(notif._id); }}
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-label="Delete notification"
                      title="Delete"
                      className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 p-0.5 rounded text-slate-500 hover:text-red-700 hover:bg-red-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-600">{notif.message}</p>
                <span className="text-[11px] text-slate-500 mt-2 block">{new Date(notif.createdAt).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-slate-100 bg-slate-50/50">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-full py-2.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-slate-100 transition-colors"
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
