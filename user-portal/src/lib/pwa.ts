'use client';
import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window { __pwaInstallEvent?: BeforeInstallPromptEvent | null }
}

// How this browser installs web apps, for the ones without a prompt a page can trigger.
export type ManualPlatform = 'ios' | 'safari-mac' | 'firefox-android' | 'firefox-desktop';

function detectManualPlatform(): ManualPlatform | null {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Firefox\//.test(ua)) return /Android/.test(ua) ? 'firefox-android' : 'firefox-desktop';
  if (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser/.test(ua)) return 'safari-mac';
  return null;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * mode: 'prompt'       the browser's own install dialog is available
 *       'instructions' install is done from the browser menu; show the steps
 *       'hidden'       already installed, or nothing to offer yet
 */
export function usePwaInstall() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [manual, setManual] = useState<ManualPlatform | null>(null);

  useEffect(() => {
    setInstalled(isStandalone());
    setEvent(window.__pwaInstallEvent ?? null);
    setManual(detectManualPlatform());
    setReady(true);

    const onInstallable = () => setEvent(window.__pwaInstallEvent ?? null);
    const onInstalled = () => { setInstalled(true); setEvent(null); };
    window.addEventListener('pwa-installable', onInstallable);
    window.addEventListener('pwa-installed', onInstalled);
    return () => {
      window.removeEventListener('pwa-installable', onInstallable);
      window.removeEventListener('pwa-installed', onInstalled);
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!event) return 'unavailable';
    await event.prompt();
    const { outcome } = await event.userChoice;
    // A prompt can only be used once; the browser fires a fresh event if it may ask again.
    window.__pwaInstallEvent = null;
    setEvent(null);
    return outcome;
  };

  const mode: 'prompt' | 'instructions' | 'hidden' =
    !ready || installed ? 'hidden' : event ? 'prompt' : manual ? 'instructions' : 'hidden';

  return { mode, manual, install };
}
