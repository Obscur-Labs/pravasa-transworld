'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Crown, History, KeyRound, LogIn, Pencil, Plus, Search, ShieldHalf, Trash2, UserRound, Users,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { PermissionList } from '@/components/shared/permission-list';
import { SignInList } from '@/components/shared/sign-in-list';
import { NativeSelect } from '@/components/ui/native-select';
import { MemberDialog } from '@/components/team/member-dialog';
import { RoleDialog } from '@/components/team/role-dialog';
import { deleteTeamMember, deleteTeamRole, getTeamMember, getTeamMembers, getTeamRoles, getTeamSignIns } from '@/lib/api';
import { formatDate, timeAgo } from '@/lib/utils';
import { useAdminAuthStore } from '@/store/auth.store';
import { ACTION_BADGE } from '@/types';
import type { ActivityLog, AdminRole, LoginEvent, TeamMember } from '@/types';

type Tab = 'members' | 'roles' | 'signins';

export default function TeamPage() {
  const selfId = useAdminAuthStore((s) => s.admin?._id ?? '');
  const [tab, setTab] = useState<Tab>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [memberDialog, setMemberDialog] = useState<{ open: boolean; member: TeamMember | null }>({ open: false, member: null });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role: AdminRole | null }>({ open: false, role: null });
  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null);
  const [removeRole, setRemoveRole] = useState<AdminRole | null>(null);

  const [detail, setDetail] = useState<{ member: TeamMember; activity: ActivityLog[] | null; signIns: LoginEvent[] | null } | null>(null);

  const [signIns, setSignIns] = useState<LoginEvent[] | null>(null);
  const [signInFilter, setSignInFilter] = useState({ admin: '', result: '', days: '30' });

  useEffect(() => {
    if (tab !== 'signins') return;
    setSignIns(null);
    getTeamSignIns({
      admin: signInFilter.admin || undefined,
      result: signInFilter.result || undefined,
      days: Number(signInFilter.days) || undefined,
    })
      .then((r) => setSignIns(r.data.data))
      .catch(() => setSignIns([]));
  }, [tab, signInFilter]);

  const load = useCallback(() => {
    Promise.all([getTeamMembers(), getTeamRoles()])
      .then(([m, r]) => { setMembers(m.data.data); setRoles(r.data.data); })
      .catch(() => toast({ title: 'Could not load the team', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'roles' || t === 'signins') setTab(t);
    load();
  }, [load]);

  const selectTab = (next: Tab) => {
    setTab(next);
    setSearch('');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url);
  };

  const openDetail = (member: TeamMember) => {
    setDetail({ member, activity: null, signIns: null });
    getTeamMember(member._id)
      .then((r) => setDetail((d) => (d?.member._id === member._id
        ? { member: { ...member, ...r.data.data.member }, activity: r.data.data.recentActivity, signIns: r.data.data.recentSignIns }
        : d)))
      .catch(() => setDetail((d) => (d ? { ...d, activity: [], signIns: [] } : d)));
  };

  const s = search.trim().toLowerCase();
  const shownMembers = !s ? members : members.filter((m) =>
    [m.name, m.username, m.phone, m.email, m.roleName].some((v) => v?.toLowerCase().includes(s)));
  const shownRoles = !s ? roles : roles.filter((r) => [r.name, r.description].some((v) => v?.toLowerCase().includes(s)));

  const lastSeen = (m: TeamMember) => {
    const dates = [m.lastActivityAt, m.lastLoginAt].filter(Boolean) as string[];
    return dates.sort().pop() ?? null;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Team & Roles"
        description="Who can sign in to the admin panel and what each person can open or change. Only super admins see this page."
        action={
          tab === 'members' ? (
            <Button onClick={() => setMemberDialog({ open: true, member: null })} disabled={loading}>
              <Plus className="w-4 h-4 mr-2" />Add member
            </Button>
          ) : tab === 'roles' ? (
            <Button onClick={() => setRoleDialog({ open: true, role: null })}>
              <Plus className="w-4 h-4 mr-2" />New role
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div role="tablist" className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
          {([['members', 'Members', Users, members.length], ['roles', 'Roles', ShieldHalf, roles.length], ['signins', 'Sign-ins', LogIn, null]] as const).map(([key, label, Icon, count]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => selectTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />{label}
              {count !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === key ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'}`}>{count}</span>
              )}
            </button>
          ))}
        </div>
        {tab !== 'signins' && <div className="relative sm:ml-auto sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={tab === 'members' ? 'Search members...' : 'Search roles...'} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>}
      </div>

      {tab === 'signins' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-52">
              <label htmlFor="s-member" className="block text-xs font-medium text-muted-foreground mb-1">Member</label>
              <NativeSelect id="s-member" value={signInFilter.admin} onChange={(e) => setSignInFilter({ ...signInFilter, admin: e.target.value })}>
                <option value="">Everyone (incl. unknown usernames)</option>
                {members.filter((m) => m.hasLogin).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </NativeSelect>
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="s-result" className="block text-xs font-medium text-muted-foreground mb-1">Result</label>
              <NativeSelect id="s-result" value={signInFilter.result} onChange={(e) => setSignInFilter({ ...signInFilter, result: e.target.value })}>
                <option value="">All attempts</option>
                <option value="success">Successful</option>
                <option value="failed">Failed or blocked</option>
              </NativeSelect>
            </div>
            <div className="w-full sm:w-40">
              <label htmlFor="s-days" className="block text-xs font-medium text-muted-foreground mb-1">Period</label>
              <NativeSelect id="s-days" value={signInFilter.days} onChange={(e) => setSignInFilter({ ...signInFilter, days: e.target.value })}>
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </NativeSelect>
            </div>
            <p className="text-xs text-muted-foreground sm:ml-auto">Kept for 90 days. Up to 500 most recent shown.</p>
          </div>
          {signIns === null ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
          ) : signIns.length === 0 ? (
            <EmptyState icon={LogIn} title="No sign-in attempts match" />
          ) : (
            <Card className="overflow-hidden"><SignInList events={signIns} showMember /></Card>
          )}
        </div>
      ) : loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : tab === 'members' ? (
        shownMembers.length === 0 ? (
          <EmptyState icon={Users} title={members.length ? 'No members match your search' : 'No team members yet'} />
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="hidden sm:table-cell">Last active</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownMembers.map((m) => {
                  const seen = lastSeen(m);
                  return (
                    <TableRow key={m._id} className="cursor-pointer" onClick={() => openDetail(m)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{m.name[0]?.toUpperCase()}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {m.name}{m._id === selfId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{m.username ? `@${m.username}` : 'No login yet'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.isSuperAdmin ? (
                          <Badge variant="warning" className="gap-1"><Crown className="w-3 h-3" />Super Admin</Badge>
                        ) : (
                          <Badge variant="secondary">{m.roleName}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{m.phone || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground" title={seen ? formatDate(seen) : undefined}>{seen ? timeAgo(seen) : 'Never'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={m.isActive ? 'success' : 'destructive'}>{m.isActive ? 'Active' : 'Disabled'}</Badge>
                          {m.recentFailures > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-destructive" title="Failed sign-in attempts in the last 24 hours">
                              <AlertTriangle className="w-3 h-3" />{m.recentFailures} failed sign-in{m.recentFailures === 1 ? '' : 's'}
                            </span>
                          )}
                          {m.mustChangePassword && (
                            <span className="flex items-center gap-1 text-[11px] text-warning" title="Still on a temporary password">
                              <KeyRound className="w-3 h-3" />Temp password
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Edit ${m.name}`} onClick={() => setMemberDialog({ open: true, member: m })}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Remove ${m.name}`} disabled={m._id === selfId}
                            className="hover:text-destructive" onClick={() => setRemoveMember(m)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )
      ) : shownRoles.length === 0 ? (
        <EmptyState
          icon={ShieldHalf}
          title={roles.length ? 'No roles match your search' : 'No roles yet'}
          description={roles.length ? undefined : 'Create a role, such as "Visa Executive", then give it to team members.'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shownRoles.map((r) => (
            <Card key={r._id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{r.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.memberCount} member{r.memberCount === 1 ? '' : 's'}{r.description && <> &middot; {r.description}</>}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${r.name}`} onClick={() => setRoleDialog({ open: true, role: r })}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${r.name}`} className="hover:text-destructive" onClick={() => setRemoveRole(r)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <PermissionList permissions={r.permissions} className="mt-4" />
            </Card>
          ))}
        </div>
      )}

      {/* Member detail */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {detail && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12"><AvatarFallback>{detail.member.name[0]?.toUpperCase()}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{detail.member.name}</SheetTitle>
                  <p className="text-sm text-muted-foreground font-mono">{detail.member.username ? `@${detail.member.username}` : 'No login yet'}</p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {([
                  ['Role', detail.member.roleName],
                  ['Status', detail.member.isActive ? 'Active' : 'Disabled'],
                  ['Phone', detail.member.phone || '-'],
                  ['Email', detail.member.email || '-'],
                  ['Created', formatDate(detail.member.createdAt)],
                  ['Last sign-in', detail.member.lastLoginAt ? timeAgo(detail.member.lastLoginAt) : 'Never'],
                ] as const).map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="text-foreground truncate">{v}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Permissions</h4>
                <PermissionList permissions={detail.member.permissions} />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Recent activity</h4>
                {detail.activity === null ? (
                  <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : detail.activity.length === 0 ? (
                  <EmptyState icon={History} title="No recent activity" className="py-6" />
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {detail.activity.map((log) => (
                      <li key={log._id} className="px-3 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant={ACTION_BADGE[log.action]} className="capitalize">{log.action}</Badge>
                          <span className="font-medium text-foreground">{log.entityType}</span>
                          <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">{timeAgo(log.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">{log.entityLabel}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Recent sign-ins</h4>
                {detail.signIns === null ? (
                  <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : detail.signIns.length === 0 ? (
                  <EmptyState icon={LogIn} title="No sign-ins yet" className="py-6" />
                ) : (
                  <SignInList events={detail.signIns} className="rounded-xl border border-border" />
                )}
              </div>

              <Button className="w-full" variant="outline" onClick={() => { setMemberDialog({ open: true, member: detail.member }); setDetail(null); }}>
                <UserRound className="w-4 h-4 mr-2" />Edit member
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <MemberDialog
        open={memberDialog.open}
        onOpenChange={(open) => setMemberDialog((d) => ({ ...d, open }))}
        member={memberDialog.member}
        roles={roles}
        selfId={selfId}
        onSaved={() => load()}
      />
      <RoleDialog
        open={roleDialog.open}
        onOpenChange={(open) => setRoleDialog((d) => ({ ...d, open }))}
        role={roleDialog.role}
        onSaved={() => load()}
      />

      <ConfirmDialog
        open={!!removeMember}
        onOpenChange={(open) => !open && setRemoveMember(null)}
        title={`Remove ${removeMember?.name}?`}
        description="They will lose access immediately. Their past actions stay in the activity log. This cannot be undone."
        confirmLabel="Remove member"
        onConfirm={async () => {
          if (!removeMember) return;
          try {
            await deleteTeamMember(removeMember._id);
            toast({ title: 'Team member removed', variant: 'success' });
            load();
          } catch (err: any) {
            toast({ title: 'Could not remove', description: err.response?.data?.message, variant: 'destructive' });
          }
        }}
      />
      <ConfirmDialog
        open={!!removeRole}
        onOpenChange={(open) => !open && setRemoveRole(null)}
        title={`Delete the ${removeRole?.name} role?`}
        description={removeRole?.memberCount ? 'Members still have this role. Give them another role first.' : 'This cannot be undone.'}
        confirmLabel="Delete role"
        onConfirm={async () => {
          if (!removeRole) return;
          try {
            await deleteTeamRole(removeRole._id);
            toast({ title: 'Role deleted', variant: 'success' });
            load();
          } catch (err: any) {
            toast({ title: 'Could not delete role', description: err.response?.data?.message, variant: 'destructive' });
          }
        }}
      />
    </div>
  );
}
