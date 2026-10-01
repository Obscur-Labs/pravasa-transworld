'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { ADMIN_MODULES, ACCESS_LABELS, type AccessLevel, type ModuleKey, type Permissions } from '@/config/permissions';
import { createTeamRole, updateTeamRole } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { AdminRole } from '@/types';

type Choice = AccessLevel | 'none';
const CHOICES: { value: Choice; label: string }[] = [
  { value: 'none', label: 'No access' },
  { value: 'view', label: ACCESS_LABELS.view },
  { value: 'manage', label: ACCESS_LABELS.manage },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: AdminRole | null;
  onSaved: (role: AdminRole) => void;
}

export function RoleDialog({ open, onOpenChange, role, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Permissions>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setPermissions({ ...(role?.permissions ?? {}) });
  }, [open, role]);

  const set = (key: ModuleKey, choice: Choice) =>
    setPermissions((p) => {
      const next = { ...p };
      if (choice === 'none') delete next[key];
      else next[key] = choice;
      return next;
    });

  // Bulk shortcuts; view-only modules never go above view.
  const setAll = (level: AccessLevel | 'none') =>
    setPermissions(level === 'none' ? {} : Object.fromEntries(ADMIN_MODULES.map((m) => [m.key, 'viewOnly' in m && m.viewOnly ? 'view' : level])));

  const granted = Object.keys(permissions).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim(), permissions };
      const r = role ? await updateTeamRole(role._id, payload) : await createTeamRole(payload);
      onSaved(r.data.data);
      onOpenChange(false);
      toast({ title: role ? 'Role saved' : 'Role created', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Could not save role', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[90dvh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>{role ? `Edit role: ${role.name}` : 'New role'}</DialogTitle>
          <DialogDescription>Pick what this role can open and change. Members with it get these permissions right away.</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Role name</Label>
              <Input id="role-name" placeholder="e.g. Visa Executive" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="role-desc" placeholder="What this role is for" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-foreground">
                Permissions <span className="font-normal text-muted-foreground">({granted} of {ADMIN_MODULES.length} modules)</span>
              </p>
              <div className="flex gap-1.5">
                <Button type="button" size="sm" variant="outline" onClick={() => setAll('view')}>All view only</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setAll('manage')}>All full access</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAll('none')}>Clear</Button>
              </div>
            </div>
            <div className="rounded-xl border border-border divide-y divide-border">
              {ADMIN_MODULES.map((m) => {
                const current: Choice = permissions[m.key] ?? 'none';
                const viewOnly = 'viewOnly' in m && m.viewOnly;
                return (
                  <div key={m.key} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                    <div role="radiogroup" aria-label={`${m.label} access`} className="flex shrink-0 rounded-lg bg-muted p-0.5">
                      {CHOICES.filter((c) => !(viewOnly && c.value === 'manage')).map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          role="radio"
                          aria-checked={current === c.value}
                          onClick={() => set(m.key, c.value)}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            current === c.value
                              ? c.value === 'manage' ? 'bg-primary text-primary-foreground shadow-sm'
                                : c.value === 'view' ? 'bg-card text-foreground shadow-sm' : 'bg-card text-muted-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              View only opens the pages and downloads files. Full access also creates, edits and deletes. Team &amp; Roles is always super admin only.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || granted === 0}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {role ? 'Save role' : 'Create role'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
