'use client';
import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { cn, formatDateTimeIST } from '@/lib/utils';

type Status = 'pending' | 'approved' | 'rejected';
interface Review {
  _id: string; name: string; city: string; rating: number; text: string; verified: boolean; featured: boolean;
  applicationRef: string; status: Status; rejectReason: string; createdAt: string;
  country?: { name: string } | null; visaType?: { name: string } | null;
}

const TABS: { key: Status; label: string }[] = [
  { key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' },
];

/** Approve, reject or feature customer reviews before they appear on /testimonials. */
export default function TestimonialsPage() {
  const [tab, setTab] = useState<Status>('pending');
  const [items, setItems] = useState<Review[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/testimonials', { params: { status: tab } })
      .then((r) => { setItems(r.data.data.items); setCounts(r.data.data.counts); })
      .catch(() => toast({ title: 'Could not load reviews', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const update = async (r: Review, patch: { status?: Status; featured?: boolean; rejectReason?: string }) => {
    try {
      await api.patch(`/admin/testimonials/${r._id}`, patch);
      toast({ title: patch.status ? `Review ${patch.status}` : patch.featured ? 'Featured on the home page' : 'No longer featured', variant: 'success' });
      load();
    } catch (err: any) {
      toast({ title: 'Could not update', description: err.response?.data?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px] mx-auto">
      <PageHeader title="Testimonials" description="Reviews sent from the website. Only approved ones are public; verified means the application ID matched an approved visa." />
      <div role="tablist" className="flex gap-1 bg-muted rounded-xl p-1 w-fit mb-5">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn('px-3.5 py-2 rounded-lg text-sm font-medium', tab === t.key ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {t.label} <span className="tabular-nums opacity-70">{counts[t.key] || 0}</span>
          </button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Star} title={tab === 'pending' ? 'No pending reviews' : `No ${tab} reviews`} />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Card key={r._id} className="p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    {r.name}{r.city ? `, ${r.city}` : ''}{r.verified && <BadgeCheck className="w-4 h-4 text-success" aria-label="Verified" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{[r.applicationRef, r.country?.name, r.visaType?.name, formatDateTimeIST(r.createdAt)].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="flex gap-0.5" aria-label={`${r.rating} stars`}>
                  {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('w-4 h-4', i <= r.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />)}
                </span>
              </div>
              <p className="mt-3 text-sm text-foreground/90 whitespace-pre-line">{r.text}</p>
              {r.status === 'rejected' && r.rejectReason && <p className="mt-2 text-xs text-destructive">Rejected: {r.rejectReason}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status !== 'approved' && <Button size="sm" onClick={() => update(r, { status: 'approved' })}>Approve</Button>}
                {r.status !== 'rejected' && (
                  <Button size="sm" variant="outline" onClick={() => {
                    const reason = window.prompt('Reason for rejecting (kept internal)') ?? null;
                    if (reason !== null) update(r, { status: 'rejected', rejectReason: reason });
                  }}>Reject</Button>
                )}
                {r.status === 'approved' && (
                  <Button size="sm" variant="ghost" onClick={() => update(r, { featured: !r.featured })}>{r.featured ? 'Unfeature' : 'Feature on home'}</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
