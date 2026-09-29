'use client';
import { useEffect } from 'react';

/** Registers /sw.js in production. Skipped in dev so it never interferes with hot reload. */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => console.error('Service worker registration failed', err));
  }, []);
  return null;
}
