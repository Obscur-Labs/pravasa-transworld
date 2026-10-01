'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserRound, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { adminLogin } from '@/lib/api';
import { useAdminAuthStore } from '@/store/auth.store';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuthStore();

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (localStorage.getItem('adminToken')) {
      router.replace('/dashboard');
    } else {
      setChecking(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await adminLogin({ username: username.trim(), password });
      const { token, admin } = r.data.data;
      login(admin, token);
      toast({ title: 'Welcome back!', description: `Signed in as ${admin.name}`, variant: 'success' });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not sign in. Please try again.');
      setPassword('');
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

  const fieldClass = 'mt-1 bg-brand-950 border-brand-700 text-white placeholder:text-brand-300/70';

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

        <form onSubmit={handleSubmit} className="bg-brand-900 rounded-2xl p-6 border border-brand-800 space-y-4">
          <div>
            <Label htmlFor="username" className="text-brand-100 flex items-center gap-1.5">
              <UserRound className="w-3.5 h-3.5" /> Username
            </Label>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className={fieldClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-brand-100 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={`${fieldClass} pr-10`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 p-1.5 rounded-md text-brand-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading || !username.trim() || !password}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-xs text-brand-300 mt-4">
          Forgot your password? Ask your super admin to reset it.
        </p>
      </div>
    </div>
  );
}
