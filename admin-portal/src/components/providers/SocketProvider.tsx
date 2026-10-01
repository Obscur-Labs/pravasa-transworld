'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAdminAuthStore } from '@/store/auth.store';
import { toast } from '@/components/ui/use-toast';
import {
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAdminNotification,
  deleteAllAdminNotifications,
} from '@/lib/api';
import type { AdminNotification } from '@/types';
import { allows, notificationModule } from '@/config/permissions';

const PAYMENT_QUEUE_TYPES = new Set(['payment_submitted', 'payment_reminder']);

interface NotificationContextType {
  notifications: AdminNotification[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  /** Goes up whenever the payment verification queue changes, so pages know to refetch. */
  paymentsVersion: number;
}

const SocketContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: true,
  hasMore: false,
  loadMore: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  deleteAllNotifications: async () => {},
  paymentsVersion: 0,
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [paymentsVersion, setPaymentsVersion] = useState(0);
  const token = useAdminAuthStore((s) => s.token);
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated);

  const fetchPage = useCallback(async (before?: string) => {
    const { notifications: page, hasMore, unreadCount } = (await getAdminNotifications(before)).data.data;
    setNotifications((prev) => (before ? [...prev, ...page] : page));
    setHasMore(hasMore);
    setUnreadCount(unreadCount);
  }, []);

  const loadMore = async () => {
    const oldest = notifications[notifications.length - 1];
    if (oldest) await fetchPage(oldest.createdAt).catch(() => {});
  };

  const markAsRead = async (id: string) => {
    await markAdminNotificationRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllAsRead = async () => {
    await markAllAdminNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string) => {
    const target = notifications.find((n) => n._id === id);
    await deleteAdminNotification(id).catch(() => {});
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    if (target && !target.read) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const deleteAllNotifications = async () => {
    await deleteAllAdminNotifications().catch(() => {});
    setNotifications([]);
    setHasMore(false);
    setUnreadCount(0);
  };

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    fetchPage()
      .catch((err) => console.error('Failed to fetch notifications', err))
      .finally(() => setLoading(false));

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const socket = io(apiUrl.startsWith('http') ? new URL(apiUrl).origin : apiUrl, { auth: { token } });

    socket.on('admin_notification', (newNotif: AdminNotification) => {
      // Every admin socket gets every push; show only the ones for this member's modules.
      const me = useAdminAuthStore.getState().admin;
      const module = notificationModule(newNotif.type);
      if (module && !me?.isSuperAdmin && !allows(me?.permissions?.[module], 'view')) return;
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((c) => c + 1);
      toast({ title: newNotif.title, description: newNotif.message });
      if (PAYMENT_QUEUE_TYPES.has(newNotif.type)) setPaymentsVersion((v) => v + 1);
    });

    // Another admin verified or rejected a payment.
    socket.on('payments_changed', () => setPaymentsVersion((v) => v + 1));

    return () => { socket.disconnect(); };
  }, [isAuthenticated, token, fetchPage]);

  return (
    <SocketContext.Provider
      value={{ notifications, unreadCount, loading, hasMore, loadMore, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications, paymentsVersion }}
    >
      {children}
    </SocketContext.Provider>
  );
}
