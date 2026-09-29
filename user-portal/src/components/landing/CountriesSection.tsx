'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { getPublicCountries } from '@/lib/api';
import type { Country } from '@/types';
import { useHasSession } from '@/lib/useHasSession';

const FALLBACK_COUNTRIES: Country[] = [
  { _id: 'ca', name: 'Canada', flag: 'ca', description: 'Tourist, Student & Work visas', slug: undefined },
  { _id: 'us', name: 'United States', flag: 'us', description: 'Tourist, Student & Business visas', slug: undefined },
  { _id: 'gb', name: 'United Kingdom', flag: 'gb', description: 'Tourist, Student & Work visas', slug: undefined },
  { _id: 'au', name: 'Australia', flag: 'au', description: 'Tourist, Student & Work visas', slug: undefined },
  { _id: 'de', name: 'Germany', flag: 'de', description: 'Tourist, Student & Work visas', slug: undefined },
  { _id: 'fr', name: 'France', flag: 'fr', description: 'Tourist & Business visas', slug: undefined },
  { _id: 'jp', name: 'Japan', flag: 'jp', description: 'Tourist & Business visas', slug: undefined },
  { _id: 'ae', name: 'UAE', flag: 'ae', description: 'Tourist, Business & Work visas', slug: undefined },
];

export default function CountriesSection() {
  const hasSession = useHasSession();
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    getPublicCountries()
      .then((r) => {
        const data: Country[] = r.data.data;
        setCountries(data.length > 0 ? data.slice(0, 8) : FALLBACK_COUNTRIES);
      })
      .catch(() => setCountries(FALLBACK_COUNTRIES));
  }, []);

  const display = countries.length > 0 ? countries : FALLBACK_COUNTRIES;

  return (
    <section id="destinations" className="py-24 bg-gradient-to-b from-slate-50 via-brand-50/30 to-white relative overflow-hidden">
      <div className="absolute top-0 left-10 w-[400px] h-[400px] bg-brand-200/30 rounded-full blur-3xl pointer-events-none animate-float" />
      <div className="absolute bottom-0 right-10 w-[350px] h-[350px] bg-indigo-100/40 rounded-full blur-3xl pointer-events-none animate-float-reverse" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block glass-light glass-light-interactive text-brand-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 border border-brand-200/40 uppercase tracking-widest">
            Popular Destinations
          </span>
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Destinations We Support</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            We process visas for top destinations worldwide with unmatched speed and efficiency.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 mb-16">
          {display.map((c) => {
            const href = c.slug ? `/countries/${c.slug}` : '/countries';
            return (
              <Link
                key={c._id}
                href={href}
                className="glass-light rounded-3xl p-6 border border-white/70 shadow-sm hover:border-brand-300/40 hover:bg-white/95 hover:shadow-[0_20px_45px_rgba(48,149,192,0.08)] transition-all duration-300 group block"
              >
                <div className="relative overflow-hidden rounded-lg w-12 h-8 mb-4 border border-slate-100 shadow-sm transition-transform duration-300 group-hover:scale-110">
                  <img
                    src={`https://flagcdn.com/w40/${c.flag}.png`}
                    alt={c.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base mb-2 group-hover:text-brand-600 transition-colors">
                  {c.name}
                </h3>
                {c.description && (
                  <p className="text-xs text-slate-500 font-medium line-clamp-2">{c.description}</p>
                )}
              </Link>
            );
          })}
        </div>

        <div className="text-center flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            variant="outline"
            className="group border-brand-200 text-brand-600 hover:bg-brand-50 hover:border-brand-300 font-semibold"
          >
            <Link href="/countries">
              View All Destinations
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button
            asChild
            className="group bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-xl shadow-brand-500/10 hover:shadow-brand-500/20 hover:scale-105 transition-all duration-300 border-0"
          >
            <Link href={hasSession ? '/apply' : '/login'}>
              Apply Now
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
