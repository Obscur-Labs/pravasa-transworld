'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, ExternalLink, PencilLine, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApplications, getDrafts, deleteDraft } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Application } from '@/types';
import { STATUS_LABELS } from '@/types';

/** Progress saved from the apply flow's "Start over", resumable at /apply?draft=<id>. */
interface ApplicationDraft {
  _id: string;
  country: { _id: string; name: string; flag: string } | null;
  visaType: { _id: string; name: string } | null;
  step: number;
  travelStartDate: string;
  adults: number;
  children: number;
  updatedAt: string;
}

const DRAFT_STEPS = ['Country', 'Visa type', 'Applicant details', 'Review & pay'];

const statusVariant = (s: string) => {
  if (s === 'visa_approved' || s === 'visa_delivered') return 'success';
  if (s === 'visa_rejected') return 'destructive';
  if (s === 'payment_pending') return 'warning';
  return 'info';
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [drafts, setDrafts] = useState<ApplicationDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    getApplications()
      .then((r) => setApplications(r.data.data))
      .finally(() => setLoading(false));
    getDrafts().then((r) => setDrafts(r.data.data || [])).catch(() => {});
  }, []);

  const removeDraft = async (id: string) => {
    if (!window.confirm('Delete this saved draft? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteDraft(id);
      setDrafts((d) => d.filter((x) => x._id !== id));
      toast({ title: 'Draft deleted' });
    } catch {
      toast({ title: 'Could not delete the draft', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Applications</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and track all your visa applications.</p>
        </div>
        <Button asChild>
          <Link href="/apply"><Plus className="w-4 h-4 mr-2" />New Application</Link>
        </Button>
      </div>

      {drafts.length > 0 && (
        <section className="mb-8" aria-labelledby="drafts-heading">
          <h2 id="drafts-heading" className="text-sm font-semibold text-slate-700 mb-3">
            Saved drafts <span className="text-slate-400 font-normal">({drafts.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {drafts.map((d) => {
              const travellers = d.adults + d.children;
              return (
                <div key={d._id} className="flex flex-col rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                  <div className="flex items-start gap-3">
                    {d.country?.flag && (
                      <img src={`https://flagcdn.com/w40/${d.country.flag}.png`} alt="" className="w-8 h-5 object-cover rounded flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm truncate">{d.visaType?.name || 'Visa not chosen yet'}</p>
                      <p className="text-xs text-slate-400">{d.country?.name || 'Country no longer available'}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">Draft</Badge>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Step {d.step} of 4: {DRAFT_STEPS[d.step - 1]}
                    {d.travelStartDate && <> &middot; travelling {formatDate(d.travelStartDate)}</>}
                    {travellers > 0 && <> &middot; {travellers} traveller{travellers === 1 ? '' : 's'}</>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Saved {formatDate(d.updatedAt)}</p>
                  <div className="mt-3 flex gap-2">
                    {d.country && (
                      <Button size="sm" asChild className="flex-1">
                        <Link href={`/apply?draft=${d._id}`}><PencilLine className="w-3.5 h-3.5 mr-1.5" />Continue</Link>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => removeDraft(d._id)} disabled={deleting === d._id}
                      aria-label="Delete draft" className="text-slate-500 hover:text-red-600 hover:border-red-200">
                      {deleting === d._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="hidden sm:grid grid-cols-6 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={`h-3 ${i === 0 ? 'col-span-2 w-24' : 'w-16'}`} />
            ))}
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-2 sm:gap-4 px-6 py-4 items-center">
                <div className="sm:col-span-2 flex items-center gap-3">
                  <Skeleton className="w-8 h-5 rounded flex-shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-700 mb-2">No submitted applications yet</h3>
          <p className="text-slate-400 text-sm mb-6">Start your visa journey today.</p>
          <Button asChild><Link href="/apply">Apply for Visa</Link></Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="hidden sm:grid grid-cols-6 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-2">Application</div>
            <div>Application No.</div>
            <div>Amount</div>
            <div>Date</div>
            <div>Status</div>
          </div>
          <div className="divide-y divide-slate-100">
            {applications.map((app) => (
              <Link
                key={app._id}
                href={`/applications/${app._id}`}
                className="grid grid-cols-1 sm:grid-cols-6 gap-2 sm:gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="sm:col-span-2 flex items-center gap-3">
                  <img src={`https://flagcdn.com/w40/${app.country?.flag}.png`} alt={app.country?.name} className="w-8 h-5 object-cover rounded flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{app.visaType?.name}</p>
                    <p className="text-xs text-slate-400">{app.country?.name}</p>
                  </div>
                </div>
                <div className="flex sm:items-center">
                  <span className="text-xs font-mono text-slate-500">{app.referenceId}</span>
                </div>
                <div className="flex sm:items-center">
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(app.paymentAmount)}</span>
                </div>
                <div className="flex sm:items-center">
                  <span className="text-sm text-slate-500">{formatDate(app.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={statusVariant(app.status) as any} className="text-xs">
                    {STATUS_LABELS[app.status]}
                  </Badge>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 ml-2 hidden sm:block" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
