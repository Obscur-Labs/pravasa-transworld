'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import DashboardSidebar from '@/components/layout/DashboardSidebar';
import { useAuthStore } from '@/store/auth.store';
import { SocketProvider } from '@/components/providers/SocketProvider';
import NotificationDropdown from '@/components/layout/NotificationDropdown';
import KYCModal from '@/components/kyc/KYCModal';
import InstallBanner from '@/components/pwa/InstallBanner';
import { Skeleton } from '@/components/ui/skeleton';
import { getVaultDocuments } from '@/lib/api';

interface KYCStatus { aadharFront: boolean; aadharBack: boolean; pan: boolean; }

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, user } = useAuthStore();
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
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6">
            <Skeleton className="h-6 w-40 lg:hidden" />
            <div className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
          <div className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-6">
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
        <DashboardSidebar collapsed={collapsed} onToggle={toggleSidebar} />
        <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}`} />

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-10">
              <DashboardSidebar collapsed={false} onToggle={() => setMobileOpen(false)} mobile />
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
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <Link href="/" className="flex items-center" aria-label="Pravasa Transworld — home">
                <img src="/logo.png" alt="Pravasa Transworld" className="h-7 w-auto" />
              </Link>
            </div>

            {/* Desktop: empty spacer */}
            <div className="hidden lg:block" />

            {/* Right: bell + profile avatar */}
            <div className="flex items-center gap-2">
              <NotificationDropdown />
              <Link
                href="/profile"
                className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center hover:ring-2 hover:ring-brand-400 transition-all overflow-hidden flex-shrink-0"
                title="Profile"
              >
                {user?.profilePhoto ? (
                  <img src={user.profilePhoto} alt="" className="w-8 h-8 object-cover" />
                ) : (
                  <span className="text-brand-700 font-semibold text-sm">
                    {user?.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </Link>
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
