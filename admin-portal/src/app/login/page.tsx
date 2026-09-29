'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Mail, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { sendAdminOtp, verifyAdminOtp } from '@/lib/api';
import { useAdminAuthStore } from '@/store/auth.store';

type Step = 'credentials' | 'otp';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuthStore();

  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>('credentials');

  useEffect(() => {
    if (localStorage.getItem('adminToken')) {
      router.replace('/dashboard');
    } else {
      setChecking(false);
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendAdminOtp({ email: email.trim() });
      toast({ title: 'Check your inbox', description: `If ${email} is an admin account, a 6-digit code is on its way.`, variant: 'success' });
      setStep('otp');
    } catch (err: any) {
      toast({
        title: 'Failed to send OTP',
        description: err.response?.data?.message || 'Check your email address.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await verifyAdminOtp({ email: email.trim(), otp: otp.trim() });
      const { token, admin } = r.data.data;
      login(admin, token);
      toast({ title: 'Welcome back!', description: `Logged in as ${admin.name}`, variant: 'success' });
      router.push('/dashboard');
    } catch (err: any) {
      toast({
        title: 'Verification failed',
        description: err.response?.data?.message || 'Invalid or expired OTP.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // This screen sets its own dark palette rather than the theme tokens, so the
  // skeletons override the default surface colour to match.
  if (checking) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 mb-8">
            <Skeleton className="w-14 h-14 rounded-2xl bg-brand-900" />
            <Skeleton className="h-7 w-40 bg-brand-900" />
            <Skeleton className="h-4 w-64 bg-brand-900" />
          </div>
          <div className="bg-brand-900 rounded-2xl p-6 border border-brand-800 space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-20 bg-brand-800" />
                <Skeleton className="h-10 w-full rounded-lg bg-brand-800" />
              </div>
            ))}
            <Skeleton className="h-10 w-full rounded-lg bg-brand-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* The light wordmark, since this screen sits on a dark ground. */}
          <img
            src="/logo-light.png"
            alt="Pravasa Transworld"
            className="h-11 w-auto mx-auto mb-6"
          />
          <h1 className="text-2xl font-bold text-white">Admin Login</h1>
          <p className="text-brand-200 text-sm mt-1">Administration Console</p>
        </div>

        <div className="bg-brand-900 rounded-2xl p-6 border border-brand-800">
          {step === 'credentials' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-brand-100 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="mt-1 bg-brand-950 border-brand-700 text-white placeholder:text-brand-300/70"
                  placeholder="admin@pravasatransworld.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-10 h-10 bg-brand-600/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-5 h-5 text-brand-400" />
                </div>
                <p className="text-brand-100 text-sm">
                  Enter the 6-digit OTP sent to
                </p>
                <p className="text-white font-medium text-sm truncate">{email}</p>
              </div>

              <div>
                <Label htmlFor="otp" className="text-brand-100">One-time password</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className="mt-1 bg-brand-950 border-brand-700 text-white placeholder:text-brand-300/70 text-center text-xl tracking-[0.4em] font-mono"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading || otp.length < 6}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Sign In'}
              </Button>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setOtp(''); }}
                className="flex items-center gap-1 text-sm text-brand-200 hover:text-white transition-colors mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-brand-300 mt-4">
          Passwordless login: OTP delivered to registered admin email
        </p>
      </div>
    </div>
  );
}
