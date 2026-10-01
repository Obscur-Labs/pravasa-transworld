'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Settings, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { topNavItems, configNavItems, bottomNavItems, otherNavItems, type NavItem } from '@/config/nav';
import { usePermissions } from '@/lib/usePermissions';

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

function NavLink({ href, label, icon: Icon, active, onNavigate }: NavItem & { active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-accent font-semibold text-primary'
          : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </Link>
  );
}

function NavGroup({
  value, label, icon: Icon, items, pathname, onNavigate,
}: {
  value: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = items.some(({ href }) => isActivePath(pathname, href));
  return (
    <AccordionItem value={value} className="border-none">
      <AccordionTrigger
        className={cn(
          'rounded-lg px-3 py-2.5 text-sm font-medium hover:no-underline hover:bg-muted',
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <span className="flex items-center gap-3">
          <Icon className="h-4 w-4 flex-shrink-0" />
          {label}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-0 pl-3 ml-[18px] border-l border-border space-y-1">
        {items.map((item) => (
          <NavLink key={item.href} {...item} active={isActivePath(pathname, item.href)} onNavigate={onNavigate} />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, isSuperAdmin } = usePermissions();
  // Only pages this member can open are listed.
  const visible = (items: NavItem[]) => items.filter((i) => (i.superAdminOnly ? isSuperAdmin : !i.module || can(i.module)));
  const configItems = visible(configNavItems);
  const otherItems = visible(otherNavItems);

  const [openGroups, setOpenGroups] = useState<string[]>(() => [
    ...(configNavItems.some(({ href }) => isActivePath(pathname, href)) ? ['config'] : []),
    ...(otherNavItems.some(({ href }) => isActivePath(pathname, href)) ? ['other'] : []),
  ]);

  return (
    <>
      <Link href="/dashboard" onClick={onNavigate} className="h-16 shrink-0 flex items-center gap-2.5 px-5 border-b border-border">
        <img src="/logo-mark.png" alt="" className="w-8 h-8 rounded-lg flex-shrink-0" />
        <div className="min-w-0 leading-tight">
          <span className="text-foreground font-semibold text-sm block truncate">Pravasa Transworld</span>
          <span className="text-muted-foreground text-xs">Admin Console</span>
        </div>
      </Link>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visible(topNavItems).map((item) => (
          <NavLink key={item.href} {...item} active={isActivePath(pathname, item.href)} onNavigate={onNavigate} />
        ))}

        {visible(bottomNavItems).map((item) => (
          <NavLink key={item.href} {...item} active={isActivePath(pathname, item.href)} onNavigate={onNavigate} />
        ))}

        <Accordion type="multiple" value={openGroups} onValueChange={setOpenGroups}>
          {configItems.length > 0 && <NavGroup value="config" label="Configurations" icon={Settings} items={configItems} pathname={pathname} onNavigate={onNavigate} />}
          {otherItems.length > 0 && <NavGroup value="other" label="Other Options" icon={MoreHorizontal} items={otherItems} pathname={pathname} onNavigate={onNavigate} />}
        </Accordion>
      </nav>
    </>
  );
}

export default function AdminSidebar() {
  return (
    <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col h-screen overflow-y-auto flex-shrink-0 sticky top-0">
      <SidebarContent />
    </aside>
  );
}
