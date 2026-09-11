'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, LayoutTemplate, FileText, FileStack, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { ApplicationFormBuilder } from '@/components/shared/application-form-builder';
import { getFormPresets, createFormPreset, updateFormPreset, deleteFormPreset } from '@/lib/api';
import { orderedFormArrays } from '@/types';
import type { FormField, DocumentRequirement, FormPreset } from '@/types';

const emptyField = (): FormField => ({ label: '', fieldName: '', type: 'text', required: false, options: [], placeholder: '', order: 0, applicantType: 'adult' });
const emptyDocReq = (): DocumentRequirement => ({ name: '', description: '', required: true, applicantType: 'adult', docType: 'custom', ocrEnabled: false, order: 0 });

const emptyForm = () => ({
  name: '', description: '',
  formFields: [] as FormField[],
  documentRequirements: [] as DocumentRequirement[],
});

export default function FormConfigPage() {
  const [presets, setPresets] = useState<FormPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getFormPresets().then((r) => setPresets(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setForm(emptyForm()); setEditId(null); setShowForm(true); };
  const openEdit = (p: FormPreset) => {
    setForm({
      name: p.name,
      description: p.description || '',
      formFields: (p.formFields || []).map((f) => ({ ...f, options: [...(f.options || [])] })),
      documentRequirements: (p.documentRequirements || []).map((d) => ({ ...d })),
    });
    setEditId(p._id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: 'Preset name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        ...orderedFormArrays(form.formFields, form.documentRequirements),
      };
      if (editId) {
        await updateFormPreset(editId, payload);
        toast({ title: 'Preset updated', variant: 'success' });
      } else {
        await createFormPreset(payload);
        toast({ title: 'Preset created', variant: 'success' });
      }
      setShowForm(false);
      setEditId(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteFormPreset(id);
    toast({ title: 'Moved to Trash' });
    load();
  };

  const duplicatePreset = async (p: FormPreset) => {
    try {
      await createFormPreset({
        name: `${p.name} (Copy)`,
        description: p.description,
        ...orderedFormArrays(p.formFields || [], p.documentRequirements || []),
      });
      toast({ title: `Duplicated "${p.name}"`, variant: 'success' });
      load();
    } catch (err: any) {
      toast({ title: 'Failed to duplicate preset', description: err.response?.data?.message, variant: 'destructive' });
    }
  };

  const { pageItems, paginationProps } = usePagination(presets, 'form-presets');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Form Presets"
        description="Build reusable form layouts (fields + documents) and apply them to any visa type in one click."
        action={
          <Button onClick={() => (showForm ? (setShowForm(false), setEditId(null)) : openCreate())}>
            <Plus className="w-4 h-4 mr-2" /> New Preset
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-primary" />
              {editId ? 'Edit Preset' : 'Create Preset'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Preset Name</Label>
                  <Input className="mt-1" placeholder="e.g. Tourist – Standard Layout" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input className="mt-1" placeholder="Short note about this layout" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>

              <ApplicationFormBuilder
                fields={form.formFields}
                docs={form.documentRequirements}
                onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              />

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? 'Update Preset' : 'Create Preset'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Preset list */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></CardContent></Card>
          ))}
        </div>
      ) : presets.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No form presets yet" description="Create a layout to reuse across visa types." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageItems.map((p) => (
            <Card key={p._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => duplicatePreset(p)} className="p-1.5 text-muted-foreground hover:text-violet-600 hover:bg-violet-500/10 rounded-lg" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteId(p._id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex gap-3 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground" /> {p.formFields?.length || 0} field{(p.formFields?.length || 0) !== 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1.5"><FileStack className="w-3.5 h-3.5 text-muted-foreground" /> {p.documentRequirements?.length || 0} doc{(p.documentRequirements?.length || 0) !== 1 ? 's' : ''}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {!loading && <Pagination {...paginationProps} className="px-0 mt-2" />}

      <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1.5">
        <LayoutTemplate className="w-3.5 h-3.5" />
        Apply these presets from the Visa Types form using the "Form Presets" panel.
      </p>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Move this preset to Trash?"
        description="You can restore it later from the Trash page."
        confirmLabel="Move to Trash"
        onConfirm={async () => { if (deleteId) await handleDelete(deleteId); }}
      />
    </div>
  );
}
