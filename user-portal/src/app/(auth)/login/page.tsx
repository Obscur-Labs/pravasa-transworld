'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { sendLoginOTP, verifyOTP } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

function OtpBoxes({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focus = (i: number) => refs.current[i]?.focus();

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < OTP_LENGTH - 1) focus(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[i]) {
        const next = [...value];
        next[i] = '';
        onChange(next);
      } else if (i > 0) {
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focus(i - 1);
    } else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) {
      focus(i + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    const next = [...value];
    digits.forEach((d, i) => { next[i] = d; });
    onChange(next);
    const lastFilled = Math.min(digits.length, OTP_LENGTH - 1);
    focus(lastFilled);
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="w-11 h-13 text-center text-xl font-bold rounded-xl border-2 border-slate-200 bg-slate-50 focus:border-brand-500 focus:bg-white focus:outline-none transition-all"
          style={{ height: '3.25rem' }}
        />
      ))}
    </div>
  );
}

function useResendTimer() {
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setSeconds(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }, []);

  return { seconds, start };
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<'form' | 'otp'>('form');

  useEffect(() => {
    if (localStorage.getItem('token')) {
      router.replace('/dashboard');
    } else {
      setChecking(false);
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [form, setForm] = useState({ email: '' });
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const { seconds, start: startTimer } = useResendTimer();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendLoginOTP({ email: form.email });
      setStep('otp');
      startTimer();
      toast({ title: 'OTP Sent', description: 'Check your email for the 6-digit code.', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to send OTP', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendLoginOTP({ email: form.email });
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      startTimer();
      toast({ title: 'OTP Resent', description: 'A new code has been sent to your email.', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to resend OTP', variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length !== OTP_LENGTH) return;
    setLoading(true);
    try {
      const res = await verifyOTP({ email: form.email, otp });
      const { token, user } = res.data.data;
      login(user, token);
      toast({ title: 'Welcome back!', description: `Logged in as ${user.name}`, variant: 'success' });
      router.push('/dashboard');
    } catch (err: any) {
      toast({ title: 'Invalid OTP', description: err.response?.data?.message || 'Please check the code and try again.', variant: 'destructive' });
      setOtpDigits(Array(OTP_LENGTH).fill(''));
    } finally {
      setLoading(false);
    }
  };

  const otpFilled = otpDigits.join('').length === OTP_LENGTH;

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center gap-3 mb-8">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* The wordmark carries the name, so no text label repeats it. */}
          <Link href="/" className="inline-flex mb-6" aria-label="Pravasa Transworld home">
            <img
              src="/logo.png"
              alt="Pravasa Transworld"
              width={1841}
              height={516}
              className="h-10 w-auto"
            />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            {step === 'form' ? 'Welcome back' : 'Check your email'}
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            {step === 'form'
              ? 'Enter your email to receive a login code.'
              : `We sent a 6-digit code to ${form.email}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {step === 'form' ? (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  className="mt-1"
                  placeholder="you@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP'}
              </Button>
              <p className="text-center text-sm text-slate-500">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-brand-600 font-semibold hover:underline">
                  Register here
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <OtpBoxes value={otpDigits} onChange={setOtpDigits} />

              <Button type="submit" className="w-full" size="lg" disabled={loading || !otpFilled}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Sign In'}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtpDigits(Array(OTP_LENGTH).fill('')); }}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Change details
                </button>
                {seconds > 0 ? (
                  <span className="text-slate-400">Resend in {seconds}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="text-brand-600 font-semibold hover:underline disabled:opacity-50"
                  >
                    {resending ? 'Resending…' : 'Resend OTP'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
