'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import AdminSidebar, { SidebarContent } from '@/components/layout/AdminSidebar';
import { useAdminAuthStore } from '@/store/auth.store';

import { SocketProvider } from '@/components/providers/SocketProvider';
import NotificationDropdown from '@/components/layout/NotificationDropdown';
import AccountMenu from '@/components/layout/AccountMenu';
import { ThemeToggle } from '@/components/theme-toggle';
import { CommandPalette } from '@/components/command-palette';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommandPaletteStore } from '@/store/command-palette.store';
import { getAdminProfile } from '@/lib/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, updateAdmin } = useAdminAuthStore();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const openPalette = useCommandPaletteStore((s) => s.setOpen);

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, _hasHydrated, router]);

  // Keeps name and role current when they change after this session signed in.
  useEffect(() => {
    if (isAuthenticated) getAdminProfile().then((r) => updateAdmin(r.data.data.profile)).catch(() => {});
  }, [isAuthenticated, updateAdmin]);

  if (!_hasHydrated) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden md:flex flex-col gap-2 w-64 shrink-0 border-r border-border">
          <div className="h-16 flex items-center px-5 border-b border-border mb-2">
            <Skeleton className="h-8 w-40" />
          </div>
          <div className="px-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0">
            <Skeleton className="h-9 w-64 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 lg:w-36 rounded-full" />
            </div>
          </div>
          <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
            <Skeleton className="h-9 w-56" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <SocketProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="flex flex-col w-72">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              className="md:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            <button
              onClick={() => openPalette(true)}
              className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors w-64"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="text-[10px] font-mono bg-background border border-border rounded px-1.5 py-0.5">⌘K</kbd>
            </button>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Search"
                className="sm:hidden text-muted-foreground hover:text-foreground"
                onClick={() => openPalette(true)}
              >
                <Search className="w-4 h-4" />
              </Button>
              <ThemeToggle />
              <NotificationDropdown />
              <div className="w-px h-6 bg-border mx-1.5" />
              <AccountMenu />
            </div>
          </header>
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
    </SocketProvider>
  );
}
