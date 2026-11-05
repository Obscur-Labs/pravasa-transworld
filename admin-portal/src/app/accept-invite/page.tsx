'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptAdminInvite, getAdminInvite } from '@/lib/api';

/** Where an emailed team invite lands: the new member sets their own password. */
function AcceptInvite() {
  const token = useSearchParams().get('token') || '';
  const [invite, setInvite] = useState<{ name: string; username: string } | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setError('This invite link is incomplete.'); return; }
    getAdminInvite(token)
      .then((r) => setInvite(r.data.data))
      .catch((err) => setError(err.response?.data?.message || 'This invite link is not valid.'));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('The two passwords do not match'); return; }
    setSaving(true);
    setError('');
    try {
      await acceptAdminInvite({ token, password });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not set the password.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'mt-1 bg-brand-950 border-brand-700 text-white placeholder:text-brand-300/70';

  return (
    <div className="min-h-screen bg-brand-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo-light.png" alt="Pravasa Transworld" className="h-11 w-auto mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white">Join the admin team</h1>
          {invite && <p className="text-brand-200 text-sm mt-1">Welcome, {invite.name}. Your username is <b className="text-white">{invite.username}</b>.</p>}
        </div>

        <div className="bg-brand-900 rounded-2xl p-6 border border-brand-800 space-y-4">
          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-brand-100 text-sm">Your password is set. Sign in with your username to continue.</p>
              <Button asChild className="w-full" size="lg"><Link href="/login">Go to sign in</Link></Button>
            </div>
          ) : !invite ? (
            error
              ? <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
              : <p className="text-brand-200 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Checking your invite...</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-brand-100 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />New password</Label>
                <Input id="password" type="password" autoComplete="new-password" className={fieldClass} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
                <p className="text-[11px] text-brand-300 mt-1">At least 8 characters, with a letter and a number.</p>
              </div>
              <div>
                <Label htmlFor="confirm" className="text-brand-100">Confirm password</Label>
                <Input id="confirm" type="password" autoComplete="new-password" className={fieldClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
              <Button type="submit" className="w-full" size="lg" disabled={saving || !password || !confirm}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return <Suspense fallback={null}><AcceptInvite /></Suspense>;
}
