'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { StageChangeDialog, type StageChange, type StagePayload } from '@/components/shared/stage-change-dialog';
import { getApplications, updateStatus } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { STATUS_LABELS } from '@/types';
import type { Application, ApplicationStatus } from '@/types';

const BOARD_COLUMNS: { status: ApplicationStatus; tone: string }[] = [
  { status: 'payment_completed', tone: 'text-violet-600 bg-violet-500/10 border-violet-500/20' },
  { status: 'visa_processing', tone: 'text-info bg-info/10 border-info/20' },
  { status: 'embassy_review', tone: 'text-warning bg-warning/10 border-warning/20' },
  { status: 'visa_approved', tone: 'text-success bg-success/10 border-success/20' },
  { status: 'visa_rejected', tone: 'text-destructive bg-destructive/10 border-destructive/20' },
];

export default function ProcessingBoardPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ApplicationStatus | null>(null);
  const [pending, setPending] = useState<StageChange | null>(null);

  useEffect(() => {
    Promise.all(BOARD_COLUMNS.map((c) => getApplications({ status: c.status, limit: 50 })))
      .then((results) => setApps(results.flatMap((r) => r.data.data.applications)))
      .finally(() => setLoading(false));
  }, []);

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
      setApps((prev) => prev.map((a) => (a._id === app._id ? { ...a, ...payload, updatedAt: new Date().toISOString() } : a)));
      toast({ title: `Moved to ${STATUS_LABELS[payload.status]}`, description: app.referenceId, variant: 'success' });
      setPending(null);
    } catch (err: any) {
      toast({ title: 'Could not move the application', description: err.response?.data?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Processing Board"
        description="Drag a card to another stage, or use its menu, to move an application along."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
        {BOARD_COLUMNS.map((col) => {
          const colApps = apps.filter((a) => a.status === col.status);
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
                  colApps.map((app) => (
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
                      {/* Stretched link: the whole card opens the application. */}
                      <Link
                        href={`/applications/${app._id}`}
                        draggable={false}
                        className="block text-sm font-bold text-foreground mb-1 after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:rounded-lg"
                      >
                        {app.visaType?.name}
                      </Link>
                      <p className="text-xs text-muted-foreground mb-2">{app.user?.name}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">{app.referenceId?.slice(-8)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(app.updatedAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

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
