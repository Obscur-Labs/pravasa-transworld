'use client';
import { useEffect, useState } from 'react';
import { Check, Copy, Crown, Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { PermissionList } from '@/components/shared/permission-list';
import { createTeamMember, updateTeamMember } from '@/lib/api';
import type { AdminRole, TeamMember } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  roles: AdminRole[];
  /** The signed-in super admin, who can't demote or disable themselves. */
  selfId: string;
  onSaved: (member: TeamMember) => void;
}

// Readable temporary password: no look-alike characters, always has a letter and a digit.
function generatePassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  const body = Array.from({ length: 8 }, () => pick(letters + digits)).join('');
  return `${body}${pick(digits)}${pick(letters)}`;
}

const empty = { name: '', username: '', password: '', phone: '', email: '', role: '', isSuperAdmin: false, isActive: true };

export function MemberDialog({ open, onOpenChange, member, roles, selfId, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const isSelf = member?._id === selfId;

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setForm(member
      ? {
          name: member.name, username: member.username, password: '', phone: member.phone, email: member.email,
          role: member.role?._id ?? '', isSuperAdmin: member.isSuperAdmin, isActive: member.isActive,
        }
      : { ...empty, password: generatePassword(), role: roles[0]?._id ?? '' });
  }, [open, member, roles]);

  const selectedRole = roles.find((r) => r._id === form.role);
  const creating = !member;
  const canSave = form.name.trim() && form.username.trim() && form.phone.trim()
    && (form.isSuperAdmin || form.role) && (!creating || form.password.length >= 8);

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Could not copy', description: form.password });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        username: form.username.trim().toLowerCase(),
        role: form.isSuperAdmin ? null : form.role,
        password: form.password || undefined,
      };
      const r = member ? await updateTeamMember(member._id, payload) : await createTeamMember(payload);
      onSaved(r.data.data);
      onOpenChange(false);
      toast({
        title: creating ? 'Team member added' : 'Team member saved',
        description: form.password ? `Share the password with ${form.name.split(' ')[0]}. They will be asked to change it.` : undefined,
        variant: 'success',
      });
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[90dvh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>{creating ? 'Add team member' : `Edit ${member!.name}`}</DialogTitle>
          <DialogDescription>{creating ? 'They sign in to the admin panel with this username and password.' : 'Leave the password empty to keep the current one.'}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Full name</Label>
              <Input id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-username">Username</Label>
              <Input id="m-username" className="font-mono" autoCapitalize="none" spellCheck={false} maxLength={30}
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-phone">Phone</Label>
              <Input id="m-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-email">Email <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="m-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-password">{creating ? 'Password' : 'New password'}</Label>
            <div className="flex gap-2">
              <Input id="m-password" className="font-mono" autoComplete="new-password" placeholder={creating ? '' : 'Leave empty to keep'}
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <Button type="button" variant="outline" size="icon" onClick={() => setForm({ ...form, password: generatePassword() })} title="Generate a password" aria-label="Generate a password">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={copyPassword} disabled={!form.password} title="Copy password" aria-label="Copy password">
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">At least 8 characters with a letter and a number. It is a temporary password: they set their own after signing in.</p>
          </div>

          <label className={`flex items-start gap-3 rounded-xl border p-3 ${form.isSuperAdmin ? 'border-warning/40 bg-warning/5' : 'border-border'} ${isSelf ? 'opacity-60' : 'cursor-pointer'}`}>
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.isSuperAdmin} disabled={isSelf}
              onChange={(e) => setForm({ ...form, isSuperAdmin: e.target.checked })} />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground"><Crown className="w-3.5 h-3.5 text-warning" />Super admin</span>
              <span className="block text-xs text-muted-foreground">Full access to every module, plus managing the team and roles.</span>
            </span>
          </label>

          {!form.isSuperAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="m-role">Role</Label>
              {roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Create a role first on the Roles tab.</p>
              ) : (
                <NativeSelect id="m-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                </NativeSelect>
              )}
              {selectedRole && <PermissionList permissions={selectedRole.permissions} className="pt-1" />}
            </div>
          )}

          {!creating && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Account active</p>
                <p className="text-xs text-muted-foreground">Turning this off signs them out and blocks sign-in.</p>
              </div>
              <Switch checked={form.isActive} disabled={isSelf} title={isSelf ? 'You cannot disable yourself' : undefined}
                onChange={() => setForm({ ...form, isActive: !form.isActive })} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {creating ? 'Add member' : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
