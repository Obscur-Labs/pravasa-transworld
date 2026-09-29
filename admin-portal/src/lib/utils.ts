import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function timeAgo(date: string | Date): string {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : formatDate(date);
}

/** Countdown to a deadline, e.g. "11h 20m left" or "Overdue by 2h 5m". */
export function deadlineLabel(deadline: string | Date, now = Date.now()): { label: string; overdue: boolean; urgent: boolean } {
  const diffMin = Math.round((new Date(deadline).getTime() - now) / 60000);
  const abs = Math.abs(diffMin);
  const span = abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs}m`;
  if (diffMin < 0) return { label: `Overdue by ${span}`, overdue: true, urgent: true };
  return { label: `${span} left`, overdue: false, urgent: diffMin <= 120 };
}
