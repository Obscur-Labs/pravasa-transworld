'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, History, Loader2, Mail, Phone, ShieldCheck } from 'lucide-react';
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
import { getAdminProfile, updateAdminProfile } from '@/lib/api';
import { formatDate, timeAgo } from '@/lib/utils';
import { useAdminAuthStore } from '@/store/auth.store';
import { ACTION_BADGE } from '@/types';
import type { ActivityLog, AdminProfile } from '@/types';

export default function ProfilePage() {
  const updateAdmin = useAdminAuthStore((s) => s.updateAdmin);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminProfile().then((r) => {
      const { profile: p, recentActivity } = r.data.data;
      setProfile(p);
      setActivity(recentActivity);
      setName(p.name);
      setPhone(p.phone);
    });
  }, []);

  const dirty = !!profile && (name.trim() !== profile.name || phone.trim() !== profile.phone);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await updateAdminProfile({ name: name.trim(), phone: phone.trim() });
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
      <PageHeader title="My profile" description="Your account details and recent actions in the console." />

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
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
              <ShieldCheck className="w-3.5 h-3.5" /> {profile.role}
            </span>

            <ul className="mt-5 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground truncate">{profile.email}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{profile.phone}</span>
              </li>
              <li className="flex items-center gap-3">
                <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Member since {formatDate(profile.createdAt)}</span>
              </li>
            </ul>
          </div>
        </Card>

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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profile.email} disabled />
                  <p className="text-xs text-muted-foreground">Your sign-in address, so it cannot be changed here.</p>
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

          <Card>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Your recent activity</h3>
              <Link href="/logs" className="text-xs font-medium text-primary hover:underline">All activity</Link>
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
