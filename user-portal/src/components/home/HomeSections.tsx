'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Clock, MessageCircle, Phone, Plane, Search } from 'lucide-react';
import { getPublicCountries } from '@/lib/api';
import { useHasSession } from '@/lib/useHasSession';
import { telHref, useBusinessInfo, whatsappHref } from '@/lib/business';
import type { Country } from '@/types';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const countryHref = (c: Country) => `/countries/${c.slug || c._id}`;
// The four the client sells most; anything missing is filled from the rest of the list.
const POPULAR = [/dubai|emirates|uae/i, /vietnam/i, /france|schengen/i, /turkey|t[uü]rkiye/i];

const STEPS = [
  { title: 'Choose visa', text: 'Pick the country, visa type and Normal or Express.' },
  { title: 'Upload documents', text: 'Passport front, back and photo, straight from your phone.' },
  { title: 'Pay by UPI', text: 'Pay securely and upload the UTR or a screenshot.' },
  { title: 'Get visa on WhatsApp', text: 'Track every stage live and receive your visa PDF.' },
];

export default function HomeSections() {
  const router = useRouter();
  const hasSession = useHasSession();
  const biz = useBusinessInfo();
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getPublicCountries().then((r) => setCountries(r.data.data)).catch(() => setCountries([]));
  }, []);

  const visas = useMemo(() => (countries ?? []).filter((c) => !c.arrivalCard), [countries]);
  const arrival = useMemo(() => (countries ?? []).filter((c) => c.arrivalCard), [countries]);
  const popular = useMemo(() => {
    const picked = POPULAR.map((re) => visas.find((c) => re.test(c.name))).filter((c): c is Country => !!c);
    const rest = visas.filter((c) => !picked.includes(c) && c.fromPrice);
    return [...picked, ...rest].slice(0, 4);
  }, [visas]);
  const phone = biz.phones[0] || '';

  const checkPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    const match = (countries ?? []).find((c) => c.name.toLowerCase() === q) || (countries ?? []).find((c) => c.name.toLowerCase().includes(q));
    router.push(q && match ? countryHref(match) : '/countries');
  };

  return (
    <>
      <section className="bg-gradient-to-b from-[#f4f2ee] to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10 sm:pt-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold-600 mb-3">Trusted visa partner · Surat</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-950 leading-tight">
              Dubai &amp; Vietnam e-Visa in <span className="text-gold-600">3–5 days</span>
            </h1>
            <p className="mt-4 text-lg text-slate-600 max-w-xl">
              Apply online in 10 minutes. Upload your passport, pay by UPI and track every step on WhatsApp. No office visit needed.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link href={hasSession ? '/apply' : '/register'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-950 px-6 py-3.5 font-bold text-white hover:bg-brand-900">
                Apply now <ArrowRight className="w-4 h-4" />
              </Link>
              <a href={whatsappHref(phone, 'Hi, I want to apply for a visa')} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3.5 font-bold text-white hover:bg-green-700">
                <MessageCircle className="w-4 h-4" />Chat on WhatsApp
              </a>
            </div>
            {popular.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                {popular.slice(0, 2).filter((c) => c.fromPrice).map((c) => (
                  <li key={c._id} className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" />{c.name} from <b className="text-slate-900">{inr(c.fromPrice!)}</b></li>
                ))}
                <li className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" />Pay by UPI</li>
              </ul>
            )}
          </div>
          <div className="relative hidden lg:block h-80 rounded-3xl bg-gradient-to-br from-brand-950 to-brand-700 overflow-hidden" aria-hidden>
            <Plane className="absolute right-8 top-8 w-10 h-10 text-gold-400" />
            <div className="absolute left-8 top-10 w-64 rounded-xl bg-white p-4 shadow-xl">
              <p className="text-[11px] text-slate-400">Your application</p>
              <p className="font-bold text-brand-950">e-Visa · 30 Days</p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full w-3/4 rounded-full bg-gold-600" /></div>
              <p className="mt-2 flex gap-3 text-[11px] text-slate-500"><span>✓ Paid</span><span>✓ Docs verified</span><span className="text-gold-700 font-semibold">At embassy</span></p>
            </div>
            <div className="absolute right-8 bottom-8 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-xl">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600"><Check className="w-4 h-4" /></span>
              <span><b className="block text-sm text-brand-950">Visa approved</b><span className="text-[11px] text-slate-400">Sent on WhatsApp</span></span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <form onSubmit={checkPrice} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm items-end">
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Where are you going?</span>
              <span className="relative mt-1 block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input list="home-destinations" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Dubai, Vietnam, France..."
                  className="w-full h-11 rounded-lg border border-slate-200 pl-9 pr-3 text-sm" />
              </span>
              <datalist id="home-destinations">{(countries ?? []).map((c) => <option key={c._id} value={c.name} />)}</datalist>
            </label>
            <button type="submit" className="h-11 rounded-lg bg-brand-950 px-6 font-bold text-white hover:bg-brand-900">Check price</button>
          </form>
        </div>
      </section>

      <section className="py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gold-600 mb-2">Popular destinations</p>
              <h2 className="text-3xl font-extrabold text-brand-950">Most-applied visas</h2>
            </div>
            <Link href="/countries" className="shrink-0 rounded-lg border border-brand-950 px-4 py-2 text-sm font-bold text-brand-950 hover:bg-brand-950 hover:text-white">
              View all countries
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {countries === null
              ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-slate-100 animate-pulse" />)
              : popular.map((c) => (
                <div key={c._id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
                  <div className="h-24 bg-gradient-to-br from-brand-950 to-brand-700 flex items-end p-4 gap-2">
                    <img src={`https://flagcdn.com/w40/${c.flag}.png`} alt="" className="h-5 rounded-sm" />
                    <span className="font-bold text-white">{c.name}</span>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    {c.fromPrice ? <p className="text-sm text-slate-500">from <b className="text-2xl text-brand-950">{inr(c.fromPrice)}</b></p> : <p className="text-sm text-slate-500">Price on request</p>}
                    {c.processingTime && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock className="w-3.5 h-3.5" />{c.processingTime}</p>}
                    <Link href={countryHref(c)} className="mt-auto pt-4">
                      <span className="block rounded-lg bg-brand-950 py-2.5 text-center text-sm font-bold text-white hover:bg-brand-900">Apply now</span>
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-[#f4f2ee]">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-gold-600 mb-2">How it works</p>
          <h2 className="text-center text-3xl font-extrabold text-brand-950 mb-8">Your visa in 4 simple steps</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-950 font-bold text-gold-400">{i + 1}</span>
                <h3 className="font-bold text-brand-950">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {arrival.length > 0 && (
        <section className="py-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gold-600 mb-2">Arrival cards</p>
              <h2 className="text-3xl font-extrabold text-brand-950">{arrival.map((c) => c.name).join(', ')} arrival cards</h2>
              <p className="mt-3 text-slate-600">We fill and submit your digital arrival card correctly so you skip the airport queue.</p>
              <Link href="/arrival-cards" className="mt-5 inline-flex rounded-lg bg-gold-600 px-5 py-3 font-bold text-white hover:bg-gold-700">Apply for arrival card</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {arrival.map((c) => (
                <Link key={c._id} href="/arrival-cards" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-300">
                  <img src={`https://flagcdn.com/w40/${c.flag}.png`} alt="" className="h-6 rounded-sm" />
                  <span>
                    <b className="block text-sm text-brand-950">{c.name}</b>
                    {c.arrivalCard?.price ? <span className="text-xs text-slate-500">{inr(c.arrivalCard.price)}</span> : null}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-brand-950 text-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">Questions? Talk to a visa expert.</h2>
            <p className="mt-1 text-white/70">{biz.businessHours}{phone ? ` · ${phone}` : ''}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href={whatsappHref(phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-bold hover:bg-green-700">
              <MessageCircle className="w-4 h-4" />Chat on WhatsApp
            </a>
            <a href={telHref(phone)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-600 px-5 py-3 font-bold hover:bg-gold-700">
              <Phone className="w-4 h-4" />Call now
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
