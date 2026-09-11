'use client';
import { useEffect, useState } from 'react';
import { Copy, Loader2, Pencil, Plus, ScrollText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { TermsEditor, emptyTerm } from '@/components/shared/terms-editor';
import { createTermPreset, deleteTermPreset, getTermPresets, updateTermPreset } from '@/lib/api';
import type { TermPreset, VisaTerm } from '@/types';

const emptyForm = () => ({ name: '', description: '', terms: [emptyTerm()] as VisaTerm[] });
const withoutIds = (terms: VisaTerm[]) => terms.map(({ _id, ...t }) => t);

export default function TermsConfigPage() {
  const [presets, setPresets] = useState<TermPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = () =>
    getTermPresets().then((r) => setPresets(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const closeForm = () => { setShowForm(false); setEditId(null); };

  const openCreate = () => { setForm(emptyForm()); setEditId(null); setShowForm(true); };

  const openEdit = (p: TermPreset) => {
    setForm({ name: p.name, description: p.description || '', terms: p.terms.map((t) => ({ ...t })) });
    setEditId(p._id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: 'Preset name is required', variant: 'destructive' }); return; }
    if (!form.terms.some((t) => t.text.trim())) { toast({ title: 'Add at least one term', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, description: form.description, terms: withoutIds(form.terms) };
      if (editId) await updateTermPreset(editId, payload);
      else await createTermPreset(payload);
      toast({ title: editId ? 'Preset updated' : 'Preset created', variant: 'success' });
      closeForm();
      load();
    } catch (err: any) {
      toast({ title: 'Could not save preset', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const duplicatePreset = async (p: TermPreset) => {
    try {
      await createTermPreset({ name: `${p.name} (Copy)`, description: p.description, terms: withoutIds(p.terms) });
      toast({ title: `Duplicated "${p.name}"`, variant: 'success' });
      load();
    } catch (err: any) {
      toast({ title: 'Could not duplicate preset', description: err.response?.data?.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTermPreset(id);
    toast({ title: 'Moved to Trash' });
    load();
  };

  const { pageItems, paginationProps } = usePagination(presets, 'terms-presets');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Terms Presets"
        description="Save sets of terms once and add them to any visa type from its Terms tab."
        action={
          <Button onClick={() => (showForm ? closeForm() : openCreate())}>
            <Plus className="w-4 h-4 mr-2" /> New Preset
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-primary" />
              {editId ? 'Edit Preset' : 'Create Preset'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preset-name">Preset name</Label>
                  <Input id="preset-name" className="mt-1" placeholder="e.g. Standard tourist terms" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="preset-description">Description</Label>
                  <Input id="preset-description" className="mt-1" placeholder="Where these terms are used" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>

              <TermsEditor terms={form.terms} onChange={(terms) => setForm((f) => ({ ...f, terms }))} />

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? 'Update Preset' : 'Create Preset'}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></CardContent></Card>
          ))}
        </div>
      ) : presets.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No terms presets yet"
          description="Create a set of terms here, or save one straight from a visa type's Terms tab."
          action={<Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> New Preset</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageItems.map((p) => {
            const mandatory = p.terms.filter((t) => t.required).length;
            return (
              <Card key={p._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg" aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => duplicatePreset(p)} className="p-1.5 text-muted-foreground hover:text-violet-600 hover:bg-violet-500/10 rounded-lg" aria-label="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteId(p._id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <ol className="mt-3 space-y-1 text-xs text-muted-foreground list-decimal pl-4 flex-1">
                    {p.terms.slice(0, 3).map((t, i) => <li key={i} className="line-clamp-1">{t.text}</li>)}
                    {p.terms.length > 3 && <li className="list-none -ml-4 text-muted-foreground/70">+{p.terms.length - 3} more</li>}
                  </ol>
                  <div className="flex gap-3 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                    <span>{p.terms.length} term{p.terms.length === 1 ? '' : 's'}</span>
                    <span>{mandatory} mandatory</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {!loading && <Pagination {...paginationProps} className="px-0 mt-2" />}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Move this preset to Trash?"
        description="Visa types that already use these terms keep them. You can restore the preset from the Trash page."
        confirmLabel="Move to Trash"
        onConfirm={async () => { if (deleteId) await handleDelete(deleteId); }}
      />
    </div>
  );
}
