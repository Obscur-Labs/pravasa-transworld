'use client';
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { QRCodeSVG } from 'qrcode.react';
import {
  X, Copy, Check, Smartphone, Loader2, ArrowLeft, ArrowRight, ShieldCheck, Clock, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { startUpiPayment, submitUpiPayment } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface UpiSession {
  paymentId: string;
  referenceId: string;
  amount: number;
  originalAmount: number;
  discountApplied: number;
  upi: { upiId: string; payeeName: string; link: string };
  terms: string[];
  verificationHours: number;
}

interface Props {
  applicationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoCode?: string;
  /** Called once the payment is submitted (or turns out to be already submitted). */
  onSubmitted: () => void;
}

// Many UPI apps cap a day's payments at this amount.
const COMMON_UPI_LIMIT = 100000;
const UTR_RE = /^\d{12}$/;

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Could not copy', description: value });
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-800 font-mono break-all">{value}</p>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0 flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function UpiPaymentDialog({ applicationId, open, onOpenChange, promoCode, onSubmitted }: Props) {
  const [session, setSession] = useState<UpiSession | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<'pay' | 'confirm' | 'done'>('pay');
  const [utr, setUtr] = useState('');
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSession(null);
    setLoadError('');
    setStep('pay');
    setUtr('');
    setTicked({});
    startUpiPayment(applicationId, promoCode)
      .then((r) => setSession(r.data.data))
      .catch((err) => {
        if (err.response?.status === 409) onSubmitted();
        setLoadError(err.response?.data?.message || 'Could not start the payment. Please try again.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, applicationId, promoCode]);

  const cleanUtr = utr.replace(/\s+/g, '');
  const allTicked = !!session && session.terms.every((_, i) => ticked[i]);
  const canSubmit = UTR_RE.test(cleanUtr) && allTicked && !submitting;

  const handleSubmit = async () => {
    if (!session || !canSubmit) return;
    setSubmitting(true);
    try {
      await submitUpiPayment(applicationId, { paymentId: session.paymentId, utr: cleanUtr, acceptedTerms: session.terms });
      setStep('done');
      onSubmitted();
    } catch (err: any) {
      toast({ title: 'Could not submit', description: err.response?.data?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white shadow-2xl focus:outline-none"
          onInteractOutside={(e) => { if (step !== 'done') e.preventDefault(); }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-brand-950 via-brand-800 to-brand-700 px-5 py-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-white">Pay by UPI</Dialog.Title>
              <Dialog.Description className="text-xs text-brand-200 mt-0.5">
                {session ? `Application ${session.referenceId}` : 'Preparing your payment'}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="px-5 py-5">
            {loadError ? (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                <p className="text-sm text-slate-700">{loadError}</p>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            ) : !session ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-40 mx-auto" />
                <Skeleton className="h-48 w-48 mx-auto rounded-xl" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : step === 'pay' ? (
              <div>
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Amount to pay</p>
                  {session.discountApplied > 0 && (
                    <p className="text-xs text-slate-400 line-through">{formatCurrency(session.originalAmount)}</p>
                  )}
                  <p className="text-3xl font-bold text-brand-900 tabular-nums">{formatCurrency(session.amount)}</p>
                </div>

                <div className="mx-auto mt-4 w-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <QRCodeSVG value={session.upi.link} size={184} level="M" title={`UPI QR code to pay ${formatCurrency(session.amount)}`} />
                </div>
                <p className="mt-2 text-center text-xs text-slate-500">Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)</p>

                <a
                  href={session.upi.link}
                  className="mt-3 flex md:hidden items-center justify-center gap-2 rounded-xl border-2 border-brand-200 bg-brand-50 py-2.5 text-sm font-semibold text-brand-800 active:bg-brand-100"
                >
                  <Smartphone className="w-4 h-4" /> Open UPI app
                </a>

                <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
                  <div className="py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pay to</p>
                    <p className="text-sm font-semibold text-slate-800">{session.upi.payeeName}</p>
                  </div>
                  <CopyRow label="UPI ID" value={session.upi.upiId} />
                  <CopyRow label="Payment note" value={session.referenceId} hint="Add this as the note if your app asks for one." />
                </div>

                {session.amount > COMMON_UPI_LIMIT && (
                  <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <p>Many UPI apps limit payments to {formatCurrency(COMMON_UPI_LIMIT)} a day. If yours does, please contact our team for bank transfer details.</p>
                  </div>
                )}

                <Button className="mt-5 w-full" size="lg" onClick={() => setStep('confirm')}>
                  I&apos;ve completed the payment <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="mt-2 text-center text-[11px] text-slate-400">Pay the exact amount shown. Do not close this window until you submit.</p>
              </div>
            ) : step === 'confirm' ? (
              <div>
                <label htmlFor="upi-utr" className="text-sm font-semibold text-slate-800">UPI transaction reference (UTR)</label>
                <input
                  id="upi-utr"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={14}
                  value={utr}
                  onChange={(e) => setUtr(e.target.value.replace(/[^\d\s]/g, ''))}
                  placeholder="12-digit number"
                  aria-describedby="upi-utr-help"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-base tracking-widest text-slate-900 placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <p id="upi-utr-help" className="mt-1.5 text-xs text-slate-500">
                  Find it in your UPI app under the payment&apos;s details, usually labelled &quot;UPI Ref No.&quot; or &quot;UTR&quot;.
                </p>
                {cleanUtr.length > 0 && !UTR_RE.test(cleanUtr) && (
                  <p className="mt-1 text-xs text-red-600">The reference should be exactly 12 digits.</p>
                )}

                <fieldset className="mt-5 rounded-xl border border-slate-200 p-3.5">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Please confirm</legend>
                  <div className="space-y-2.5">
                    {session.terms.map((term, i) => (
                      <label key={i} className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={!!ticked[i]}
                          onChange={(e) => setTicked((prev) => ({ ...prev, [i]: e.target.checked }))}
                          className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm text-slate-700 group-hover:text-slate-900">{term}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <Button className="mt-5 w-full" size="lg" onClick={handleSubmit} disabled={!canSubmit}>
                  {submitting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                    : <><ShieldCheck className="w-4 h-4 mr-2" />Submit for verification</>}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('pay')}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to payment details
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center py-2">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </span>
                <h3 className="mt-3 text-lg font-bold text-slate-900">Payment submitted</h3>
                <p className="mt-1 text-sm text-slate-600">
                  We will verify your payment of {formatCurrency(session.amount)} within {session.verificationHours} hours.
                </p>
                <div className="mt-4 flex w-full items-start gap-2 rounded-xl bg-brand-50 p-3 text-left text-xs text-brand-800">
                  <Clock className="w-4 h-4 shrink-0" />
                  <p>Visa processing starts once the payment is verified. You will get an email and a notification either way.</p>
                </div>
                <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>Done</Button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
