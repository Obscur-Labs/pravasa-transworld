'use client';
import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { saveReplyTemplates } from '@/lib/api';
import type { ReplyTemplate } from '@/types';

/** Edit the shared reply templates. {name} is replaced with the customer's first name. */
export function TemplatesDialog({ open, onOpenChange, templates, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ReplyTemplate[];
  onSaved: (templates: ReplyTemplate[]) => void;
}) {
  const [rows, setRows] = useState<ReplyTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setRows(templates.map(({ title, body }) => ({ title, body }))); }, [open, templates]);

  const set = (i: number, patch: Partial<ReplyTemplate>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const save = async () => {
    setSaving(true);
    try {
      const r = await saveReplyTemplates(rows.filter((t) => t.title.trim() && t.body.trim()));
      onSaved(r.data.data);
      toast({ title: 'Templates saved', variant: 'success' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Could not save templates', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reply templates</DialogTitle>
          <DialogDescription>Shared by the whole team. Write {'{name}'} where the customer&apos;s first name should go.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((t, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex gap-2">
                <Input value={t.title} maxLength={60} placeholder="Title, e.g. Schengen checklist" onChange={(e) => set(i, { title: e.target.value })} />
                <Button variant="ghost" size="icon" aria-label={`Remove ${t.title || 'template'}`} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <Textarea rows={3} value={t.body} maxLength={2000} placeholder="Namaste {name}, ..." onChange={(e) => set(i, { body: e.target.value })} />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, { title: '', body: '' }])}>
            <Plus className="w-4 h-4 mr-1" />Add template
          </Button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Save templates</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
