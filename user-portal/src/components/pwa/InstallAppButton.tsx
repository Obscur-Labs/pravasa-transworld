'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, MoreVertical, PlusSquare, Share, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { usePwaInstall, type ManualPlatform } from '@/lib/pwa';

const STEPS: Record<ManualPlatform, { title: string; steps: React.ReactNode[]; note?: string }> = {
  ios: {
    title: 'Add to your Home Screen',
    steps: [
      <>Tap the <Share className="inline w-4 h-4 -mt-0.5 text-brand-600" aria-label="Share" /> <strong>Share</strong> button in your browser&apos;s toolbar.</>,
      <>Scroll down and tap <PlusSquare className="inline w-4 h-4 -mt-0.5 text-brand-600" aria-hidden /> <strong>Add to Home Screen</strong>.</>,
      <>Tap <strong>Add</strong>. Pravasa opens from your Home Screen like any other app.</>,
    ],
    note: 'Works in Safari, and in Chrome or Edge on iOS 16.4 and later.',
  },
  'safari-mac': {
    title: 'Add to your Dock',
    steps: [
      <>In the menu bar, open <strong>File</strong> (or tap the <Share className="inline w-4 h-4 -mt-0.5 text-brand-600" aria-label="Share" /> Share button).</>,
      <>Choose <strong>Add to Dock</strong>, then click <strong>Add</strong>.</>,
    ],
    note: 'Needs Safari 17 or later (macOS Sonoma).',
  },
  'firefox-android': {
    title: 'Install from Firefox',
    steps: [
      <>Tap the <MoreVertical className="inline w-4 h-4 -mt-0.5 text-brand-600" aria-label="menu" /> menu button.</>,
      <>Tap <strong>Install</strong> (on some versions: <strong>Add to Home screen</strong>).</>,
    ],
  },
  'firefox-desktop': {
    title: 'Install on this computer',
    steps: [
      <>Firefox on computers can&apos;t install websites as apps.</>,
      <>Open this site in <strong>Chrome</strong>, <strong>Edge</strong> or <strong>Safari</strong> and choose <strong>Install app</strong> there.</>,
    ],
    note: 'You can keep using the full site in Firefox as normal.',
  },
};

interface Props {
  className?: string;
  /** Visible label; hidden in collapsed layouts but still announced. */
  label?: string;
  iconOnly?: boolean;
  /** Called with the result of the browser's install dialog. */
  onOutcome?: (outcome: 'accepted' | 'dismissed') => void;
}

/** Installs the portal as an app, or explains how on browsers without an install prompt. */
export default function InstallAppButton({ className = '', label = 'Install App', iconOnly = false, onOutcome }: Props) {
  const { mode, manual, install } = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (mode === 'hidden') return null;

  const handleClick = async () => {
    if (mode === 'instructions') { setOpen(true); return; }
    const outcome = await install();
    if (outcome !== 'unavailable') onOutcome?.(outcome);
    if (outcome === 'accepted') toast({ title: 'Pravasa installed', description: 'Open it from your home screen or app list.', variant: 'success' });
  };

  const guide = manual ? STEPS[manual] : null;

  return (
    <>
      <button type="button" onClick={handleClick} className={className} title={iconOnly ? label : undefined} aria-label={iconOnly ? label : undefined}>
        <Download className="w-4 h-4 flex-shrink-0" aria-hidden />
        {!iconOnly && <span>{label}</span>}
      </button>

      {guide && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-[91] mx-auto w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl focus:outline-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:w-[calc(100%-2rem)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src="/icon-192.png" alt="" className="w-12 h-12 rounded-xl" />
                  <div>
                    <Dialog.Title className="text-lg font-bold text-slate-900">{guide.title}</Dialog.Title>
                    <Dialog.Description className="text-xs text-slate-500">Get Pravasa Transworld as an app</Dialog.Description>
                  </div>
                </div>
                <Dialog.Close aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
                  <X className="w-4 h-4" />
                </Dialog.Close>
              </div>
              <ol className="mt-5 space-y-3">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
              {guide.note && <p className="mt-4 text-xs text-slate-400">{guide.note}</p>}
              <Dialog.Close className="mt-5 w-full rounded-xl bg-brand-800 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2">
                Got it
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
