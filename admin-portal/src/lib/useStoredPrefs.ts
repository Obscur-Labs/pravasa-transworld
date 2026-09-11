'use client';
import { useEffect, useState } from 'react';

/** Page preferences (view, sort, filters) remembered in this browser across visits. */
export function useStoredPrefs<T extends object>(key: string, defaults: T) {
  const [prefs, setPrefs] = useState<T>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(prefs)); } catch {}
  }, [key, prefs]);

  const update = (patch: Partial<T>) => setPrefs((p) => ({ ...p, ...patch }));
  const reset = () => setPrefs(defaults);
  return [prefs, update, reset] as const;
}
