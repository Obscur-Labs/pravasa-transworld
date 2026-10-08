'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import DashboardSidebar from '@/components/layout/DashboardSidebar';
import { useAuthStore } from '@/store/auth.store';
import { SocketProvider } from '@/components/providers/SocketProvider';
import NotificationDropdown from '@/components/layout/NotificationDropdown';
import UserMenu from '@/components/layout/UserMenu';
import KYCModal from '@/components/kyc/KYCModal';
import InstallBanner from '@/components/pwa/InstallBanner';
import { Skeleton } from '@/components/ui/skeleton';
import { getVaultDocuments } from '@/lib/api';

interface KYCStatus { aadharFront: boolean; aadharBack: boolean; pan: boolean; }

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [showKYC, setShowKYC]     = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, _hasHydrated, router]);

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated) return;
    getVaultDocuments()
      .then((r) => {
        const docs: { type: string; label: string }[] = r.data.data ?? [];
        const status: KYCStatus = {
          aadharFront: docs.some(d => d.type === 'aadhar' && d.label.toLowerCase().includes('front')),
          aadharBack:  docs.some(d => d.type === 'aadhar' && d.label.toLowerCase().includes('back')),
          pan:         docs.some(d => d.type === 'pan'),
        };
        setKycStatus(status);
        if (!status.aadharFront || !status.aadharBack || !status.pan) setShowKYC(true);
      })
      .catch(() => {});
  }, [_hasHydrated, isAuthenticated]);

  // Mirrors the real chrome (sidebar + header + content) so nothing shifts once
  // the persisted auth store rehydrates.
  if (!_hasHydrated) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <div className="hidden lg:flex flex-col gap-2 w-64 shrink-0 bg-white border-r border-slate-200 p-4">
          <Skeleton className="h-8 w-40 mb-4" />
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6">
            <Skeleton className="h-6 w-40 lg:hidden" />
            <Skeleton className="hidden lg:block h-8 w-8 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-14 rounded-full" />
            </div>
          </div>
          <div className="flex-1 page-container space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
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
      <div className="flex min-h-screen bg-slate-50">

        {/* ── Desktop sidebar (hidden on mobile/tablet) ── */}
        <DashboardSidebar collapsed={collapsed} />
        <div className={`hidden lg:block flex-shrink-0 transition-[width] duration-300 ease-out motion-reduce:transition-none ${collapsed ? 'w-16' : 'w-64'}`} />

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-10">
              <DashboardSidebar collapsed={false} onClose={() => setMobileOpen(false)} mobile />
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        <main className="flex-1 flex flex-col min-w-0 min-h-screen">

          {/* Header */}
          <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10 shrink-0">

            {/* Mobile: hamburger + logo */}
            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <Link href="/" className="flex items-center" aria-label="Pravasa Transworld home">
                <img src="/logo.png" alt="" className="h-7 w-auto" />
              </Link>
            </div>

            {/* Desktop: sidebar collapse, always in the same spot whatever the sidebar's width */}
            <button
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-1 sm:gap-2">
              <NotificationDropdown />
              <UserMenu />
            </div>
          </header>

          <InstallBanner />
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>

      {showKYC && kycStatus && (
        <KYCModal initialStatus={kycStatus} onComplete={() => setShowKYC(false)} />
      )}
    </SocketProvider>
  );
}
