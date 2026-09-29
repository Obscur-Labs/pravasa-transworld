'use client';
import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface OptionListEditorProps {
  options: string[];
  onChange: (opts: string[]) => void;
}

// Shared by the Visa Types and Form Presets pages, both let an admin build a
// select/radio field's option list the same way.
export function OptionListEditor({ options, onChange }: OptionListEditorProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const val = draft.trim();
    if (!val || options.includes(val)) return;
    onChange([...options, val]);
    setDraft('');
    inputRef.current?.focus();
  };
  const remove = (idx: number) => onChange(options.filter((_, i) => i !== idx));
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };

  return (
    <div className="mt-2 space-y-2">
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
              {opt}
              <button type="button" onClick={() => remove(idx)} className="text-primary/60 hover:text-primary ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <Input ref={inputRef} className="h-7 text-xs flex-1" placeholder="Add option…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={handleKey} />
        <button type="button" onClick={add} disabled={!draft.trim()}
          className="h-7 px-2 rounded-lg border border-input bg-card text-muted-foreground hover:bg-accent hover:border-primary/30 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
