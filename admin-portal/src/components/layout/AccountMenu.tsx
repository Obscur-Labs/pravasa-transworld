'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAdminAuthStore } from '@/store/auth.store';

export default function AccountMenu() {
  const router = useRouter();
  const { admin, logout } = useAdminAuthStore();
  const initial = admin?.name?.[0]?.toUpperCase() || 'A';

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="flex items-center gap-2 h-10 pl-1 pr-2 rounded-full border border-transparent hover:border-border hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-border data-[state=open]:bg-muted"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
        </Avatar>
        <span className="hidden lg:block text-sm font-medium text-foreground max-w-[140px] truncate">{admin?.name}</span>
        <ChevronDown className="hidden lg:block w-3.5 h-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-0 rounded-xl">
        <div className="flex items-center gap-3 p-4">
          <Avatar className="h-11 w-11">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{admin?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{admin?.username ? `@${admin.username}` : admin?.email}</p>
          </div>
        </div>

        {admin?.roleName && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-accent px-3 py-2">
            <ShieldCheck className="w-4 h-4 text-accent-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Role</span>
            <span className="ml-auto text-xs font-semibold text-accent-foreground">{admin.roleName}</span>
          </div>
        )}

        <DropdownMenuSeparator className="m-0" />
        <div className="p-1.5">
          <DropdownMenuItem asChild className="gap-2.5 px-2.5 py-2 cursor-pointer">
            <Link href="/profile">
              <UserRound className="w-4 h-4" /> My profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleLogout}
            className="gap-2.5 px-2.5 py-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
