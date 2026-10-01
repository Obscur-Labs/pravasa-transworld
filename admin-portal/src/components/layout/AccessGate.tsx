'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Eye, KeyRound, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { navItemForPath } from '@/config/nav';
import { isViewOnlyModule } from '@/config/permissions';
import { usePermissions } from '@/lib/usePermissions';
import { useAdminAuthStore } from '@/store/auth.store';

/**
 * Wraps every dashboard page: blocks pages the member has no access to, notes view-only
 * access, and nudges anyone still on a default password. The server enforces the same
 * rules; this keeps the screens honest about them.
 */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can, isSuperAdmin } = usePermissions();
  const mustChangePassword = useAdminAuthStore((s) => !!s.admin?.mustChangePassword);
  const item = navItemForPath(pathname);

  const blocked = item && (item.superAdminOnly ? !isSuperAdmin : item.module && !can(item.module));
  if (blocked) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">You don&apos;t have access to {item!.label}</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">Ask your super admin to add it to your role if you need it.</p>
        <Button asChild variant="outline" className="mt-5"><Link href="/profile">See my access</Link></Button>
      </div>
    );
  }

  const viewOnly = !!item?.module && !isViewOnlyModule(item.module) && !can(item.module, 'manage');
  return (
    <>
      {mustChangePassword && pathname !== '/profile' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning sm:px-6">
          <KeyRound className="h-4 w-4 shrink-0" />
          <span className="flex-1 min-w-[12rem]">You&apos;re using a temporary password. Set your own to keep your account safe.</span>
          <Link href="/profile#password" className="font-semibold underline">Change password</Link>
        </div>
      )}
      {viewOnly && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2 text-xs text-muted-foreground sm:px-6">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          You have view-only access to {item!.label}. Changes you try to make won&apos;t be saved.
        </div>
      )}
      {children}
    </>
  );
}
