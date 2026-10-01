'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { allNavItems } from '@/config/nav';
import { useAdminAuthStore } from '@/store/auth.store';
import { useCommandPaletteStore } from '@/store/command-palette.store';
import { usePermissions } from '@/lib/usePermissions';

export function CommandPalette() {
  const { open, setOpen, toggle } = useCommandPaletteStore();
  const router = useRouter();
  const { logout } = useAdminAuthStore();
  const { can, isSuperAdmin } = usePermissions();
  const pages = allNavItems.filter((i) => (i.superAdminOnly ? isSuperAdmin : !i.module || can(i.module)));

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [toggle]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {pages.map(({ href, label, icon: Icon }) => (
            <CommandItem key={href} value={label} onSelect={() => go(href)}>
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Account">
          <CommandItem
            value="Sign out"
            onSelect={() => {
              setOpen(false);
              logout();
              router.push('/login');
            }}
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
