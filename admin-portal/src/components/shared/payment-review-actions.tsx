'use client';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Scale, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { approvePayment, flagPaymentMismatch, rejectPayment } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

// The usual reasons a UPI submission can't be matched, one click away.
const QUICK_REASONS = [
  'No matching credit found in the bank statement',
  'Amount received does not match the amount due',
  'UTR number is incorrect',
  'Payment was made to a different account',
];

const todayIst = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

interface Props {
  paymentId: string;
  amount: number;
  utr?: string;
  receivedAmount?: number | null;
  onDone: () => void;
  size?: 'sm' | 'default';
}

/**
 * Verify / reject one submitted payment. Verifying asks what reached the bank and when;
 * a short credit can't be verified and goes to the Mismatch tab instead.
 */
export function PaymentReviewActions({ paymentId, amount, utr, receivedAmount, onDone, size = 'sm' }: Props) {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [received, setReceived] = useState(String(receivedAmount ?? amount));
  const [creditDate, setCreditDate] = useState(todayIst());
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const receivedNum = Number(received);
  const valid = received.trim() !== '' && Number.isFinite(receivedNum) && receivedNum >= 0;
  const short = valid && receivedNum < amount;

  const run = async (fn: () => Promise<unknown>, ok: string, close: () => void) => {
    setBusy(true);
    try {
      await fn();
      toast({ title: ok, variant: 'success' });
      close();
      onDone();
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.response?.data?.message, variant: 'destructive' });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const verify = () => run(
    () => approvePayment(paymentId, undefined, { receivedAmount: receivedNum, bankCreditDate: creditDate }),
    'Payment verified. The customer was notified and documents review can start.',
    () => setVerifyOpen(false),
  );
  const mismatch = () => run(
    () => flagPaymentMismatch(paymentId, { receivedAmount: receivedNum, bankCreditDate: creditDate, note: `Received ${formatCurrency(receivedNum)} of ${formatCurrency(amount)}` }),
    'Moved to Mismatch',
    () => setVerifyOpen(false),
  );
  const reject = () => run(
    () => rejectPayment(paymentId, reason.trim()),
    'Payment rejected. The customer was told why and can pay again.',
    () => { setRejectOpen(false); setReason(''); },
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size={size} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setVerifyOpen(true)}>
          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Verify
        </Button>
        <Button size={size} variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRejectOpen(true)}>
          <XCircle className="w-4 h-4 mr-1.5" /> Reject
        </Button>
      </div>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify {formatCurrency(amount)}</DialogTitle>
            <DialogDescription>
              Find this credit{utr ? ` (UTR ${utr})` : ''} in the bank statement and enter what actually arrived.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`recv-${paymentId}`}>Amount received (₹)</Label>
              <Input id={`recv-${paymentId}`} className="mt-1" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`date-${paymentId}`}>Bank credit date</Label>
              <Input id={`date-${paymentId}`} className="mt-1" type="date" value={creditDate} max={todayIst()} onChange={(e) => setCreditDate(e.target.value)} />
            </div>
          </div>
          {short && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-sm text-warning">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {formatCurrency(amount - receivedNum)} short. Move it to Mismatch to follow up, or reject it so the customer pays again.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>Cancel</Button>
            {short ? (
              <Button variant="outline" onClick={mismatch} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Scale className="w-4 h-4 mr-1.5" />Move to Mismatch</>}
              </Button>
            ) : (
              <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={verify} disabled={busy || !valid || !creditDate}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, payment received'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the customer" aria-label="Rejection reason" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={!reason.trim() || busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
