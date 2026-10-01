'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { BookmarkPlus, Loader2, RotateCcw, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True when this progress was resumed from a saved draft. */
  fromDraft: boolean;
  /** Files picked from the device can't be kept, only answers and vault documents. */
  hasUploadedFiles: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export default function StartOverDialog({ open, onOpenChange, fromDraft, hasUploadedFiles, saving, onSave, onDiscard }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-bold text-slate-900">Start a new application?</Dialog.Title>
            <Dialog.Close
              aria-label="Keep editing"
              disabled={saving}
              className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1.5 text-sm text-slate-600">
            {fromDraft
              ? 'Save your changes to this draft in My Applications, or discard them. The saved draft stays either way.'
              : 'Save this application to My Applications to finish it later, or discard it.'}
          </Dialog.Description>
          {hasUploadedFiles && (
            <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Your answers and documents picked from your vault are saved. Files uploaded from your device will need to be added again.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
              {fromDraft ? 'Save changes & start over' : 'Save to My Applications'}
            </button>
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <RotateCcw className="h-4 w-4" />
              {fromDraft ? 'Discard changes & start over' : 'Discard & start over'}
            </button>
            <Dialog.Close
              disabled={saving}
              className="rounded-xl py-2 text-sm font-medium text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              Cancel, keep editing
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
