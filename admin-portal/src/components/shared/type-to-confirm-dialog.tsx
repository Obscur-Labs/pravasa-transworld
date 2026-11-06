'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

/** For actions that can't be undone: the member types an exact phrase before the button unlocks. */
export function TypeToConfirmDialog({ open, onOpenChange, title, description, phrase, confirmLabel, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  phrase: string;
  confirmLabel: string;
  onConfirm: (typed: string) => Promise<void>;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setTyped(''); }, [open]);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(typed.trim());
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="text-sm text-muted-foreground">
          Type <span className="font-mono font-semibold text-foreground break-all">{phrase}</span> to confirm
          <Input className="mt-1.5 font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus aria-label="Confirmation text" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={confirm} disabled={busy || typed.trim() !== phrase.trim()}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
