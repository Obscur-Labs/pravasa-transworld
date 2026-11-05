'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Clock, MapPin, ArrowRight, MessageCircle } from 'lucide-react';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import { getPublicCountries } from '@/lib/api';
import { useHasSession } from '@/lib/useHasSession';
import { useVisaConfigLabels } from '@/lib/useVisaConfigLabels';
import { useBusinessInfo, whatsappHref } from '@/lib/business';
import { formatCurrency } from '@/lib/utils';
import type { Country } from '@/types';

const PAGE_SIZE = 12;
type Sort = 'name' | 'price-asc' | 'price-desc';

/**
 * Every country live on the website, with search, visa-kind chips, sorting and
 * "load more". Fetched in the browser so a country switched on in the admin shows
 * up without a redeploy.
 */
export default function CountryListing() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [shown, setShown] = useState(PAGE_SIZE);
  const { labelFor } = useVisaConfigLabels();
  const biz = useBusinessInfo();

  const fetchCountries = () => {
    setLoading(true);
    setFailed(false);
    getPublicCountries()
      .then((r) => setCountries(r.data.data as Country[]))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(fetchCountries, []);

  const kinds = useMemo(
    () => [...new Set(countries.flatMap((c) => c.visaSubTypes || []))].sort(),
    [countries],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = countries.filter((c) =>
      (!q || c.name.toLowerCase().includes(q)) && (!kind || (c.visaSubTypes || []).includes(kind)));
    const price = (c: Country) => c.fromPrice ?? Number.POSITIVE_INFINITY;
    return [...list].sort((a, b) =>
      sort === 'price-asc' ? price(a) - price(b)
        : sort === 'price-desc' ? (b.fromPrice ?? -1) - (a.fromPrice ?? -1)
        : a.name.localeCompare(b.name));
  }, [countries, search, kind, sort]);

  // A new filter starts the list from the top again.
  useEffect(() => setShown(PAGE_SIZE), [search, kind, sort]);

  const chip = (value: string, label: string) => (
    <button key={value || 'all'} type="button" onClick={() => setKind(value)} aria-pressed={kind === value}
      className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
        kind === value ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
      }`}>
      {label}
    </button>
  );

  return (
    <>
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <nav className="text-sm font-semibold text-gold-700 mb-4" aria-label="Breadcrumb">
            <Link href="/" className="hover:underline">Home</Link> <span className="text-slate-300">/</span> Countries
          </nav>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-900 tracking-tight">All destinations</h1>
          <p className="mt-3 text-slate-500 font-medium max-w-2xl text-[15px] leading-relaxed">
            Every country we process visas and arrival cards for, with the starting price per adult (service fee and GST included) and the usual processing time.
          </p>

          <div className="mt-8 flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
              <input type="search" placeholder="Search a country..." value={search} aria-label="Search countries"
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 text-sm font-medium" />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 md:ml-auto">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-400/40">
                <option value="name">Name A to Z</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </label>
          </div>
          {kinds.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {chip('', 'All')}
              {kinds.map((k) => chip(k, labelFor('visaSubType', k, k)))}
            </div>
          )}
        </div>
      </section>

      <section className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {loading ? (
          <CardGridSkeleton count={8} className="xl:grid-cols-4" />
        ) : failed ? (
          <div className="text-center py-20">
            <p className="text-slate-500 font-semibold">We could not load the destinations.</p>
            <button type="button" onClick={fetchCountries} className="mt-3 text-sm font-bold text-brand-900 underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-4" aria-hidden />
            <p className="text-slate-500 font-semibold text-lg">
              {search || kind ? 'No destinations match your filters.' : 'No destinations are live yet.'}
            </p>
            <p className="text-sm text-slate-400 mt-1">Ask us on WhatsApp, we may still be able to help.</p>
            <div className="mt-4 flex justify-center gap-3">
              {(search || kind) && (
                <button type="button" onClick={() => { setSearch(''); setKind(''); }} className="text-sm font-bold text-brand-900 underline">Clear filters</button>
              )}
              {biz.phones[0] && (
                <a href={whatsappHref(biz.phones[0])} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-green-700">
                  <MessageCircle className="w-4 h-4" /> WhatsApp us
                </a>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 font-medium mb-5">
              {filtered.length} destination{filtered.length === 1 ? '' : 's'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.slice(0, shown).map((c) => <CountryCard key={c._id} country={c} />)}
            </div>
            {shown < filtered.length && (
              <div className="mt-8 text-center">
                <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)}
                  className="px-6 py-3 rounded-xl border-2 border-brand-900 text-brand-900 font-bold text-sm hover:bg-brand-50">
                  Load more ({filtered.length - shown} more)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

function CountryCard({ country }: { country: Country }) {
  const hasSession = useHasSession();
  const detailsHref = `/countries/${country.slug || country._id}`;
  const applyHref = hasSession ? `/apply?country=${country._id}` : '/register';
  const coverImage = country.images?.[0];

  return (
    <div className="h-full rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:border-gold-200 transition-all duration-300 overflow-hidden flex flex-col">
      <Link href={detailsHref} className="group block">
        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-brand-900 to-brand-800">
          {coverImage ? (
            <img src={coverImage} alt={country.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <img src={`https://flagcdn.com/w160/${country.flag}.png`} alt="" loading="lazy" className="w-20 h-auto object-contain opacity-90" />
            </div>
          )}
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2">
            <span className="rounded overflow-hidden w-8 h-5 shadow border border-white/60">
              <img src={`https://flagcdn.com/w40/${country.flag}.png`} alt="" className="w-full h-full object-cover" />
            </span>
            <span className="text-white font-extrabold text-base drop-shadow">{country.name}</span>
          </div>
        </div>
      </Link>
      <div className="p-4 flex-1 flex flex-col">
        <p className="text-xs text-slate-500 font-medium">
          {country.visaTypeCount ? `${country.visaTypeCount} visa type${country.visaTypeCount === 1 ? '' : 's'}` : 'Visa details'}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {country.fromPrice != null
            ? <>from <span className="text-xl font-extrabold text-brand-900">{formatCurrency(country.fromPrice)}</span> <span className="text-xs">per adult</span></>
            : <span className="font-semibold text-slate-700">Price on request</span>}
        </p>
        {country.processingTime && (
          <p className="mt-1 text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" aria-hidden />{country.processingTime}</p>
        )}
        <div className="pt-4 flex items-center gap-2 mt-auto">
          <Link href={applyHref} className="flex-1 text-center rounded-lg bg-brand-900 hover:bg-brand-800 text-white text-sm font-bold py-2 transition-colors">
            Apply now
          </Link>
          <Link href={detailsHref} className="inline-flex items-center gap-1 text-sm font-bold text-brand-900 hover:underline px-2" aria-label={`${country.name} visa details`}>
            Details <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
