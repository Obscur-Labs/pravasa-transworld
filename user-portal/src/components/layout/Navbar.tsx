'use client';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import InstallAppButton from '@/components/pwa/InstallAppButton';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-semibold text-slate-600 hover:text-brand-600 px-4 py-2 rounded-lg hover:bg-slate-50 transition-all duration-200"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <InstallAppButton
              iconOnly
              className="p-2 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            />
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

          <button
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            onClick={() => setOpen(!open)}
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
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <InstallAppButton
              label="Install the App"
              className="w-full flex items-center justify-center gap-2 rounded-md border border-brand-200 bg-brand-50 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 transition-colors"
            />
            <Button variant="outline" size="sm" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" className="w-full bg-gold-600 hover:bg-gold-700 text-white font-semibold" asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
