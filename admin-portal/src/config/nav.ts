import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, FileText, Globe2, Users, Kanban,
  Bell, MessageSquare, LayoutTemplate, Trash2, Tag, History, SlidersHorizontal, Receipt, Mail, UserRound, ScrollText,
  BadgeCheck, QrCode,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Single source of truth for sidebar nav + the command palette, so the two never drift.
export const topNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/applications', label: 'Applications', icon: FileText },
  { href: '/payments', label: 'Payment Verification', icon: BadgeCheck },
  { href: '/processing', label: 'Processing Board', icon: Kanban },
  { href: '/countries', label: 'Countries & Visas', icon: Globe2 },
];

// Grouped under the "Configurations" accordion in the sidebar.
export const configNavItems: NavItem[] = [
  { href: '/form-config', label: 'Form Presets', icon: LayoutTemplate },
  { href: '/terms-config', label: 'Terms Presets', icon: ScrollText },
  { href: '/visa-config', label: 'Visa Config', icon: SlidersHorizontal },
  { href: '/payment-config', label: 'Payment Settings', icon: QrCode },
  { href: '/receipt-config', label: 'Receipt Config', icon: Receipt },
  { href: '/embassy-mail-config', label: 'Embassy Mail', icon: Mail },
];

export const bottomNavItems: NavItem[] = [
  { href: '/users', label: 'Customers', icon: Users },
  { href: '/promo-codes', label: 'Promo Codes', icon: Tag },
  { href: '/leads', label: 'Contact Leads', icon: MessageSquare },
];

// Grouped under the "Other Options" accordion in the sidebar.
export const otherNavItems: NavItem[] = [
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/trash', label: 'Trash', icon: Trash2 },
  { href: '/logs', label: 'Activity Logs', icon: History },
];

// Reached from the account menu, so only the command palette lists it.
const accountNavItems: NavItem[] = [{ href: '/profile', label: 'My Profile', icon: UserRound }];

export const allNavItems: NavItem[] = [...topNavItems, ...configNavItems, ...bottomNavItems, ...otherNavItems, ...accountNavItems];
