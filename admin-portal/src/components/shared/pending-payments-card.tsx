'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PaymentReviewActions } from '@/components/shared/payment-review-actions';
import { useSocket } from '@/components/providers/SocketProvider';
import { getPendingPayments } from '@/lib/api';
import { PaymentProofLink } from '@/components/shared/payment-proof-link';
import { PAYMENT_METHOD_LABELS, deadlineLabel, formatCurrency } from '@/lib/utils';
import type { PendingPayment } from '@/types';

const SHOWN = 5;

/**
 * Dashboard shortcut to the verification queue: the oldest submitted payments with
 * their deadlines, verifiable in place. Hidden when nothing is waiting.
 */
export function PendingPaymentsCard() {
  const { paymentsVersion } = useSocket();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [, setTick] = useState(0);

  const load = useCallback(() => {
    getPendingPayments().then((r) => setPayments(r.data.data.payments || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load, paymentsVersion]);

  // Keep the countdowns moving without refetching.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (payments.length === 0) return null;

  return (
    <Card className="mb-6 border-warning/40">
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-warning" />
          <h2 className="font-semibold text-sm text-foreground">Payments to verify</h2>
          <Badge variant="warning">{payments.length}</Badge>
        </div>
        <Link href="/payments" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {payments.slice(0, SHOWN).map((p) => {
          const deadline = p.verifyBy ? deadlineLabel(p.verifyBy) : null;
          return (
            <li key={p._id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground tabular-nums">{formatCurrency(p.amount)}</span>
                  {p.application && (
                    <Link href={`/applications/${p.application._id}`} className="font-mono text-sm text-foreground hover:underline">
                      {p.application.referenceId}
                    </Link>
                  )}
                  {deadline && (
                    <span className={`flex items-center gap-1 text-xs font-medium ${deadline.urgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                      <Clock className="w-3 h-3" />{deadline.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {p.user?.name} &middot; {PAYMENT_METHOD_LABELS[p.method] || 'UPI'} &middot; UTR <span className="font-mono">{p.utr}</span>
                </p>
                <PaymentProofLink url={p.proofUrl} className="mt-0.5" />
              </div>
              <PaymentReviewActions paymentId={p._id} amount={p.amount} utr={p.utr} onDone={load} />
            </li>
          );
        })}
      </ul>
      {payments.length > SHOWN && (
        <Link href="/payments" className="block border-t border-border px-5 py-2.5 text-center text-xs font-semibold text-primary hover:bg-muted/50">
          {payments.length - SHOWN} more waiting
        </Link>
      )}
    </Card>
  );
}
