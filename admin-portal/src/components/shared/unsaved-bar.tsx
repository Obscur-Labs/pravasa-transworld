'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Tracks whether a settings form differs from what was last loaded or saved, and warns
 * before the tab is closed with changes. Call markSaved after loading and after saving.
 */
export function useUnsaved<T>(value: T) {
  const [baseline, setBaseline] = useState<string | null>(null);
  const dirty = baseline !== null && baseline !== JSON.stringify(value);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const markSaved = useCallback((v: T) => setBaseline(JSON.stringify(v)), []);
  const saved = useCallback((): T | null => (baseline === null ? null : JSON.parse(baseline)), [baseline]);
  return { dirty, markSaved, saved };
}

/** Sticky bar along the bottom of the page while there are unsaved changes. */
export function UnsavedBar({ dirty, saving, onSave, onDiscard, label = 'You have unsaved changes' }: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  label?: string;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 mt-6 border-t border-border bg-card/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-3" role="region" aria-label="Unsaved changes">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />{label}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDiscard} disabled={saving}>Discard</Button>
          <Button onClick={onSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Save changes</Button>
        </div>
      </div>
    </div>
  );
}
