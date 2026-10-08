'use client';
import { useState } from 'react';
import { Loader2, Sparkles, Undo2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { generateAiContent } from '@/lib/api';
import { cn } from '@/lib/utils';

export type AiPurpose =
  | 'country.description' | 'country.overview' | 'country.requirements'
  | 'country.processingInfo' | 'country.tips' | 'country.faqAnswer'
  | 'visaType.additionalNotes';

interface Props {
  purpose: AiPurpose;
  value: string;
  onChange: (text: string) => void;
  /** Called at click time, so the AI sees what is on the form right now. */
  getContext: () => Record<string, unknown>;
  /** Lets the server add the country's live visa types to the context. */
  countryId?: string;
  className?: string;
}

/**
 * The AI button that sits inside a field's corner. Writes the field from the rest of the
 * form, or rewrites what is already there; Undo restores the previous text.
 */
export function AiGenerateButton({ purpose, value, onChange, getContext, countryId, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);
  const rewrite = !!value.trim();
  const label = rewrite ? 'Rewrite with AI' : 'Write with AI';

  const generate = async () => {
    setLoading(true);
    try {
      const r = await generateAiContent({ purpose, context: getContext(), currentText: value, countryId });
      setPrevious(value);
      onChange(r.data.data.text);
    } catch (err: any) {
      toast({ title: 'AI could not write this', description: err.response?.data?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const undo = () => {
    if (previous === null) return;
    onChange(previous);
    setPrevious(null);
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {previous !== null && !loading && (
        <button
          type="button"
          onClick={undo}
          className="flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Undo2 className="w-3 h-3" /> Undo
        </button>
      )}
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        title={label}
        aria-label={label}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary shadow-sm transition-colors hover:bg-primary/20 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
