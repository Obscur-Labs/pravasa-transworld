'use client';
import { useState } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DOC_FILE_TYPES, hasOptions } from '@/types';
import type { ApplicantType, FormItem } from '@/types';

const appliesTo = (type: ApplicantType | undefined, who: 'adult' | 'child') =>
  (type || 'adult') === 'both' || (type || 'adult') === who;

/** Read-only walk through the form as an adult or a child traveller would see it. */
export function FormPreviewDialog({ open, onOpenChange, items }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: FormItem[];
}) {
  const [who, setWho] = useState<'adult' | 'child'>('adult');
  const visible = items.filter((it) => appliesTo(it.kind === 'field' ? it.field.applicantType : it.doc.applicantType, who));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview as customer</DialogTitle>
          <DialogDescription>What one traveller fills in, in order. Follow-ups and conditional uploads appear after the matching answer.</DialogDescription>
        </DialogHeader>
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/50 w-fit">
          {(['adult', 'child'] as const).map((w) => (
            <button key={w} type="button" onClick={() => setWho(w)} aria-pressed={who === w}
              className={cn('px-3 py-1 rounded-md text-xs font-semibold capitalize', who === w ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
              {w}
            </button>
          ))}
        </div>
        <div className="space-y-3 mt-1">
          {visible.length === 0 && <p className="text-sm text-muted-foreground">Nothing is asked of this traveller type.</p>}
          {visible.map((it, i) => it.kind === 'field' ? (
            <div key={i}>
              <label className="text-sm font-medium text-foreground">
                {it.field.label || 'Untitled question'}{it.field.required && <span className="text-destructive"> *</span>}
              </label>
              {hasOptions(it.field.type) ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(it.field.options.length ? it.field.options : ['No options yet']).map((o) => (
                    <span key={o} className="px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground">{o}</span>
                  ))}
                </div>
              ) : (
                <Input disabled className="mt-1 h-9 text-sm" placeholder={it.field.placeholder || it.field.type} />
              )}
              {it.field.subFields?.length ? (
                <p className="mt-1 text-[11px] text-muted-foreground">+ {it.field.subFields.length} follow-up question{it.field.subFields.length > 1 ? 's' : ''}</p>
              ) : null}
            </div>
          ) : (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-dashed border-border">
              <Paperclip className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {it.doc.name || 'Untitled document'}{it.doc.required && <span className="text-destructive"> *</span>}
                </p>
                {it.doc.description && <p className="text-xs text-muted-foreground">{it.doc.description}</p>}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {(it.doc.fileTypes?.length
                    ? DOC_FILE_TYPES.filter((t) => it.doc.fileTypes!.includes(t.value)).map((t) => t.label).join(', ')
                    : 'PDF, JPG, PNG, Word')} up to {it.doc.maxSizeMb || 10} MB
                  {it.doc.showWhen ? ' · only for certain answers' : ''}
                </p>
              </div>
              {it.doc.sampleUrl && (
                <a href={it.doc.sampleUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0">
                  <FileText className="w-3.5 h-3.5" />View sample
                </a>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
