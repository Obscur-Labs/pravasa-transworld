import * as React from 'react';
import { cn } from '@/lib/utils';

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

// A real <select> (best on phones and for keyboard use), styled like Input. Pass h-9 and
// w-auto for compact filter bars; tailwind-merge lets those override the defaults.
const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(({ className, ...props }, ref) => (
  <select
    className={cn(
      'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    ref={ref}
    {...props}
  />
));
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };
