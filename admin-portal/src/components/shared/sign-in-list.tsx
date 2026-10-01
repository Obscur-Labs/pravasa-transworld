import { CheckCircle2, Lock, ShieldAlert, UserX, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { describeDevice } from '@/lib/device';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import type { LoginEvent, LoginResult } from '@/types';

export const LOGIN_RESULT_META: Record<LoginResult, { label: string; icon: LucideIcon; tone: string }> = {
  success: { label: 'Signed in', icon: CheckCircle2, tone: 'text-success' },
  wrong_password: { label: 'Wrong password', icon: XCircle, tone: 'text-destructive' },
  unknown_user: { label: 'Unknown username', icon: UserX, tone: 'text-destructive' },
  locked: { label: 'Blocked: locked', icon: Lock, tone: 'text-warning' },
  disabled: { label: 'Blocked: disabled', icon: ShieldAlert, tone: 'text-warning' },
};

/** Compact list of sign-in attempts: outcome, when, device and IP. */
export function SignInList({ events, showMember = false, className }: { events: LoginEvent[]; showMember?: boolean; className?: string }) {
  return (
    <ul className={cn('divide-y divide-border', className)}>
      {events.map((e) => {
        const meta = LOGIN_RESULT_META[e.result];
        const Icon = meta.icon;
        const member = e.admin && typeof e.admin === 'object' ? e.admin : null;
        return (
          <li key={e._id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.tone)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className={cn('font-medium', meta.tone)}>{meta.label}</span>
                {showMember && (
                  <span className="text-foreground">
                    {member ? member.name : <span className="font-mono text-muted-foreground">&quot;{e.username}&quot;</span>}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {describeDevice(e.userAgent)} &middot; <span className="font-mono">{e.ip || 'unknown IP'}</span>
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap" title={formatDate(e.createdAt)}>{timeAgo(e.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}
