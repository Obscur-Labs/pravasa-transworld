'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Settings, type LucideIcon } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { topNavItems, configNavItems, bottomNavItems, otherNavItems, type NavItem } from '@/config/nav';
import { usePermissions } from '@/lib/usePermissions';
import { useBadgesStore } from '@/store/badges.store';

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

function NavLink({ href, label, icon: Icon, badge, active, onNavigate }: NavItem & { active: boolean; onNavigate?: () => void }) {
  const count = useBadgesStore((s) => (badge ? s.counts[badge] ?? 0 : 0));
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
      <span className="flex-1 truncate">{label}</span>
      {count > 0 && (
        <span
          aria-label={`${count} waiting`}
          className="ml-auto min-w-[1.25rem] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-primary-foreground tabular-nums"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
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

// Sidebar sections in the order of the redesign; each lists page links by href.
const SECTIONS: { label: string; hrefs: string[] }[] = [
  { label: 'Operations', hrefs: ['/dashboard', '/applications', '/payments', '/processing'] },
  { label: 'Catalogue', hrefs: ['/countries', '/promo-codes'] },
  { label: 'Customers', hrefs: ['/users', '/agents', '/inquiries'] },
  { label: 'Insights & Comms', hrefs: ['/reports', '/testimonials', '/blog', '/notifications'] },
  { label: 'Admin', hrefs: ['/team', '/logs', '/trash'] },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, isSuperAdmin } = usePermissions();
  // Only pages this member can open are listed.
  const visible = (items: NavItem[]) => items.filter((i) => (i.superAdminOnly ? isSuperAdmin : !i.module || can(i.module)));
  const configItems = visible(configNavItems);
  const allItems = [...topNavItems, ...bottomNavItems, ...otherNavItems];

  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    configNavItems.some(({ href }) => isActivePath(pathname, href)) ? ['config'] : []);

  return (
    <>
      <Link href="/dashboard" onClick={onNavigate} className="h-16 shrink-0 flex items-center gap-2.5 px-5 border-b border-border">
        <img src="/logo-mark.png" alt="" className="w-8 h-8 rounded-lg flex-shrink-0" />
        <div className="min-w-0 leading-tight">
          <span className="text-foreground font-semibold text-sm block truncate">Pravasa Transworld</span>
          <span className="text-muted-foreground text-xs">Admin Console</span>
        </div>
      </Link>

      <nav className="flex-1 p-4 overflow-y-auto">
        {SECTIONS.map((section) => {
          const items = visible(allItems.filter((i) => section.hrefs.includes(i.href)))
            .sort((a, b) => section.hrefs.indexOf(a.href) - section.hrefs.indexOf(b.href));
          const showConfig = section.label === 'Admin' && configItems.length > 0;
          if (!items.length && !showConfig) return null;
          return (
            <div key={section.label} className="mb-4">
              <p className="px-3 mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{section.label}</p>
              <div className="space-y-1">
                {items.map((item) => (
                  <NavLink key={item.href} {...item} active={isActivePath(pathname, item.href)} onNavigate={onNavigate} />
                ))}
                {showConfig && (
                  <Accordion type="multiple" value={openGroups} onValueChange={setOpenGroups}>
                    <NavGroup value="config" label="Configurations" icon={Settings} items={configItems} pathname={pathname} onNavigate={onNavigate} />
                  </Accordion>
                )}
              </div>
            </div>
          );
        })}
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

/** "Customers / B2B Agents": the section and page for the current path, shown in the top bar. */
export function Breadcrumb() {
  const pathname = usePathname();
  const items = [...topNavItems, ...bottomNavItems, ...otherNavItems, ...configNavItems];
  const item = items.find((i) => isActivePath(pathname, i.href));
  if (!item) return null;
  const section = configNavItems.includes(item) ? 'Admin / Configurations' : SECTIONS.find((s) => s.hrefs.includes(item.href))?.label;
  return (
    <nav aria-label="Breadcrumb" className="hidden lg:block mr-auto text-sm text-muted-foreground truncate">
      {section && <span>{section} / </span>}
      <span className="font-semibold text-foreground">{item.label}</span>
    </nav>
  );
}
