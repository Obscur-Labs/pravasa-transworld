'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Loader2, Search, Globe, FileText, ArrowUpDown, MapPin, Plane, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { CardGridSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { getCountries, createCountry, updateCountry, deleteCountry, toggleCountry, toggleCountryWebsite } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useStoredPrefs } from '@/lib/useStoredPrefs';
import type { Country } from '@/types';

interface CountryForm { name: string; flag: string; description: string; }
const emptyForm: CountryForm = { name: '', flag: '', description: '' };

const DEFAULT_PREFS = {
  view: 'grid' as 'grid' | 'list',
  sortBy: 'name-asc' as 'name-asc' | 'name-desc' | 'active-first' | 'inactive-first' | 'website-first',
  filterStatus: 'all' as 'all' | 'active' | 'inactive',
  filterWeb: 'all' as 'all' | 'shown' | 'hidden',
};

const VIEWS = [
  { value: 'grid', icon: LayoutGrid, label: 'Card view' },
  { value: 'list', icon: List, label: 'List view' },
] as const;

const iconButton = 'p-1.5 text-muted-foreground rounded-lg transition-colors flex items-center';

function CountryActions({ country, onEdit, onDelete }: { country: Country; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-1 items-center">
      <button onClick={onEdit} title="Edit basic info" className={cn(iconButton, 'hover:text-primary hover:bg-accent')}>
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <Link href={`/countries/${country._id}`} title="Open country and manage visa types" className={cn(iconButton, 'hover:text-primary hover:bg-accent')}>
        <Plane className="w-3.5 h-3.5" />
      </Link>
      <Link href={`/countries/${country._id}/content`} title="Edit website content" className={cn(iconButton, 'hover:text-violet-600 hover:bg-violet-500/10')}>
        <FileText className="w-3.5 h-3.5" />
      </Link>
      <button onClick={onDelete} title="Move to trash" className={cn(iconButton, 'hover:text-destructive hover:bg-destructive/10')}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [search, setSearch] = useState('');
  const [prefs, updatePrefs] = useStoredPrefs('admin:countries', DEFAULT_PREFS);
  const { view, sortBy, filterStatus, filterWeb } = prefs;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CountryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [togglingWeb, setTogglingWeb] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCountries = () =>
    getCountries()
      .then((r) => setCountries(r.data.data))
      .finally(() => setLoading(false));

  useEffect(() => { fetchCountries(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await updateCountry(editId, form);
        toast({ title: 'Country updated', variant: 'success' });
      } else {
        await createCountry(form);
        toast({ title: 'Country created', variant: 'success' });
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      fetchCountries();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCountry(id);
    toast({ title: 'Moved to Trash', description: 'Restore it anytime from the Trash page.' });
    fetchCountries();
  };

  const handleToggle = async (id: string) => {
    setToggling(id);
    try {
      const res = await toggleCountry(id);
      setCountries((prev) => prev.map((c) => c._id === id ? { ...c, isActive: res.data.data.isActive } : c));
      toast({ title: res.data.data.isActive ? 'Country activated' : 'Country deactivated', variant: 'success' });
    } catch {
      toast({ title: 'Failed to toggle status', variant: 'destructive' });
    } finally {
      setToggling(null);
    }
  };

  const handleToggleWeb = async (id: string) => {
    setTogglingWeb(id);
    try {
      const res = await toggleCountryWebsite(id);
      setCountries((prev) => prev.map((c) => c._id === id ? { ...c, showOnWebsite: res.data.data.showOnWebsite } : c));
      toast({ title: res.data.data.showOnWebsite ? 'Shown on website' : 'Hidden from website', variant: 'success' });
    } catch {
      toast({ title: 'Failed to toggle website visibility', variant: 'destructive' });
    } finally {
      setTogglingWeb(null);
    }
  };

  const startEdit = (c: Country) => {
    setForm({ name: c.name, flag: c.flag, description: c.description });
    setEditId(c._id);
    setShowForm(true);
  };

  const filtered = countries
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => filterStatus === 'all' ? true : filterStatus === 'active' ? c.isActive : !c.isActive)
    .filter((c) => filterWeb === 'all' ? true : filterWeb === 'shown' ? c.showOnWebsite : !c.showOnWebsite)
    .sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'active-first') return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
      if (sortBy === 'inactive-first') return (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
      if (sortBy === 'website-first') return (b.showOnWebsite ? 1 : 0) - (a.showOnWebsite ? 1 : 0);
      return 0;
    });

  const { pageItems, paginationProps } = usePagination(filtered, 'countries', `${search}|${sortBy}|${filterStatus}|${filterWeb}`);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Countries"
        description="Manage destination countries and their website pages."
        action={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 w-56"
                placeholder="Search countries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(!showForm); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Country
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-muted/50 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sort</span>
        </div>
        <Select value={sortBy} onValueChange={(v) => updatePrefs({ sortBy: v as typeof sortBy })}>
          <SelectTrigger className="w-40 h-8 text-sm bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name A–Z</SelectItem>
            <SelectItem value="name-desc">Name Z–A</SelectItem>
            <SelectItem value="active-first">Active First</SelectItem>
            <SelectItem value="inactive-first">Inactive First</SelectItem>
            <SelectItem value="website-first">On Website First</SelectItem>
          </SelectContent>
        </Select>

        <div className="w-px h-5 bg-border mx-1" />

        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
        {(['all', 'active', 'inactive'] as const).map((v) => (
          <button
            key={v}
            onClick={() => updatePrefs({ filterStatus: v })}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              filterStatus === v
                ? v === 'active' ? 'bg-success text-success-foreground' : v === 'inactive' ? 'bg-muted-foreground text-background' : 'bg-foreground text-background'
                : 'bg-card text-muted-foreground border border-border hover:border-primary/30'
            }`}
          >
            {v === 'all' ? 'All' : v === 'active' ? 'Active' : 'Inactive'}
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Website</span>
        {(['all', 'shown', 'hidden'] as const).map((v) => (
          <button
            key={v}
            onClick={() => updatePrefs({ filterWeb: v })}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              filterWeb === v
                ? v === 'shown' ? 'bg-violet-500 text-white' : v === 'hidden' ? 'bg-muted-foreground text-background' : 'bg-foreground text-background'
                : 'bg-card text-muted-foreground border border-border hover:border-primary/30'
            }`}
          >
            {v === 'all' ? 'All' : v === 'shown' ? 'On Website' : 'Hidden'}
          </button>
        ))}

        {(filterStatus !== 'all' || filterWeb !== 'all' || sortBy !== 'name-asc') && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <button
              onClick={() => updatePrefs({ sortBy: 'name-asc', filterStatus: 'all', filterWeb: 'all' })}
              className="px-3 py-1 rounded-full text-xs font-semibold text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors"
            >
              Reset
            </button>
          </>
        )}

        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {countries.length}</span>

        <div className="flex p-0.5 rounded-lg border border-border bg-card" role="group" aria-label="Layout">
          {VIEWS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => updatePrefs({ view: value })}
              aria-label={label}
              aria-pressed={view === value}
              title={label}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                view === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">{editId ? 'Edit Country' : 'Add New Country'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Country Name</Label>
                <Input className="mt-1" placeholder="e.g. Canada" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Flag Code (ISO 2-letter)</Label>
                <Input className="mt-1" placeholder="e.g. ca, us, gb" value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value.toLowerCase() })} required />
              </div>
              <div>
                <Label>Description</Label>
                <Input className="mt-1" placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="sm:col-span-3 flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        view === 'grid' ? <CardGridSkeleton count={8} /> : <Card className="overflow-hidden"><Table><TableBody><TableSkeleton rows={8} cols={4} /></TableBody></Table></Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={search ? `No countries match "${search}"` : 'No countries yet'}
          description={search ? 'Try a different search or reset your filters.' : 'Add a country to get started.'}
        />
      ) : view === 'list' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/40">
                  <TableHead>Country</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead className="w-40">Website</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((c) => (
                  <TableRow key={c._id} className={!c.isActive ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={`https://flagcdn.com/w40/${c.flag}.png`} alt="" className="w-8 h-6 object-cover rounded flex-shrink-0" />
                        <div className="min-w-0">
                          <Link href={`/countries/${c._id}`} className="font-semibold text-foreground hover:text-primary transition-colors">{c.name}</Link>
                          {c.description && <p className="text-xs text-muted-foreground truncate max-w-md">{c.description}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={c.isActive} onChange={() => handleToggle(c._id)} disabled={toggling === c._id} tone="success" />
                        <span className={`text-xs font-semibold ${c.isActive ? 'text-success' : 'text-muted-foreground'}`}>{c.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={!!c.showOnWebsite} onChange={() => handleToggleWeb(c._id)} disabled={togglingWeb === c._id} tone="violet" />
                        <span className={`text-xs font-semibold ${c.showOnWebsite ? 'text-violet-600' : 'text-muted-foreground'}`}>{c.showOnWebsite ? 'On Website' : 'Hidden'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <CountryActions country={c} onEdit={() => startEdit(c)} onDelete={() => setDeleteId(c._id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pageItems.map((c) => (
            <Card key={c._id} className={`hover:shadow-md transition-shadow ${!c.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <img src={`https://flagcdn.com/w40/${c.flag}.png`} alt={c.name} className="w-10 h-7 object-cover rounded" />
                  <CountryActions country={c} onEdit={() => startEdit(c)} onDelete={() => setDeleteId(c._id)} />
                </div>

                <Link href={`/countries/${c._id}`} className="font-semibold text-foreground hover:text-primary transition-colors">{c.name}</Link>
                {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}

                <div className="mt-4 pt-3 border-t border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        {c.isActive && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${c.isActive ? 'bg-success' : 'bg-muted-foreground/40'}`}></span>
                      </span>
                      <span className={`text-xs font-semibold ${c.isActive ? 'text-success' : 'text-muted-foreground'}`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <Switch checked={c.isActive} onChange={() => handleToggle(c._id)} disabled={toggling === c._id} tone="success" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className={`w-3 h-3 ${c.showOnWebsite ? 'text-violet-500' : 'text-muted-foreground/40'}`} />
                      <span className={`text-xs font-semibold ${c.showOnWebsite ? 'text-violet-600' : 'text-muted-foreground'}`}>
                        {c.showOnWebsite ? 'On Website' : 'Hidden'}
                      </span>
                    </div>
                    <Switch checked={!!c.showOnWebsite} onChange={() => handleToggleWeb(c._id)} disabled={togglingWeb === c._id} tone="violet" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {!loading && <Pagination {...paginationProps} className="px-0 mt-2" />}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Move this country to Trash?"
        description="You can restore it later from the Trash page."
        confirmLabel="Move to Trash"
        onConfirm={async () => { if (deleteId) await handleDelete(deleteId); }}
      />
    </div>
  );
}
