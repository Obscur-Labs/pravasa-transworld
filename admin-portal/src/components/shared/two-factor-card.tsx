'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { disableTwoFactor, enableTwoFactor, regenerateRecoveryCodes, startTwoFactorSetup } from '@/lib/api';
import { useAdminAuthStore } from '@/store/auth.store';
import type { AdminProfile } from '@/types';

const errorOf = (err: any) => err?.response?.data?.message || 'Please try again.';

/**
 * Turn on authenticator-app codes for your own sign-in: scan the QR (or type the key),
 * confirm with a first code, then keep the one-time recovery codes somewhere safe.
 */
export function TwoFactorCard({ profile, onChange }: { profile: AdminProfile; onChange: (p: AdminProfile) => void }) {
  const updateAdmin = useAdminAuthStore((s) => s.updateAdmin);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'idle' | 'disable' | 'regenerate'>('idle');

  const start = async () => {
    setBusy(true);
    try {
      setSetup((await startTwoFactorSetup()).data.data);
      setCode('');
    } catch (err) {
      toast({ title: 'Could not start', description: errorOf(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await enableTwoFactor(code);
      setCodes(r.data.data.recoveryCodes);
      setSetup(null);
      setCode('');
      onChange(r.data.data.profile);
      updateAdmin({ twoFactorEnabled: true, twoFactorRequired: false });
      toast({ title: 'Two-factor sign-in is on', variant: 'success' });
    } catch (err) {
      toast({ title: 'Not turned on', description: errorOf(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const withCode = async () => {
    setBusy(true);
    try {
      if (mode === 'disable') {
        const r = await disableTwoFactor(code);
        onChange(r.data.data.profile);
        updateAdmin({ twoFactorEnabled: false });
        toast({ title: 'Two-factor sign-in is off' });
      } else {
        setCodes((await regenerateRecoveryCodes(code)).data.data.recoveryCodes);
        toast({ title: 'New recovery codes created', variant: 'success' });
      }
      setMode('idle');
      setCode('');
    } catch (err) {
      toast({ title: 'Could not save', description: errorOf(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = () => {
    navigator.clipboard.writeText((codes || []).join('\n')).then(() => toast({ title: 'Recovery codes copied' }));
  };

  return (
    <Card id="two-factor" className={profile.twoFactorRequired ? 'border-warning/50' : ''}>
      <div className="p-5 border-b border-border flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-foreground flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Two-factor sign-in</h3>
        {profile.twoFactorEnabled ? <Badge variant="success">On</Badge> : <Badge variant={profile.twoFactorRequired ? 'warning' : 'secondary'}>Off</Badge>}
        <p className="w-full text-xs text-muted-foreground">
          {profile.twoFactorRequired
            ? 'Your team requires this. Set it up now to keep using the console.'
            : 'After your password, sign-in also asks for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy).'}
        </p>
      </div>
      <div className="p-5 space-y-4">
        {codes && (
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Save these recovery codes now</p>
            <p className="text-xs text-muted-foreground">Each works once if you lose your phone. They won&apos;t be shown again.</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-sm">
              {codes.map((c) => <span key={c} className="rounded bg-card border border-border px-2 py-1 text-center">{c}</span>)}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyCodes}><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</Button>
              <Button size="sm" variant="ghost" onClick={() => setCodes(null)}>I&apos;ve saved them</Button>
            </div>
          </div>
        )}

        {!profile.twoFactorEnabled && !setup && (
          <Button onClick={start} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}Set up two-factor sign-in</Button>
        )}

        {setup && (
          <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-start">
            <div className="rounded-xl bg-white p-3 border border-border w-fit"><QRCodeSVG value={setup.uri} size={160} /></div>
            <div className="space-y-3 text-sm">
              <p>1. Scan this QR code in your authenticator app.</p>
              <p className="text-xs text-muted-foreground">Can&apos;t scan? Enter this key: <span className="font-mono text-foreground break-all">{setup.secret}</span></p>
              <p>2. Type the 6-digit code it shows.</p>
              <div className="flex gap-2">
                <Input className="w-36 font-mono tracking-[0.3em] text-center" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Authenticator code" />
                <Button onClick={confirm} disabled={busy || code.length !== 6}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Turn on'}</Button>
                <Button variant="ghost" onClick={() => setSetup(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {profile.twoFactorEnabled && mode === 'idle' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode('regenerate')}>New recovery codes</Button>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setMode('disable')}>
              <ShieldOff className="w-3.5 h-3.5 mr-1.5" />Turn off
            </Button>
          </div>
        )}
        {profile.twoFactorEnabled && mode !== 'idle' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Enter your current code to {mode === 'disable' ? 'turn it off' : 'create new codes'}:</span>
            <Input className="w-36 font-mono tracking-[0.3em] text-center" inputMode="numeric" maxLength={6}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Authenticator code" />
            <Button size="sm" variant={mode === 'disable' ? 'destructive' : 'default'} onClick={withCode} disabled={busy || code.length !== 6}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setMode('idle'); setCode(''); }}>Cancel</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
