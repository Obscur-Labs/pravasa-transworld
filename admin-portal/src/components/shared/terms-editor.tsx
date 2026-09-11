'use client';
import { Plus, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VisaTerm } from '@/types';

export const emptyTerm = (): VisaTerm => ({ text: '', required: true, defaultChecked: false, order: 0 });

interface TermsEditorProps {
  terms: VisaTerm[];
  onChange: (terms: VisaTerm[]) => void;
}

/** Consent checkboxes the applicant sees on the Review & Pay step. */
export function TermsEditor({ terms, onChange }: TermsEditorProps) {
  const update = (i: number, patch: Partial<VisaTerm>) =>
    onChange(terms.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-foreground text-sm">Terms &amp; Conditions</h4>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
              Each term becomes a checkbox the applicant sees before paying. Mandatory terms must be
              ticked to submit; default-selected terms start pre-ticked.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...terms, emptyTerm()])}>
          <Plus className="w-3.5 h-3.5 mr-1" />Add Term
        </Button>
      </div>

      {terms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No terms yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add one and the applicant will be asked to accept it before checkout.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {terms.map((term, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <span className="w-6 pt-2 text-xs font-semibold tabular-nums text-muted-foreground flex-shrink-0 text-center">{i + 1}</span>
                <textarea
                  className="flex-1 min-h-[64px] rounded-lg border border-input bg-card text-foreground text-sm p-2.5 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  placeholder="e.g. I confirm my passport is valid for at least 6 months from the date of travel."
                  value={term.text}
                  onChange={(e) => update(i, { text: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => onChange(terms.filter((_, idx) => idx !== i))}
                  aria-label="Remove term"
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2.5 pl-8">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={term.required} onChange={(e) => update(i, { required: e.target.checked })} className="rounded" />
                  Mandatory <span className="text-muted-foreground/60">(blocks submission)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={term.defaultChecked} onChange={(e) => update(i, { defaultChecked: e.target.checked })} className="rounded" />
                  Default selected
                </label>
                <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                  term.required ? 'text-destructive bg-destructive/10' : 'text-muted-foreground bg-muted'
                }`}>
                  {term.required ? 'Mandatory' : 'Optional'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
