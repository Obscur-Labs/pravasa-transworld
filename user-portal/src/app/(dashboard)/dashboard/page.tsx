'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Clock, CheckCircle, XCircle, Plus, ArrowRight, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboard } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/components/providers/SocketProvider';
import { PIPELINE_STAGES, STATUS_LABELS, stageIndexOf } from '@/types';
import type { Application } from '@/types';

interface LatestUpdate { title: string; message: string; at: string }

const when = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const isDone = (s: Application['status']) => s === 'visa_approved' || s === 'visa_delivered';

// Payment only counts once verified; orders from before the history existed fall back to their stage.
function isPaid(app: Application) {
  const idx = stageIndexOf(app.status);
  const history = app.statusHistory || [];
  return history.length ? history.some((h) => h.status === 'payment_completed') || idx >= 3 : idx >= 2;
}

/** When the order first reached each pipeline stage; Submitted falls back to the order date. */
function stageTimes(app: Application) {
  return PIPELINE_STAGES.map((stage, i) => {
    const hit = (app.statusHistory || []).find((h) => stage.statuses.includes(h.status));
    return hit?.at || (i === 0 ? app.createdAt : '');
  });
}

function Tracker({ app, update }: { app: Application; update?: LatestUpdate }) {
  const current = stageIndexOf(app.status);
  const paid = isPaid(app);
  const times = stageTimes(app);
  const rejected = app.status === 'visa_rejected';

  return (
    <Card className="mb-8">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
          <h2 className="font-bold text-slate-900 text-lg">
            Tracking · {app.referenceId} · {app.country?.name} {app.visaType?.name}
          </h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${rejected ? 'bg-red-50 text-red-600' : isDone(app.status) ? 'bg-green-50 text-green-700' : 'bg-gold-50 text-gold-700'}`}>
            {STATUS_LABELS[app.status]}
          </span>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-6 gap-4 sm:gap-2">
          {PIPELINE_STAGES.map((stage, i) => {
            const done = i === 1 ? paid : current > i || (i === current && isDone(app.status));
            const active = !done && i === current;
            const failed = rejected && i === current;
            return (
              <li key={stage.label} className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                  failed ? 'border-red-500 bg-red-500 text-white'
                    : done ? 'border-green-600 bg-green-600 text-white'
                    : active ? 'border-gold-600 bg-gold-600 text-white'
                    : 'border-slate-200 bg-white'}`}>
                  {failed ? <XCircle className="w-4 h-4" /> : done ? <Check className="w-4 h-4" /> : active ? <Clock className="w-4 h-4" /> : null}
                </span>
                <span>
                  <span className={`block text-sm font-semibold ${done || active ? 'text-slate-900' : 'text-slate-400'}`}>
                    {failed ? 'Rejected' : stage.label}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {times[i] && (done || active) ? when(times[i]) : active ? 'In progress' : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        {(update || rejected) && (
          <div className="mt-6 rounded-xl bg-slate-50 p-4" aria-live="polite">
            <p className="text-sm font-semibold text-slate-900">Latest update{update ? ` · ${when(update.at)}` : ''}</p>
            <p className="text-sm text-slate-600 mt-0.5">{update ? update.message : app.rejectionReason || 'Please contact support for more information.'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const [stats, setStats] = useState({ active: 0, pending: 0, approved: 0, rejected: 0, total: 0 });
  const [recent, setRecent] = useState<Application[]>([]);
  const [updates, setUpdates] = useState<Record<string, LatestUpdate>>({});
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => getDashboard()
    .then((res) => {
      const d = res.data.data;
      setStats(d.stats);
      setRecent(d.recent);
      setUpdates(d.latestUpdate || {});
    })
    .finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  // Every status change reaches the customer as a notification, so one refetch keeps the tracker live.
  useEffect(() => {
    if (!socket) return;
    socket.on('notification', load);
    return () => { socket.off('notification', load); };
  }, [socket, load]);

  const tracked = recent.find((a) => a._id === trackedId)
    || recent.find((a) => !isDone(a.status) && a.status !== 'visa_rejected')
    || recent[0];

  const statCards = [
    { label: 'Active Applications', value: stats.active, icon: FileText, color: 'text-brand-600', bg: 'bg-brand-50' },
    { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="page-container">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Namaste, {user?.name?.split(' ')[0]}</h1>
          <p className="text-slate-500 text-sm mt-1">Here are your applications.</p>
        </div>
        <Button asChild>
          <Link href="/apply"><Plus className="w-4 h-4 mr-2" />New Application</Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : recent.length === 0 ? (
        <Card className="mb-8">
          <CardContent className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">No applications yet</p>
            <p className="text-slate-400 text-xs mt-1">Start by applying for your first visa.</p>
            <Button className="mt-4" asChild><Link href="/apply">Apply Now</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {recent.map((app) => {
              const idx = stageIndexOf(app.status);
              const pct = isDone(app.status) || app.status === 'visa_rejected' ? 100 : Math.round(((idx + 1) / PIPELINE_STAGES.length) * 100);
              const selected = tracked?._id === app._id;
              return (
                <Card key={app._id} className={selected ? 'ring-2 ring-brand-400' : ''}>
                  <CardContent className="p-5">
                    <p className="text-xs text-slate-400">{app.referenceId}</p>
                    <p className="font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                      <img src={`https://flagcdn.com/w40/${app.country?.flag}.png`} alt="" className="w-6 h-4 object-cover rounded-sm" />
                      <span className="truncate">{app.country?.name} · {app.visaType?.name}</span>
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${app.status === 'visa_rejected' ? 'bg-red-500' : isDone(app.status) ? 'bg-green-600' : 'bg-gold-600'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${app.status === 'visa_rejected' ? 'text-red-600' : isDone(app.status) ? 'text-green-700' : 'text-gold-700'}`}>
                        {STATUS_LABELS[app.status]}
                      </span>
                      {isDone(app.status) ? (
                        <Button size="sm" variant="outline" asChild><Link href={`/applications/${app._id}`}>View visa</Link></Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setTrackedId(app._id)} aria-pressed={selected}>Track</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {tracked && <Tracker app={tracked} update={updates[tracked._id]} />}
          <div className="text-right -mt-4 mb-8">
            <Link href="/applications" className="text-sm text-brand-600 hover:underline inline-flex items-center gap-1">
              All applications <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                {loading ? <Skeleton className="h-8 w-10" /> : <p className="text-2xl font-bold text-slate-900">{s.value}</p>}
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
