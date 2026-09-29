'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Plus, LogOut,
  Stamp, CreditCard, FolderLock, ChevronLeft, ChevronRight, X, User,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import InstallAppButton from '@/components/pwa/InstallAppButton';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/apply', label: 'Apply for Visa', icon: Plus },
  { href: '/applications', label: 'My Applications', icon: FileText },
  { href: '/my-visas', label: 'My Visas', icon: Stamp },
  { href: '/document-vault', label: 'Document Vault', icon: FolderLock },
  { href: '/payment-history', label: 'Payment History', icon: CreditCard },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
}

export default function DashboardSidebar({ collapsed, onToggle, mobile = false }: Props) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const isCollapsed = mobile ? false : collapsed;

  const asideClass = mobile
    ? 'fixed left-0 top-0 h-screen w-72 bg-white flex flex-col z-[60] shadow-2xl'
    : `fixed left-0 top-0 h-screen bg-white border-r border-slate-200 hidden lg:flex flex-col z-30 transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}`;

  return (
    <aside className={asideClass}>
      {/* Logo */}
      <div className={`border-b border-slate-100 flex items-center flex-shrink-0 ${isCollapsed ? 'h-16 justify-center' : 'h-16 px-5 justify-between'}`}>
        {/* Collapsed rail has no room for the wordmark, so it falls back to the
            square mark cut from the same artwork. */}
        <Link href="/" className="flex items-center min-w-0" aria-label="Pravasa Transworld — home">
          {isCollapsed ? (
            <img src="/logo-mark.png" alt="Pravasa Transworld" className="w-8 h-8 rounded-lg flex-shrink-0" />
          ) : (
            <img src="/logo.png" alt="Pravasa Transworld" className="h-8 w-auto" />
          )}
        </Link>
        {mobile ? (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          !isCollapsed && (
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )
        )}
      </div>

      {/* User profile — links to /profile */}
      <Link
        href="/profile"
        className={`border-b border-slate-100 flex-shrink-0 transition-colors hover:bg-slate-50 ${isCollapsed ? 'py-4 flex justify-center' : 'px-4 py-4'}`}
      >
        <div className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user?.profilePhoto ? (
              <img src={user.profilePhoto} alt="" className="w-9 h-9 object-cover" />
            ) : (
              <span className="text-brand-700 font-semibold text-sm">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.name ?? ''}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email ?? ''}</p>
            </div>
          )}
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              title={isCollapsed ? label : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={`border-t border-slate-100 flex-shrink-0 ${isCollapsed && !mobile ? 'p-2 flex flex-col items-center gap-1' : 'p-4 space-y-1'}`}>
        {!mobile && isCollapsed && (
          <button
            onClick={onToggle}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        <InstallAppButton
          iconOnly={isCollapsed && !mobile}
          label="Install App"
          className={`flex items-center rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors ${
            isCollapsed && !mobile ? 'p-2 justify-center' : 'gap-3 px-3 py-2.5 w-full'
          }`}
        />
        <Link
          href="/profile"
          title={isCollapsed && !mobile ? 'Profile' : undefined}
          className={`flex items-center rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors ${
            isCollapsed && !mobile ? 'p-2 justify-center' : 'gap-3 px-3 py-2.5 w-full'
          } ${pathname === '/profile' ? 'bg-brand-50 text-brand-700' : ''}`}
        >
          <User className="w-4 h-4 flex-shrink-0" />
          {(!isCollapsed || mobile) && 'Profile'}
        </Link>
        <button
          onClick={() => { logout(); window.location.href = '/'; }}
          title={isCollapsed && !mobile ? 'Sign Out' : undefined}
          className={`flex items-center rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors ${
            isCollapsed && !mobile ? 'p-2 justify-center' : 'gap-3 px-3 py-2.5 w-full'
          }`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {(!isCollapsed || mobile) && 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
