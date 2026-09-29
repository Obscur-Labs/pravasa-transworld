'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import InstallAppButton from './InstallAppButton';
import { usePwaInstall } from '@/lib/pwa';

const DISMISS_KEY = 'pwa_banner_dismissed_until';
// Matches the backend's default JWT_EXPIRES_IN, used when the token can't be read.
const FALLBACK_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** When the current login token expires, so a dismissal lasts exactly as long as the login. */
function loginExpiry(): number {
  try {
    const payload = localStorage.getItem('token')?.split('.')[1];
    if (payload) {
      const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof exp === 'number' && exp * 1000 > Date.now()) return exp * 1000;
    }
  } catch { /* malformed token: fall back */ }
  return Date.now() + FALLBACK_SNOOZE_MS;
}

/**
 * Phone/tablet nudge on the dashboard. Closing it, or cancelling the browser's install
 * dialog, hides it until the login token expires, so nobody is asked twice in a session.
 */
export default function InstallBanner() {
  const { mode } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(Date.now() < Number(localStorage.getItem(DISMISS_KEY) || 0));
    } catch {
      setDismissed(false);
    }
  }, []);

  if (mode === 'hidden' || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, String(loginExpiry())); } catch { /* private mode */ }
  };

  return (
    <div className="lg:hidden mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-white p-3">
      <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Get the Pravasa app</p>
        <p className="text-xs text-slate-500">Track your visa from your home screen.</p>
      </div>
      <InstallAppButton
        label="Install"
        onOutcome={(outcome) => { if (outcome === 'dismissed') dismiss(); }}
        className="flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      />
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-lg p-1 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
