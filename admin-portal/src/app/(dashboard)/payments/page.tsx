'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BadgeCheck, Copy, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { PaymentReviewActions } from '@/components/shared/payment-review-actions';
import { getPendingPayments } from '@/lib/api';
import { useSocket } from '@/components/providers/SocketProvider';
import { PaymentProofLink } from '@/components/shared/payment-proof-link';
import { PAYMENT_METHOD_LABELS, deadlineLabel, formatCurrency, formatDate, timeAgo } from '@/lib/utils';
import type { PendingPayment } from '@/types';

const HOUR = 60 * 60 * 1000;

// verifyBy is set at submission; fall back to the current setting for anything without it.
const deadlineOf = (p: PendingPayment, hours: number) =>
  p.verifyBy || (p.submittedAt ? new Date(new Date(p.submittedAt).getTime() + hours * HOUR).toISOString() : null);

export default function PaymentVerificationPage() {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [hours, setHours] = useState(24);
  const [upiId, setUpiId] = useState('');
  const [methods, setMethods] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const { paymentsVersion } = useSocket();

  const load = useCallback(() => {
    setLoading(true);
    getPendingPayments()
      .then((r) => {
        setPayments(r.data.data.payments || []);
        setHours(r.data.data.verificationHours || 24);
        setUpiId(r.data.data.upiId || '');
        setMethods(r.data.data.methods || []);
      })
      .catch(() => toast({ title: 'Could not load payments', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  // Refetch when a payment arrives or another admin handles one.
  useEffect(() => { load(); }, [load, paymentsVersion]);

  // Keep the countdowns moving without refetching.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const copy = (value: string) => {
    navigator.clipboard.writeText(value).then(
      () => toast({ title: 'Reference copied' }),
      () => toast({ title: value }),
    );
  };

  const overdueCount = payments.filter((p) => { const d = deadlineOf(p, hours); return d && deadlineLabel(d).overdue; }).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Payment Verification"
        description={`UPI and bank payments customers have submitted. Match each reference (UTR) and amount against the bank statement${upiId ? ` (UPI ${upiId})` : ''}, then verify or reject. Customers were promised a decision within ${hours} hours.`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/payment-config"><Settings2 className="w-4 h-4 mr-2" />Payment Settings</Link>
            </Button>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
        }
      />

      {methods?.length === 0 && !loading && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Neither UPI nor a bank account is set up, so customers cannot pay yet. Add one in <Link href="/payment-config" className="font-semibold underline">Payment Settings</Link>.</p>
        </div>
      )}

      {overdueCount > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{overdueCount} payment{overdueCount === 1 ? ' is' : 's are'} past the verification deadline promised to the customer.</p>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="p-4"><Skeleton className="h-14 w-full" /></div>)}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState icon={BadgeCheck} title="Nothing to verify" description="Submitted payments will appear here, oldest first." />
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((p) => {
              const due = deadlineOf(p, hours);
              const deadline = due ? deadlineLabel(due) : null;
              const utr = p.utr || '';
              return (
                <li key={p._id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                    <div className="col-span-2 sm:col-span-1 min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Application</p>
                      {p.application ? (
                        <Link href={`/applications/${p.application._id}`} className="font-semibold text-foreground hover:underline font-mono">
                          {p.application.referenceId}
                        </Link>
                      ) : <p className="text-muted-foreground">Deleted</p>}
                      <p className="text-xs text-muted-foreground truncate">{p.user?.name} &middot; {p.application?.visaType?.name}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</p>
                      <p className="font-bold text-foreground tabular-nums">{formatCurrency(p.amount)}</p>
                      {p.promoCode?.code && <p className="text-xs text-muted-foreground">Promo {p.promoCode.code}</p>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{PAYMENT_METHOD_LABELS[p.method] || 'UPI'} &middot; UTR</p>
                      <button type="button" onClick={() => copy(utr)} className="flex items-center gap-1 font-mono text-sm text-foreground hover:text-primary break-all text-left" title="Copy reference">
                        {utr} <Copy className="w-3 h-3 shrink-0" />
                      </button>
                      <PaymentProofLink url={p.proofUrl} className="mt-0.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted</p>
                      <p className="text-sm text-foreground" title={p.submittedAt ? formatDate(p.submittedAt) : undefined}>
                        {p.submittedAt ? timeAgo(p.submittedAt) : 'n/a'}
                      </p>
                      {deadline && (
                        <Badge variant={deadline.overdue ? 'destructive' : deadline.urgent ? 'warning' : 'secondary'} className="mt-0.5">
                          {deadline.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <PaymentReviewActions paymentId={p._id} amount={p.amount} utr={utr} onDone={load} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
