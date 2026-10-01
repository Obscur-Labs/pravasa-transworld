'use client';
import Link from 'next/link';
import { ChevronDown, LayoutDashboard, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import InstallAppButton from '@/components/pwa/InstallAppButton';
import { useHasSession } from '@/lib/useHasSession';
import { SERVICES } from '@/lib/services';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const hasSession = useHasSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { href: '/', label: 'Destinations' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];
  const linkClass = 'text-sm font-semibold text-slate-600 hover:text-brand-600 px-4 py-2 rounded-lg hover:bg-slate-50 transition-all duration-200';

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-md shadow-slate-100/5'
        : 'bg-white/80 backdrop-blur-lg border-b border-slate-100/5'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* The wordmark already says "Pravasa Transworld", so it carries the alt text
              and no repeated label sits beside it. */}
          <Link href="/" className="flex items-center group" aria-label="Pravasa Transworld home">
            <img
              src="/logo.png"
              alt="Pravasa Transworld"
              width={1841}
              height={516}
              className="h-9 sm:h-10 w-auto transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link href={navLinks[0].href} className={linkClass}>{navLinks[0].label}</Link>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className={`${linkClass} flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 data-[state=open]:text-brand-600 data-[state=open]:bg-slate-50 group`}>
                More Services
                <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="w-64 rounded-2xl p-2 bg-white border-slate-100 shadow-xl">
                {SERVICES.map(({ key, slug, name, icon: Icon }) => (
                  <DropdownMenuItem key={key} asChild className="rounded-xl px-3 py-2.5 cursor-pointer focus:bg-brand-50">
                    <Link href={`/services/${slug}`} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 border border-brand-100">
                        <Icon className="w-4 h-4 text-brand-600" aria-hidden />
                      </span>
                      <span className="text-sm font-semibold text-slate-700">{name}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {navLinks.slice(1).map((l) => (
              <Link key={l.href} href={l.href} className={linkClass}>{l.label}</Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <InstallAppButton
              iconOnly
              className="p-2 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            />
            {hasSession ? (
              <Button size="sm" asChild className="bg-gold-600 hover:bg-gold-700 text-white shadow-md shadow-gold-600/20 border-0 font-semibold">
                <Link href="/dashboard"><LayoutDashboard className="w-4 h-4 mr-1.5" aria-hidden />Go to Dashboard</Link>
              </Button>
            ) : (
              // Kept invisible (not removed) until the session check runs, so the header doesn't jump.
              <div className={`flex items-center gap-2 ${hasSession === null ? 'invisible' : ''}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-slate-600 hover:text-brand-600 hover:bg-slate-50 font-semibold border-0"
                >
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button
                  size="sm"
                  asChild
                  className="bg-gold-600 hover:bg-gold-700 text-white shadow-md shadow-gold-600/20 border-0 font-semibold"
                >
                  <Link href="/register">Get Started</Link>
                </Button>
              </div>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-white/98 backdrop-blur-xl border-t border-slate-100 px-4 py-4 space-y-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block text-sm font-semibold text-slate-600 hover:text-brand-600 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <p className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">More Services</p>
          <div className="grid grid-cols-2 gap-1">
            {SERVICES.map(({ key, slug, name, icon: Icon }) => (
              <Link
                key={key}
                href={`/services/${slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-brand-600 hover:bg-slate-50 transition-colors"
              >
                <Icon className="w-4 h-4 text-brand-600 shrink-0" aria-hidden />{name}
              </Link>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <InstallAppButton
              label="Install the App"
              className="w-full flex items-center justify-center gap-2 rounded-md border border-brand-200 bg-brand-50 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 transition-colors"
            />
            {hasSession ? (
              <Button size="sm" className="w-full bg-gold-600 hover:bg-gold-700 text-white font-semibold" asChild>
                <Link href="/dashboard"><LayoutDashboard className="w-4 h-4 mr-1.5" aria-hidden />Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button size="sm" className="w-full bg-gold-600 hover:bg-gold-700 text-white font-semibold" asChild>
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
