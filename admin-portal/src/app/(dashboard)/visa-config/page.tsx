'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { getVisaConfig, createVisaConfigOption, updateVisaConfigOption, deleteVisaConfigOption } from '@/lib/api';
import type { VisaConfigOption, VisaConfigCategory } from '@/types';

// Data-driven tab list — adding a new configurable option list later (e.g. a "process
// type") only needs one more entry here plus matching backend category, not new UI code.
const CATEGORIES: { key: VisaConfigCategory; label: string; description: string }[] = [
  { key: 'jurisdiction', label: 'Jurisdictions', description: 'Where the visa is processed — shown on the Visa Types form.' },
  { key: 'visaCategory', label: 'Visa Categories', description: 'The purpose of the visa — Tourist, Business, Student, etc.' },
  { key: 'visaSubType', label: 'Visa Sub-Types', description: 'E-Visa vs Sticker Visa, and any future sub-types.' },
  { key: 'entryType', label: 'Entry Types', description: 'Single, multiple, double entry — or any custom entry type.' },
];

export default function VisaConfigPage() {
  const [options, setOptions] = useState<VisaConfigOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<VisaConfigOption | null>(null);

  const load = () => {
    setLoading(true);
    getVisaConfig().then((r) => setOptions(r.data.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const byCategory = (cat: VisaConfigCategory) =>
    options.filter((o) => o.category === cat).sort((a, b) => a.order - b.order);

  const handleToggleActive = async (opt: VisaConfigOption) => {
    setOptions((prev) => prev.map((o) => (o._id === opt._id ? { ...o, isActive: !o.isActive } : o)));
    try {
      await updateVisaConfigOption(opt._id, { isActive: !opt.isActive });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
      load();
    }
  };

  const handleRelabel = async (opt: VisaConfigOption, newLabel: string) => {
    setOptions((prev) => prev.map((o) => (o._id === opt._id ? { ...o, label: newLabel } : o)));
    try {
      await updateVisaConfigOption(opt._id, { label: newLabel });
      toast({ title: 'Label updated', variant: 'success' });
    } catch {
      toast({ title: 'Failed to update label', variant: 'destructive' });
      load();
    }
  };

  const handleDelete = async (opt: VisaConfigOption) => {
    try {
      await deleteVisaConfigOption(opt._id);
      setOptions((prev) => prev.filter((o) => o._id !== opt._id));
      toast({ title: 'Option deleted', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Cannot delete', description: err.response?.data?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Visa Config"
        description="Manage the option lists used across Visa Types — jurisdictions, categories, sub-types, and entry types."
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : (
        <Tabs defaultValue={CATEGORIES[0].key}>
          <TabsList>
            {CATEGORIES.map((c) => <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>)}
          </TabsList>
          {CATEGORIES.map((c) => (
            <TabsContent key={c.key} value={c.key}>
              <CategoryPanel
                category={c.key}
                description={c.description}
                options={byCategory(c.key)}
                onCreated={load}
                onToggleActive={handleToggleActive}
                onRelabel={handleRelabel}
                onRequestDelete={setDeleteTarget}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this option?"
        description={
          deleteTarget
            ? `"${deleteTarget.label}" will be permanently removed. If it's used by any visa type, deletion will be blocked — deactivate it instead.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={async () => { if (deleteTarget) await handleDelete(deleteTarget); }}
      />
    </div>
  );
}

function CategoryPanel({
  category, description, options, onCreated, onToggleActive, onRelabel, onRequestDelete,
}: {
  category: VisaConfigCategory;
  description: string;
  options: VisaConfigOption[];
  onCreated: () => void;
  onToggleActive: (opt: VisaConfigOption) => void;
  onRelabel: (opt: VisaConfigOption, newLabel: string) => void;
  onRequestDelete: (opt: VisaConfigOption) => void;
}) {
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const { pageItems, paginationProps } = usePagination(options, `visa-config:${category}`);

  const handleAdd = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await createVisaConfigOption({ category, label: trimmed, order: options.length });
      setLabel('');
      onCreated();
      toast({ title: `"${trimmed}" added`, variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Failed to add option', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Bengaluru"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            />
            <Button onClick={handleAdd} disabled={saving || !label.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {options.length === 0 ? (
        <EmptyState icon={SlidersHorizontal} title="No options yet" description="Add one above to make it available on the Visa Types form." />
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {pageItems.map((opt) => (
            <OptionRow key={opt._id} option={opt} onToggleActive={onToggleActive} onRelabel={onRelabel} onRequestDelete={onRequestDelete} />
          ))}
          <Pagination {...paginationProps} />
        </div>
      )}
    </div>
  );
}

function OptionRow({
  option, onToggleActive, onRelabel, onRequestDelete,
}: {
  option: VisaConfigOption;
  onToggleActive: (opt: VisaConfigOption) => void;
  onRelabel: (opt: VisaConfigOption, newLabel: string) => void;
  onRequestDelete: (opt: VisaConfigOption) => void;
}) {
  const [value, setValue] = useState(option.label);
  useEffect(() => setValue(option.label), [option.label]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== option.label) onRelabel(option, trimmed);
    else setValue(option.label);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        className="flex-1 h-8 border-transparent bg-transparent shadow-none hover:border-input focus:border-input focus-visible:ring-1"
      />
      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap hidden sm:inline">{option.value}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Switch checked={option.isActive} onChange={() => onToggleActive(option)} />
        <span className={`text-xs font-semibold w-14 ${option.isActive ? 'text-success' : 'text-muted-foreground'}`}>
          {option.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <button
        onClick={() => onRequestDelete(option)}
        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg flex-shrink-0"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
