'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Tag, ToggleLeft, ToggleRight, Globe, GlobeLock, Trash2,
  Pencil, History, Check, Loader2, AlertCircle, Percent, DollarSign,
  Users, TrendingUp, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  getPromoCodes, createPromoCode, updatePromoCode, deletePromoCode,
  togglePromoActive, togglePromoWebsite, getPromoHistory,
} from '@/lib/api';
import type { PromoCode, PromoHistory } from '@/types';

const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage (%)', icon: Percent },
  { value: 'fixed', label: 'Fixed Amount (₹)', icon: DollarSign },
];

const empty = (): Partial<PromoCode> => ({
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: 10,
  isActive: true,
  showOnWebsite: false,
  expiresAt: undefined,
  usageLimit: undefined,
});

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-success' : 'bg-muted-foreground/50'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function DiscountBadge({ type, value }: { type: string; value: number }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-bold px-2.5 py-0.5 rounded-full ${type === 'percentage' ? 'bg-violet-500/10 text-violet-600' : 'bg-primary/10 text-primary'}`}>
      {type === 'percentage' ? <Percent className="w-3 h-3" /> : <span>₹</span>}
      {value}{type === 'percentage' ? ' off' : ' off'}
    </span>
  );
}

export default function PromoCodesPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PromoCode | null>(null);
  const [form, setForm] = useState<Partial<PromoCode>>(empty());
  const [saving, setSaving] = useState(false);
  const [codeError, setCodeError] = useState('');

  // History drawer
  const [historyPromo, setHistoryPromo] = useState<PromoCode | null>(null);
  const [history, setHistory] = useState<PromoHistory | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getPromoCodes()
      .then((r) => setPromos(r.data.data || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(empty());
    setCodeError('');
    setModalOpen(true);
  };

  const openEdit = (p: PromoCode) => {
    setEditTarget(p);
    setForm({
      code: p.code,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      isActive: p.isActive,
      showOnWebsite: p.showOnWebsite,
      expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : undefined,
      usageLimit: p.usageLimit,
    });
    setCodeError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    const code = (form.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) { setCodeError('Code must contain letters or numbers.'); return; }
    if (!form.discountValue || form.discountValue <= 0) return;
    setSaving(true);
    try {
      const payload = { ...form, code, expiresAt: form.expiresAt || null, usageLimit: form.usageLimit || null };
      if (editTarget) {
        await updatePromoCode(editTarget._id, payload);
      } else {
        await createPromoCode(payload);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setCodeError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: PromoCode) => {
    setPromos((prev) => prev.map((x) => x._id === p._id ? { ...x, isActive: !x.isActive } : x));
    try { await togglePromoActive(p._id); } catch { load(); }
  };

  const handleToggleWebsite = async (p: PromoCode) => {
    // Turning one promo's website visibility on turns every other one off server-side,
    // so a single-row optimistic patch isn't enough, reload the whole list instead.
    try {
      await togglePromoWebsite(p._id);
      load();
    } catch { load(); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deletePromoCode(deleteTarget._id);
    setDeleteTarget(null);
    load();
  };

  const openHistory = async (p: PromoCode) => {
    setHistoryPromo(p);
    setHistory(null);
    setHistLoading(true);
    try {
      const r = await getPromoHistory(p._id);
      setHistory(r.data.data);
    } finally {
      setHistLoading(false);
    }
  };

  const filtered = promos.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.code.toLowerCase().includes(s) || p.description.toLowerCase().includes(s);
  });

  const totalUsage = promos.reduce((acc, p) => acc + p.usageCount, 0);
  const { pageItems, paginationProps } = usePagination(filtered, 'promo-codes', search);
  const activeCount = promos.filter((p) => p.isActive).length;
  const websiteCount = promos.filter((p) => p.showOnWebsite).length;

  const stats = [
    { label: 'Total Codes', value: promos.length, icon: Tag, tone: 'text-primary bg-primary/10' },
    { label: 'Active', value: activeCount, icon: ToggleRight, tone: 'text-success bg-success/10' },
    { label: 'On Website', value: websiteCount, icon: Globe, tone: 'text-violet-600 bg-violet-500/10' },
    { label: 'Total Uses', value: totalUsage, icon: TrendingUp, tone: 'text-warning bg-warning/10' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Promo Codes"
        description={`${promos.length} codes total`}
        action={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> New Promo Code
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatTile key={i} loading label="" value="" icon={Tag} tone="" />)
          : stats.map((s) => <StatTile key={s.label} {...s} />)}
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code or description…"
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/40">
              {['Code', 'Description', 'Discount', 'Status', 'Website', 'Expiry', 'Uses', 'Actions'].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="p-0">
                <EmptyState icon={Tag} title={search ? 'No matching promo codes' : 'No promo codes yet'} description={search ? 'Try a different search.' : 'Create your first promo code to get started.'} />
              </TableCell></TableRow>
            ) : pageItems.map((p) => (
              <TableRow key={p._id}>
                <TableCell>
                  <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded-lg tracking-widest text-xs">{p.code}</span>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[180px] truncate">{p.description || <span className="text-muted-foreground/50 italic">No description</span>}</TableCell>
                <TableCell>
                  <DiscountBadge type={p.discountType} value={p.discountValue} />
                </TableCell>
                <TableCell><StatusBadge active={p.isActive} /></TableCell>
                <TableCell>
                  {p.showOnWebsite
                    ? <span className="text-xs font-semibold text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Globe className="w-3 h-3" />Visible</span>
                    : <span className="text-xs text-muted-foreground">Hidden</span>}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : <span className="text-muted-foreground/50">Never</span>}
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-foreground">{p.usageCount}</span>
                  {p.usageLimit && <span className="text-muted-foreground text-xs"> / {p.usageLimit}</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleToggle(p)} title={p.isActive ? 'Deactivate' : 'Activate'}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      {p.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleToggleWebsite(p)} title={p.showOnWebsite ? 'Hide from website' : 'Show on website'}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      {p.showOnWebsite ? <Globe className="w-4 h-4 text-violet-600" /> : <GlobeLock className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(p)} title="Edit"
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openHistory(p)} title="Usage history"
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-colors">
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(p)} title="Delete"
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive/70 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination {...paginationProps} className="border-t border-border" />
      </div>

      {/* ── Create / Edit Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle>{editTarget ? 'Edit Promo Code' : 'New Promo Code'}</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            {/* Code */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Promo Code *</label>
              <input
                value={form.code || ''}
                onChange={(e) => { setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }); setCodeError(''); }}
                placeholder="e.g. SAVE20 or 2024PROMO"
                className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-sm font-mono font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {codeError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{codeError}</p>}
              <p className="text-xs text-muted-foreground mt-1">Only letters and numbers. Auto-uppercased.</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</label>
              <input
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. 20% off on all visa applications"
                className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Discount type + value */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Discount Type *</label>
                <div className="flex rounded-xl border border-input overflow-hidden">
                  {DISCOUNT_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm({ ...form, discountType: value as any })}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${form.discountType === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      <Icon className="w-3.5 h-3.5" />{value === 'percentage' ? '%' : '₹'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Value {form.discountType === 'percentage' ? '(%)' : '(₹)'} *
                </label>
                <input
                  type="number"
                  min={1}
                  max={form.discountType === 'percentage' ? 100 : undefined}
                  value={form.discountValue || ''}
                  onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Expiry + Usage limit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={form.expiresAt || ''}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value || undefined })}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Usage Limit</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={form.usageLimit || ''}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-3">
              {([
                { key: 'isActive' as const, label: 'Active', desc: 'Users can apply this code', tone: 'success' as const },
                { key: 'showOnWebsite' as const, label: 'Show on Website', desc: 'Popup on homepage after 5s', tone: 'violet' as const },
              ]).map(({ key, label, desc, tone }) => (
                <div key={key} className="flex-1 flex items-center gap-3 p-3 rounded-xl border border-border">
                  <Switch checked={!!form[key]} onChange={() => setForm({ ...form, [key]: !form[key] })} tone={tone} />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.code || !form.discountValue}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {saving ? 'Saving…' : editTarget ? 'Update Code' : 'Create Code'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── History Drawer ── */}
      <Sheet open={!!historyPromo} onOpenChange={(open) => !open && setHistoryPromo(null)}>
        <SheetContent side="right" className="w-full max-w-md p-0 flex flex-col">
          <div className="px-5 py-4 border-b border-border">
            <SheetTitle>Usage History</SheetTitle>
            {historyPromo && <p className="text-xs text-muted-foreground mt-0.5 font-mono font-semibold tracking-wider">{historyPromo.code}</p>}
          </div>

          {histLoading ? (
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-3 gap-0 border-b border-border">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex flex-col items-center gap-1.5 border-r border-border last:border-r-0">
                    <Skeleton className="h-6 w-10" />
                    <Skeleton className="h-2.5 w-14" />
                  </div>
                ))}
              </div>
              <div className="divide-y divide-border">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center gap-2.5">
                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : history ? (
            <div className="flex-1 overflow-y-auto">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-0 border-b border-border">
                {[
                  { label: 'Total Uses', value: history.usageCount },
                  { label: 'Limit', value: history.usageLimit ?? '∞' },
                  { label: 'Remaining', value: history.usageLimit ? Math.max(0, history.usageLimit - history.usageCount) : '∞' },
                ].map(({ label, value }) => (
                  <div key={label} className="px-5 py-3 text-center border-r border-border last:border-r-0">
                    <p className="text-xl font-bold text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {history.usedBy.length === 0 ? (
                <EmptyState icon={Users} title="No uses yet" description="Usage will appear here once customers apply this code." />
              ) : (
                <div className="divide-y divide-border">
                  {history.usedBy.map((entry, i) => (
                    <div key={i} className="px-5 py-3.5 hover:bg-muted/40 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary text-xs font-bold">{entry.userName?.[0]?.toUpperCase() || '?'}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{entry.userName}</p>
                            <p className="text-xs text-muted-foreground truncate">{entry.userEmail}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-success">-₹{entry.discountApplied}</p>
                          <p className="text-xs text-muted-foreground">{new Date(entry.usedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      {entry.applicationRef && (
                        <div className="mt-1.5 ml-10.5">
                          <span className="text-[10px] font-mono text-muted-foreground">App: {entry.applicationRef}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Promo Code?"
        description={deleteTarget ? `"${deleteTarget.code}" will be removed. This cannot be undone.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
