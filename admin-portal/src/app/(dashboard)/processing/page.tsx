'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, MoreHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { StageChangeDialog, type StageChange, type StagePayload } from '@/components/shared/stage-change-dialog';
import { bulkAssignApplications, getApplicationAssignees, getApplications, updateEmbassyReference, updateStatus } from '@/lib/api';
import { cn, formatDateTimeIST } from '@/lib/utils';
import { STATUS_LABELS } from '@/types';
import type { Application, ApplicationStatus } from '@/types';

const BOARD_COLUMNS: { status: ApplicationStatus; tone: string }[] = [
  { status: 'payment_completed', tone: 'text-info bg-info/10 border-info/20' },
  { status: 'documents_under_review', tone: 'text-primary bg-primary/10 border-primary/20' },
  { status: 'visa_processing', tone: 'text-info bg-info/10 border-info/20' },
  { status: 'embassy_review', tone: 'text-warning bg-warning/10 border-warning/20' },
  { status: 'visa_approved', tone: 'text-success bg-success/10 border-success/20' },
  { status: 'visa_rejected', tone: 'text-destructive bg-destructive/10 border-destructive/20' },
];

const DAY = 86400000;
// How long a card has sat in its stage: grey under 3 days, amber 3 to 5, red 6 and up.
function age(updatedAt: string) {
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / DAY);
  const tone = days >= 6 ? 'bg-destructive/10 text-destructive' : days >= 3 ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground';
  return { label: days < 1 ? 'today' : `${days}d`, tone };
}

const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function ProcessingBoardPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ApplicationStatus | null>(null);
  const [pending, setPending] = useState<StageChange | null>(null);
  const [assignees, setAssignees] = useState<{ _id: string; name: string }[]>([]);
  const [filters, setFilters] = useState({ country: '', assignee: '' });
  const [open, setOpen] = useState<Application | null>(null);
  const [embassyRef, setEmbassyRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [groupFamilies, setGroupFamilies] = useState(false);

  useEffect(() => {
    Promise.all(BOARD_COLUMNS.map((c) => getApplications({ status: c.status, limit: 50 })))
      .then((results) => setApps(results.flatMap((r) => r.data.data.applications)))
      .finally(() => setLoading(false));
    getApplicationAssignees().then((r) => setAssignees(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => { setEmbassyRef(open?.processingReferenceNumber || ''); }, [open?._id]);

  const countries = [...new Map(apps.filter((a) => a.country).map((a) => [a.country._id, a.country.name])).entries()];
  const shown = apps.filter((a) =>
    (!filters.country || a.country?._id === filters.country)
    && (!filters.assignee || (filters.assignee === 'none' ? !a.assignedTo : a.assignedTo?._id === filters.assignee)));

  const patchApp = (id: string, patch: Partial<Application>) => {
    setApps((prev) => prev.map((a) => (a._id === id ? { ...a, ...patch } : a)));
    setOpen((o) => (o && o._id === id ? { ...o, ...patch } : o));
  };

  const assign = async (app: Application, assignee: string) => {
    setBusy(true);
    try {
      await bulkAssignApplications([app._id], assignee || null);
      const who = assignees.find((m) => m._id === assignee);
      patchApp(app._id, { assignedTo: who ? { _id: who._id, name: who.name } : null });
      toast({ title: who ? `Assigned to ${who.name}` : 'Unassigned', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Could not assign', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const saveRef = async (app: Application) => {
    setBusy(true);
    try {
      await updateEmbassyReference(app._id, embassyRef);
      patchApp(app._id, { processingReferenceNumber: embassyRef });
      toast({ title: 'Embassy reference saved', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const dragged = apps.find((a) => a._id === dragId);

  const endDrag = () => {
    setDragId(null);
    setOverStatus(null);
  };

  const handleDrop = (status: ApplicationStatus) => {
    if (dragged && dragged.status !== status) setPending({ app: dragged, to: status });
    endDrag();
  };

  const handleConfirm = async (payload: StagePayload) => {
    if (!pending) return;
    const { app } = pending;
    try {
      await updateStatus(app._id, payload);
      patchApp(app._id, { ...payload, updatedAt: new Date().toISOString() });
      toast({ title: `Moved to ${STATUS_LABELS[payload.status]}`, description: app.referenceId, variant: 'success' });
      setPending(null);
    } catch (err: any) {
      toast({ title: 'Could not move the application', description: err.response?.data?.message, variant: 'destructive' });
    }
  };

  const renderCard = (app: Application) => (
    <div
      key={app._id}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', app._id); e.dataTransfer.effectAllowed = 'move'; setDragId(app._id); }}
      onDragEnd={endDrag}
      className={cn(
        'relative p-3 bg-muted/50 rounded-lg border border-border cursor-grab active:cursor-grabbing hover:border-primary/30 hover:bg-accent transition-all',
        dragId === app._id && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <img src={`https://flagcdn.com/w20/${app.country?.flag}.png`} alt="" className="w-5 h-3 object-cover rounded" />
        <span className="text-xs font-semibold text-foreground/90 truncate">{app.country?.name}</span>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            aria-label={`Move ${app.referenceId}`}
            className="relative z-10 ml-auto -mr-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">Move to</DropdownMenuLabel>
            {BOARD_COLUMNS.filter((c) => c.status !== app.status).map((c) => (
              <DropdownMenuItem key={c.status} onSelect={() => setPending({ app, to: c.status })} className="cursor-pointer">
                {STATUS_LABELS[c.status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Stretched button: the whole card opens the quick-actions drawer. */}
      <button
        type="button"
        onClick={() => setOpen(app)}
        className="block w-full text-left text-sm font-bold text-foreground mb-1 after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:rounded-lg"
      >
        {app.visaType?.name}
      </button>
      <p className="text-xs text-muted-foreground mb-2">{app.user?.name}{(app.travellers?.length ?? 0) > 1 ? ` · family of ${app.travellers!.length}` : ''}</p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{app.referenceId}</span>
        <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${age(app.updatedAt).tone}`} title={`In this stage since ${formatDateTimeIST(app.updatedAt)}`}>
          {age(app.updatedAt).label}
        </span>
        {app.assignedTo ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary" title={app.assignedTo.name}>
            {initials(app.assignedTo.name)}
          </span>
        ) : <span className="h-6 w-6 rounded-full border border-dashed border-border" title="Unassigned" />}
      </div>
    </div>
  );

  // With grouping on, orders that share a family (parent plus linked child orders) sit together.
  const groupByFamily = (list: Application[]) => {
    if (!groupFamilies) return list.map((a) => [a]);
    const groups = new Map<string, Application[]>();
    for (const a of list) {
      const key = a.familyId || a._id;
      groups.set(key, [...(groups.get(key) || []), a]);
    }
    return [...groups.values()];
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Processing Board"
        description="Drag a card to another stage, or use its menu, to move an application along. Click a card for quick actions. The badge shows days in the stage."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <NativeSelect className="h-9 w-auto text-sm" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} aria-label="Country">
          <option value="">All countries</option>
          {countries.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </NativeSelect>
        <NativeSelect className="h-9 w-auto text-sm" value={filters.assignee} onChange={(e) => setFilters({ ...filters, assignee: e.target.value })} aria-label="Assignee">
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {assignees.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer ml-1">
          <input type="checkbox" checked={groupFamilies} onChange={(e) => setGroupFamilies(e.target.checked)} className="rounded" />
          Group families
        </label>
                {(filters.country || filters.assignee) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ country: '', assignee: '' })}><X className="w-3.5 h-3.5 mr-1" />Clear</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
        {BOARD_COLUMNS.map((col) => {
          const colApps = shown.filter((a) => a.status === col.status);
          const canDrop = !!dragged && dragged.status !== col.status;
          return (
            <section
              key={col.status}
              onDragOver={(e) => { if (canDrop) { e.preventDefault(); setOverStatus(col.status); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStatus(null); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(col.status); }}
              className={cn(
                'bg-card rounded-xl border overflow-hidden transition-all',
                overStatus === col.status ? 'border-primary ring-2 ring-primary/30' : 'border-border',
              )}
            >
              <div className={`px-4 py-3 border-b flex items-center justify-between ${col.tone}`}>
                <h3 className="text-sm font-bold">{STATUS_LABELS[col.status]}</h3>
                {!loading && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${col.tone}`}>{colApps.length}</span>
                )}
              </div>
              <div className="p-3 space-y-3 min-h-[200px]">
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
                ) : colApps.length === 0 ? (
                  <p className={cn(
                    'text-xs text-center py-8 rounded-lg border border-dashed',
                    canDrop ? 'border-primary/40 text-primary' : 'border-transparent text-muted-foreground',
                  )}>
                    {canDrop ? 'Drop here' : 'No applications'}
                  </p>
                ) : (
                  groupByFamily(colApps).map((group) => group.length > 1 ? (
                    <div key={group[0].familyId} className="rounded-xl border-2 border-dashed border-gold-500/60 bg-gold-500/5 p-2 space-y-2">
                      <p className="px-1 text-[11px] font-bold text-gold-700 dark:text-gold-400">{group[0].familyId} · family of {group.length} applications</p>
                      {group.map(renderCard)}
                    </div>
                  ) : renderCard(group[0]))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {open && (
            <div className="space-y-5">
              <div>
                <SheetTitle className="font-mono">{open.referenceId}</SheetTitle>
                <p className="text-sm text-muted-foreground mt-1">{open.user?.name} · {open.country?.name} · {open.visaType?.name}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="drawer-stage">Stage</label>
                <NativeSelect id="drawer-stage" value={open.status}
                  onChange={(e) => { const to = e.target.value as ApplicationStatus; if (to !== open.status) setPending({ app: open, to }); }}>
                  {!BOARD_COLUMNS.some((c) => c.status === open.status) && <option value={open.status}>{STATUS_LABELS[open.status]}</option>}
                  {BOARD_COLUMNS.map((c) => <option key={c.status} value={c.status}>{STATUS_LABELS[c.status]}</option>)}
                </NativeSelect>
                {(() => {
                  const i = BOARD_COLUMNS.findIndex((c) => c.status === open.status);
                  const next = i >= 0 && i < BOARD_COLUMNS.length - 2 ? BOARD_COLUMNS[i + 1] : null;
                  return next ? (
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => setPending({ app: open, to: next.status })}>
                      Move to {STATUS_LABELS[next.status]}
                    </Button>
                  ) : null;
                })()}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="drawer-assignee">Assignee</label>
                <NativeSelect id="drawer-assignee" value={open.assignedTo?._id || ''} disabled={busy} onChange={(e) => assign(open, e.target.value)}>
                  <option value="">Unassigned</option>
                  {assignees.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="drawer-ref">Embassy / VFS reference</label>
                <div className="flex gap-2">
                  <Input id="drawer-ref" value={embassyRef} onChange={(e) => setEmbassyRef(e.target.value)} placeholder="e.g. FRAM/AMD/2026/10457" />
                  <Button variant="outline" onClick={() => saveRef(open)} disabled={busy || embassyRef === (open.processingReferenceNumber || '')}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">In this stage since {formatDateTimeIST(open.updatedAt)}</p>
              <Button asChild className="w-full">
                <Link href={`/applications/${open._id}`}><ExternalLink className="w-4 h-4 mr-2" />Open full application</Link>
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {pending && (
        <StageChangeDialog
          key={`${pending.app._id}:${pending.to}`}
          change={pending}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
