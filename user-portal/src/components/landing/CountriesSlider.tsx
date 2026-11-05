'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getPublicCountries } from '@/lib/api';
import type { Country } from '@/types';

export default function CountriesSlider() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getPublicCountries().then((r) => setCountries(r.data.data));
  }, []);

  const count = countries.length;
  const maxIndex = Math.max(0, count - 3);

  const next = () => setCurrent((i) => (i >= maxIndex ? 0 : i + 1));
  const prev = () => setCurrent((i) => (i <= 0 ? maxIndex : i - 1));

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (count > 3) timerRef.current = setInterval(next, 4000);
  };

  useEffect(() => {
    if (count <= 3) return;
    timerRef.current = setInterval(next, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [count]);

  const handlePrev = () => { prev(); resetTimer(); };
  const handleNext = () => { next(); resetTimer(); };

  if (count === 0) return null;

  const countryHref = (c: Country) =>
    c.slug ? `/countries/${c.slug}` : `/countries/${c._id}`;

  return (
    <section id="destinations" className="py-24 bg-gradient-to-b from-brand-900 to-brand-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <span className="inline-block glass text-brand-200 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              Destinations
            </span>
            <h2 className="text-4xl font-bold text-white">Popular Destinations</h2>
            <p className="text-brand-300 mt-2 text-lg">We process visas for top destinations worldwide.</p>
          </div>
          {count > 3 && (
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="glass w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="glass w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Slider track */}
        <div className="overflow-hidden rounded-2xl">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${current * 33.333}%)` }}
          >
            {countries.map((c) => (
              <div key={c._id} className="w-1/3 flex-none px-3">
                <Link href={countryHref(c)} className="block h-full">
                  <div className="glass rounded-2xl p-7 group hover:bg-white/15 transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full">
                    <div className="flex items-start justify-between mb-5">
                      {c.images?.[0] ? (
                        <div className="w-16 h-11 rounded-xl overflow-hidden shadow-lg">
                          <img src={c.images[0]} alt={c.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <img
                          src={`https://flagcdn.com/w80/${c.flag}.png`}
                          alt={c.name}
                          className="w-16 h-11 object-cover rounded-xl shadow-lg"
                        />
                      )}
                      <div className="glass rounded-lg w-9 h-9 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{c.name}</h3>
                    {c.description && (
                      <p className="text-sm text-brand-300 leading-relaxed line-clamp-2">{c.description}</p>
                    )}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <span className="text-sm text-brand-300 hover:text-white font-medium transition-colors flex items-center gap-1 group-hover:gap-2">
                        View Visa Details <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        {count > 3 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: maxIndex + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrent(i); resetTimer(); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200"
          >
            Browse All Destinations <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
