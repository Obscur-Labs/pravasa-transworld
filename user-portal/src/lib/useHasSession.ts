'use client';
import { useEffect, useState } from 'react';

/**
 * Whether a login token is stored on this device, for swapping "Sign in" style links on
 * public pages. null until mounted, since the server can't see localStorage.
 */
export function useHasSession(): boolean | null {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  useEffect(() => {
    try { setHasSession(!!localStorage.getItem('token')); } catch { setHasSession(false); }
  }, []);
  return hasSession;
}
