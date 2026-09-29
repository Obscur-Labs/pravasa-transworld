'use client';
import { useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { approvePayment, rejectPayment } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

// The usual reasons a UPI submission can't be matched, one click away.
const QUICK_REASONS = [
  'No matching credit found in the bank statement',
  'Amount received does not match the amount due',
  'UTR number is incorrect',
  'Payment was made to a different account',
];

interface Props {
  paymentId: string;
  amount: number;
  utr?: string;
  onDone: () => void;
  size?: 'sm' | 'default';
}

/** Approve / reject buttons for one submitted UPI payment. */
export function PaymentReviewActions({ paymentId, amount, utr, onDone, size = 'sm' }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = async () => {
    try {
      await approvePayment(paymentId);
      toast({ title: 'Payment verified', description: 'The customer was notified and processing can start.', variant: 'success' });
      onDone();
    } catch (err: any) {
      toast({ title: 'Could not verify', description: err.response?.data?.message, variant: 'destructive' });
      onDone();
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    setRejecting(true);
    try {
      await rejectPayment(paymentId, reason.trim());
      toast({ title: 'Payment rejected', description: 'The customer was told why and can pay again.' });
      setRejectOpen(false);
      setReason('');
      onDone();
    } catch (err: any) {
      toast({ title: 'Could not reject', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size={size} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setConfirmOpen(true)}>
          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Verify
        </Button>
        <Button size={size} variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRejectOpen(true)}>
          <XCircle className="w-4 h-4 mr-1.5" /> Reject
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        variant="default"
        title={`Verify ${formatCurrency(amount)}?`}
        description={`Only confirm once you have found this credit${utr ? ` (UTR ${utr})` : ''} in the bank statement for the exact amount. The application moves to Payment Completed and the customer is notified.`}
        confirmLabel="Yes, payment received"
        onConfirm={handleApprove}
      />

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this payment</DialogTitle>
            <DialogDescription>The customer sees this reason and can submit the payment again.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${reason === r ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border text-muted-foreground hover:border-destructive/40 hover:text-foreground'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason shown to the customer"
            aria-label="Rejection reason"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!reason.trim() || rejecting}>
              {rejecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
