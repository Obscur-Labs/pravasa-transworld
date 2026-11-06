'use client';
import { useRef, useState } from 'react';
import { ExternalLink, Loader2, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/components/ui/use-toast';
import { uploadVisaDownload } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DOC_FILE_TYPES } from '@/types';
import type { DocFileType, DocumentRequirement } from '@/types';

const SIZES = [1, 2, 5, 10];

/** Sample file, allowed kinds and max size for one document row. */
export function DocUploadRules({ doc, onChange }: {
  doc: DocumentRequirement;
  onChange: (patch: Partial<DocumentRequirement>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const types = doc.fileTypes || [];

  const toggleType = (t: DocFileType) =>
    onChange({ fileTypes: types.includes(t) ? types.filter((x) => x !== t) : [...types, t] });

  const uploadSample = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadVisaDownload(fd);
      onChange({ sampleUrl: res.data.data.url });
    } catch (err: any) {
      toast({ title: 'Could not upload the sample', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
      <div>
        <label className="text-xs text-muted-foreground">Sample document</label>
        <div className="mt-0.5 flex items-center gap-1.5">
          <Input className="h-8 text-xs" placeholder="Paste a link or upload a file" value={doc.sampleUrl || ''}
            onChange={(e) => onChange({ sampleUrl: e.target.value })} />
          {doc.sampleUrl && (
            <>
              <a href={doc.sampleUrl} target="_blank" rel="noopener noreferrer" aria-label="Open sample"
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button type="button" onClick={() => onChange({ sampleUrl: '' })} aria-label="Remove sample"
                className="p-1.5 rounded text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Upload sample"
            className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden"
            onChange={(e) => uploadSample(e.target.files?.[0])} />
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">File types</p>
        <div className="flex gap-1">
          {DOC_FILE_TYPES.map((t) => (
            <button key={t.value} type="button" aria-pressed={types.includes(t.value)} onClick={() => toggleType(t.value)}
              className={cn(
                'h-8 px-2 rounded-md border text-xs font-medium transition-colors',
                types.includes(t.value)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground',
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Max size</label>
        <NativeSelect value={doc.maxSizeMb ? String(doc.maxSizeMb) : ''} className="mt-0.5 h-8 px-2 text-xs"
          onChange={(e) => onChange({ maxSizeMb: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">10 MB (default)</option>
          {SIZES.filter((s) => s < 10).map((s) => <option key={s} value={s}>{s} MB</option>)}
        </NativeSelect>
      </div>
      {!types.length && (
        <p className="sm:col-span-3 text-[11px] text-muted-foreground -mt-1">No type picked: customers can upload PDF, JPG, PNG or Word.</p>
      )}
    </div>
  );
}
