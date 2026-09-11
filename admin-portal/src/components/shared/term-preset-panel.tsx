'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Save, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { createTermPreset, getTermPresets } from '@/lib/api';
import type { TermPreset, VisaTerm } from '@/types';

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Adds a saved set of terms to the visa being edited, or saves the current ones as a set. */
export function TermPresetPanel({ terms, onChange }: { terms: VisaTerm[]; onChange: (terms: VisaTerm[]) => void }) {
  const [presets, setPresets] = useState<TermPreset[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => getTermPresets().then((r) => setPresets(r.data.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const applyPreset = () => {
    const preset = presets.find((p) => p._id === selectedId);
    if (!preset) return;
    const fresh = preset.terms
      .filter((t) => !terms.some((existing) => sameText(existing.text, t.text)))
      .map(({ _id, ...t }) => t);
    onChange([...terms.filter((t) => t.text.trim()), ...fresh]);
    const skipped = preset.terms.length - fresh.length;
    toast({
      title: `Added ${fresh.length} term${fresh.length === 1 ? '' : 's'} from "${preset.name}"`,
      description: skipped > 0 ? `${skipped} already on this visa were skipped.` : undefined,
      variant: 'success',
    });
    setSelectedId('');
  };

  const saveAsPreset = async () => {
    const name = newName.trim();
    const filled = terms.filter((t) => t.text.trim());
    if (!name) { toast({ title: 'Enter a preset name', variant: 'destructive' }); return; }
    if (filled.length === 0) { toast({ title: 'Add at least one term first', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await createTermPreset({ name, terms: filled.map(({ _id, ...t }) => t) });
      toast({ title: `Preset "${name}" saved`, variant: 'success' });
      setNewName('');
      load();
    } catch (err: any) {
      toast({ title: 'Could not save preset', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-violet-600" />
        <p className="text-sm font-semibold text-violet-600">Terms Presets</p>
        <Link href="/terms-config" target="_blank" className="ml-auto text-xs font-medium text-violet-600 hover:underline">
          Manage presets
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 h-9 px-3 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{presets.length ? 'Select a preset to add' : 'No presets yet'}</option>
          {presets.map((p) => (
            <option key={p._id} value={p._id}>{p.name} ({p.terms.length} term{p.terms.length === 1 ? '' : 's'})</option>
          ))}
        </select>
        <Button type="button" variant="outline" disabled={!selectedId} onClick={applyPreset}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add terms
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input className="h-9 flex-1" placeholder="New preset name (saves the terms below)" value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveAsPreset(); } }} />
        <Button type="button" variant="outline" disabled={saving} onClick={saveAsPreset}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1" /> Save as preset</>}
        </Button>
      </div>
    </div>
  );
}
