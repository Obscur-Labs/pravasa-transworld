'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Plus, Stamp, CreditCard, FolderLock, X,
} from 'lucide-react';

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
  /** Mobile drawer only: closes it. The desktop collapse control lives in the header. */
  onClose?: () => void;
  mobile?: boolean;
}

// Account actions (profile, install, sign out) live in the header's avatar menu.
export default function DashboardSidebar({ collapsed, onClose, mobile = false }: Props) {
  const pathname = usePathname();
  const isCollapsed = mobile ? false : collapsed;

  const asideClass = mobile
    ? 'fixed left-0 top-0 h-screen w-72 bg-white flex flex-col z-[60] shadow-2xl'
    : `fixed left-0 top-0 h-screen bg-white border-r border-slate-200 hidden lg:flex flex-col z-30 transition-[width] duration-300 ease-out motion-reduce:transition-none ${collapsed ? 'w-16' : 'w-64'}`;

  return (
    <aside className={asideClass}>
      <div className={`h-16 border-b border-slate-100 flex items-center flex-shrink-0 ${isCollapsed ? 'justify-center' : 'px-5 justify-between'}`}>
        {/* Collapsed rail has no room for the wordmark, so it falls back to the
            square mark cut from the same artwork. */}
        <Link href="/" className="flex items-center min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400" aria-label="Pravasa Transworld home">
          {isCollapsed ? (
            <img src="/logo-mark.png" alt="" className="w-8 h-8 rounded-lg flex-shrink-0" />
          ) : (
            <img src="/logo.png" alt="" className="h-8 w-auto" />
          )}
        </Link>
        {mobile && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              title={isCollapsed ? label : undefined}
              aria-label={isCollapsed ? label : undefined}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                active
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" aria-hidden />
              {!isCollapsed && label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
