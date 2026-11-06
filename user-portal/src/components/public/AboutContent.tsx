'use client';
import { useEffect, useState } from 'react';
import { BadgeCheck, IndianRupee, MessageCircle } from 'lucide-react';
import OfficeMap from './OfficeMap';
import { getPublicCountries } from '@/lib/api';
import { telHref, useBusinessInfo } from '@/lib/business';
import type { Country } from '@/types';

const REASONS = [
  { icon: BadgeCheck, title: 'Document check first', text: 'Our team verifies every document before it reaches the embassy.' },
  { icon: IndianRupee, title: 'Clear prices', text: 'Service fee and GST shown upfront. No hidden charges.' },
  { icon: MessageCircle, title: 'WhatsApp updates', text: 'Know exactly where your application is, every day.' },
];

/** Everything below the About hero: live counts, why us, and the office with its map. */
export default function AboutContent() {
  const biz = useBusinessInfo();
  const [countries, setCountries] = useState<Country[] | null>(null);

  useEffect(() => {
    getPublicCountries().then((r) => setCountries(r.data.data)).catch(() => setCountries([]));
  }, []);

  const arrival = countries?.filter((c) => c.arrivalCard) ?? [];
  const named = (countries ?? []).filter((c) => !c.arrivalCard).slice(0, 4).map((c) => c.name);
  const stats = [
    { value: countries ? String(countries.length) : '...', label: 'Live destinations' },
    { value: countries ? String(arrival.length) : '...', label: 'Arrival card countries' },
    { value: biz.businessHours, label: 'Office hours', small: true },
    { value: 'UPI', label: 'Simple payment' },
  ];

  return (
    <>
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-extrabold text-brand-950 mb-5">What we do</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              We prepare and submit visa applications for {countries ? countries.length : 'our'} live destinations
              {named.length ? <> including {named.join(', ')}</> : null}
              {arrival.length ? <>, plus digital arrival cards for {arrival.map((c) => c.name).join(', ')}</> : null}.
              We also help with flights, hotels, travel insurance and forex.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Every file is checked by our team before submission, so mistakes are caught early.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <p className={`font-extrabold text-brand-950 ${'small' in s ? 'text-base sm:text-lg' : 'text-2xl sm:text-3xl'}`}>{s.value}</p>
                <p className="text-sm text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-[#f4f2ee]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-extrabold text-brand-950 mb-8">Why Pravasa</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {REASONS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <Icon className="w-6 h-6 text-gold-600 mb-3" aria-hidden />
                <h3 className="text-lg font-bold text-brand-950 mb-1.5">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-extrabold text-brand-950 mb-4">Visit our office</h2>
            <p className="font-semibold text-slate-900 mb-3">{biz.address}</p>
            <p className="text-slate-600">
              {biz.phones.map((p, i) => (
                <span key={p}>{i > 0 && ' · '}<a href={telHref(p)} className="hover:underline">{p}</a></span>
              ))}
            </p>
            <p className="text-slate-600"><a href={`mailto:${biz.email}`} className="hover:underline">{biz.email}</a></p>
            <p className="text-slate-600">{biz.businessHours}</p>
          </div>
          <OfficeMap className="h-72" />
        </div>
      </section>
    </>
  );
}
