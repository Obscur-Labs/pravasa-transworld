'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Download, LogOut, UserRound } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { InstallGuideDialog, INSTALLED_TOAST } from '@/components/pwa/InstallAppButton';
import { usePwaInstall } from '@/lib/pwa';
import { useAuthStore } from '@/store/auth.store';

// Written by the apply flow; holds passport details, so it must not outlive the session.
const APPLY_DRAFT_KEY = 'visa_app_draft';

const ITEM = 'gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer text-slate-700 focus:bg-slate-100 focus:text-slate-900';

function Avatar({ size }: { size: 'sm' | 'lg' }) {
  const user = useAuthStore((s) => s.user);
  const dim = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-11 h-11 text-base';
  return (
    <span className={`${dim} rounded-full bg-brand-100 flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {user?.profilePhoto
        ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
        : <span className="font-semibold text-brand-800">{user?.name?.trim()?.[0]?.toUpperCase() ?? '?'}</span>}
    </span>
  );
}

/** Header account menu: who is signed in, profile, install, and sign out. */
export default function UserMenu() {
  const { user, logout } = useAuthStore();
  const { mode, manual, install } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  const handleInstall = async () => {
    if (mode === 'instructions') { setGuideOpen(true); return; }
    if ((await install()) === 'accepted') toast(INSTALLED_TOAST);
  };

  const signOut = () => {
    try { localStorage.removeItem(APPLY_DRAFT_KEY); } catch { /* storage unavailable */ }
    logout();
    window.location.href = '/';
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="group flex items-center gap-1.5 rounded-full p-1 sm:pr-2 text-slate-500 transition-colors hover:bg-slate-100 data-[state=open]:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Avatar size="sm" />
          <ChevronDown className="hidden sm:block w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-0 rounded-xl border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-3 px-4 py-4">
            <Avatar size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              <span className="mt-1.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">
                {user?.accountType === 'corporate' ? 'Corporate account' : 'Individual account'}
              </span>
            </div>
          </div>

          <DropdownMenuSeparator className="mx-0 my-0 bg-slate-100" />
          <div className="p-1.5">
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/profile"><UserRound className="w-4 h-4 text-slate-500" aria-hidden />My Profile</Link>
            </DropdownMenuItem>
            {mode !== 'hidden' && (
              <DropdownMenuItem onSelect={handleInstall} className={ITEM}>
                <Download className="w-4 h-4 text-slate-500" aria-hidden />Install App
              </DropdownMenuItem>
            )}
          </div>

          <DropdownMenuSeparator className="mx-0 my-0 bg-slate-100" />
          <div className="p-1.5">
            <DropdownMenuItem onSelect={signOut} className={`${ITEM} text-red-700 focus:bg-red-50 focus:text-red-800`}>
              <LogOut className="w-4 h-4" aria-hidden />Sign out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {manual && <InstallGuideDialog platform={manual} open={guideOpen} onOpenChange={setGuideOpen} />}
    </>
  );
}
