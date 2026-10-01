import { Eye, PencilLine } from 'lucide-react';
import { ADMIN_MODULES, ACCESS_LABELS, type Permissions } from '@/config/permissions';
import { cn } from '@/lib/utils';

/** Read-only summary of a permission set: each granted module with its access level. */
export function PermissionList({ permissions, className }: { permissions: Permissions; className?: string }) {
  const granted = ADMIN_MODULES.filter((m) => permissions[m.key]);
  if (!granted.length) return <p className={cn('text-sm text-muted-foreground', className)}>No modules yet.</p>;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {granted.map((m) => {
        const level = permissions[m.key]!;
        return (
          <li
            key={m.key}
            title={`${m.label}: ${ACCESS_LABELS[level]}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
              level === 'manage' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground',
            )}
          >
            {level === 'manage' ? <PencilLine className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {m.label}
          </li>
        );
      })}
    </ul>
  );
}
