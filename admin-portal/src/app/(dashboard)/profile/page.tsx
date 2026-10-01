'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AtSign, CalendarDays, Eye, EyeOff, History, KeyRound, Loader2, Mail, Phone, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { PermissionList } from '@/components/shared/permission-list';
import { changeOwnPassword, getAdminProfile, updateAdminProfile } from '@/lib/api';
import { formatDate, timeAgo } from '@/lib/utils';
import { usePermissions } from '@/lib/usePermissions';
import { useAdminAuthStore } from '@/store/auth.store';
import { ACTION_BADGE } from '@/types';
import type { ActivityLog, AdminProfile } from '@/types';

export default function ProfilePage() {
  const updateAdmin = useAdminAuthStore((s) => s.updateAdmin);
  const { can } = usePermissions();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    getAdminProfile().then((r) => {
      const { profile: p, recentActivity } = r.data.data;
      setProfile(p);
      setActivity(recentActivity);
      setName(p.name);
      setPhone(p.phone);
      setEmail(p.email);
    });
  }, []);

  const dirty = !!profile && (name.trim() !== profile.name || phone.trim() !== profile.phone || email.trim() !== profile.email);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await updateAdminProfile({ name: name.trim(), phone: phone.trim(), email: email.trim() });
      const p: AdminProfile = r.data.data.profile;
      setProfile(p);
      updateAdmin(p);
      toast({ title: 'Profile saved', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Could not save profile', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const pwMismatch = !!pw.confirm && pw.next !== pw.confirm;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwMismatch) return;
    setChangingPw(true);
    try {
      const r = await changeOwnPassword({ currentPassword: pw.current, newPassword: pw.next });
      // Other sessions were signed out; this one continues on the fresh token.
      const token: string = r.data.data.token;
      localStorage.setItem('adminToken', token);
      useAdminAuthStore.setState({ token });
      updateAdmin({ mustChangePassword: false });
      setProfile((p) => (p ? { ...p, mustChangePassword: false } : p));
      setPw({ current: '', next: '', confirm: '' });
      toast({ title: 'Password changed', description: 'You have been signed out everywhere else.', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Could not change password', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setChangingPw(false);
    }
  };

  if (!profile) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader title="My profile" description="Your account, what you can access, and your recent actions." />

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="h-20 bg-primary" />
            <div className="px-6 pb-6 -mt-10">
              <Avatar className="h-20 w-20 border-4 border-card">
                <AvatarFallback className="bg-accent text-2xl text-accent-foreground">
                  {profile.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-3 text-lg font-semibold text-foreground">{profile.name}</h2>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                <ShieldCheck className="w-3.5 h-3.5" /> {profile.roleName}
              </span>

              <ul className="mt-5 space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <AtSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground font-mono">{profile.username}</span>
                </li>
                {profile.email && (
                  <li className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-foreground truncate">{profile.email}</span>
                  </li>
                )}
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">{profile.phone || 'No phone'}</span>
                </li>
                <li className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Member since {formatDate(profile.createdAt)}</span>
                </li>
              </ul>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-foreground">Your access</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              {profile.isSuperAdmin ? 'Super admin: full access to every module, plus Team & Roles.' : 'Set by your role. Ask a super admin to change it.'}
            </p>
            <PermissionList permissions={profile.permissions} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <form onSubmit={handleSave}>
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold text-foreground">Account details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Shown in activity logs and on actions you take.</p>
              </div>
              <div className="p-5 grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={profile.username} disabled className="font-mono" />
                  <p className="text-xs text-muted-foreground">Only a super admin can change it.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  {can('payments') && <p className="text-xs text-muted-foreground">Payment verification alerts are sent here.</p>}
                </div>
              </div>
              <div className="px-5 pb-5 flex justify-end">
                <Button type="submit" disabled={!dirty || saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          </Card>

          <Card id="password" className={profile.mustChangePassword ? 'border-warning/50' : ''}>
            <form onSubmit={handleChangePassword}>
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold text-foreground flex items-center gap-2"><KeyRound className="w-4 h-4" />Change password</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {profile.mustChangePassword
                    ? 'You are on a temporary password. Choose your own now.'
                    : 'At least 8 characters with a letter and a number. Other sessions will be signed out.'}
                </p>
              </div>
              <div className="p-5 grid sm:grid-cols-3 gap-4">
                {([
                  ['current', 'Current password', 'current-password'],
                  ['next', 'New password', 'new-password'],
                  ['confirm', 'Confirm new password', 'new-password'],
                ] as const).map(([key, label, auto]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`pw-${key}`}>{label}</Label>
                    <Input id={`pw-${key}`} type={showPw ? 'text' : 'password'} autoComplete={auto} value={pw[key]}
                      onChange={(e) => setPw({ ...pw, [key]: e.target.value })} required minLength={key === 'current' ? 1 : 8} />
                  </div>
                ))}
                {pwMismatch && <p className="text-xs text-destructive sm:col-span-3">The new passwords don&apos;t match.</p>}
              </div>
              <div className="px-5 pb-5 flex items-center justify-between gap-3">
                <button type="button" onClick={() => setShowPw((v) => !v)} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}{showPw ? 'Hide' : 'Show'} passwords
                </button>
                <Button type="submit" disabled={changingPw || !pw.current || pw.next.length < 8 || pwMismatch}>
                  {changingPw && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update password
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Your recent activity</h3>
              {can('activityLogs') && <Link href="/logs" className="text-xs font-medium text-primary hover:underline">All activity</Link>}
            </div>
            {activity.length === 0 ? (
              <EmptyState icon={History} title="Nothing yet" description="Changes you make in the console show up here." className="py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {activity.map((log) => (
                  <li key={log._id} className="px-5 py-3 flex items-center gap-3 text-sm">
                    <Badge variant={ACTION_BADGE[log.action]} className="capitalize w-16 justify-center">{log.action}</Badge>
                    <span className="text-foreground font-medium whitespace-nowrap">{log.entityType}</span>
                    <span className="text-muted-foreground truncate flex-1">{log.entityLabel}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
