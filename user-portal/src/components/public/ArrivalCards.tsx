'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Plane } from 'lucide-react';
import { getPublicCountries } from '@/lib/api';
import { useHasSession } from '@/lib/useHasSession';
import { useBusinessInfo, whatsappHref } from '@/lib/business';
import type { Country } from '@/types';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const NOTES = [
  { title: 'What you need', text: 'Passport, flight number and your hotel address in the destination.' },
  { title: 'When to apply', text: 'Within 3 days before arrival. Earlier requests are scheduled and submitted on time.' },
  { title: 'What you get', text: 'Confirmation and QR code on WhatsApp and email.' },
];

/** Arrival-card countries from the live visa list, with a quick-apply card that prefills the apply form. */
export default function ArrivalCards() {
  const router = useRouter();
  const hasSession = useHasSession();
  const biz = useBusinessInfo();
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [countryId, setCountryId] = useState('');
  const [date, setDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  useEffect(() => {
    getPublicCountries()
      .then((r) => {
        const list = (r.data.data as Country[]).filter((c) => c.arrivalCard);
        setCountries(list);
        setCountryId((id) => id || list[0]?._id || '');
      })
      .catch(() => setCountries([]));
  }, []);

  const selected = countries?.find((c) => c._id === countryId);
  const price = selected?.arrivalCard?.price ?? null;
  const today = useMemo(() => isoDay(new Date()), []);

  const applyHref = (c: Country, extra = '') =>
    hasSession ? `/apply?country=${c._id}&visa=${c.arrivalCard!.visaId}${extra}` : '/register';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    router.push(applyHref(selected, `&date=${date}&adults=${adults}&children=${children}`));
  };

  return (
    <>
      <section className="bg-gradient-to-br from-brand-950 to-brand-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-center">
          <div>
            <p className="text-sm text-gold-300 mb-3"><Link href="/" className="hover:underline">Home</Link> / Arrival Cards</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">Digital Arrival Cards</h1>
            <p className="mt-4 text-white/80 text-lg max-w-xl">
              Mandatory for travellers to several countries. Submit up to 3 days before arrival, and we fill it correctly for you.
            </p>
            {price !== null && (
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-gold-400">{inr(price)}</span>
                <span className="text-white/70">per traveller</span>
              </p>
            )}
          </div>

          <form onSubmit={submit} className="rounded-2xl bg-white text-slate-900 p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-brand-950">Quick apply</h2>
            {countries === null ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : countries.length === 0 ? (
              <p className="text-sm text-slate-500">
                Arrival cards are not open online right now.{' '}
                <a href={whatsappHref(biz.phones[0] || '', 'Hi, I need an arrival card')} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
                  Message us on WhatsApp
                </a>.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs font-bold text-slate-700">Destination</span>
                  <select value={countryId} onChange={(e) => setCountryId(e.target.value)} required
                    className="mt-1 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    {countries.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-700">Arrival date</span>
                  <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required
                    className="mt-1 w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Adults</span>
                    <input type="number" min={1} max={10} value={adults} onChange={(e) => setAdults(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                      className="mt-1 w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Children</span>
                    <input type="number" min={0} max={9} value={children} onChange={(e) => setChildren(Math.max(0, Math.min(9, Number(e.target.value) || 0)))}
                      className="mt-1 w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
                  </label>
                </div>
                <button type="submit" className="w-full h-12 rounded-lg bg-brand-950 text-white font-bold hover:bg-brand-900">
                  Continue
                </button>
                <p className="text-[11px] text-slate-400">Adult price includes the service fee and GST. Your exact total is shown before you pay.</p>
              </>
            )}
          </form>
        </div>
      </section>

      {countries && countries.length > 0 && (
        <section className="py-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-extrabold text-brand-950 mb-8">All arrival cards</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {countries.map((c) => (
                <div key={c._id} className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                  <img src={`https://flagcdn.com/w80/${c.flag}.png`} alt="" className="h-9 mx-auto mb-3 rounded shadow-sm" />
                  <h3 className="text-lg font-bold text-brand-950">{c.name}</h3>
                  <p className="text-sm text-slate-500">{c.arrivalCard!.name}</p>
                  {c.arrivalCard!.price !== null && <p className="text-2xl font-extrabold text-brand-950 my-3">{inr(c.arrivalCard!.price)}</p>}
                  <Link href={applyHref(c)} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-950 px-4 py-2 text-sm font-bold text-brand-950 hover:bg-brand-950 hover:text-white transition-colors">
                    <Plane className="w-4 h-4" />Apply for Arrival Card
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-[#f4f2ee]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {NOTES.map((n) => (
            <div key={n.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold text-brand-950 mb-1.5">{n.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{n.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
