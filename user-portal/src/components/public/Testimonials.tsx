'use client';
import { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle, Loader2, Star } from 'lucide-react';
import api, { getPublicCountries } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Country } from '@/types';

interface Review {
  _id: string; name: string; city: string; rating: number; text: string; verified: boolean; createdAt: string;
  country?: { name: string; flag: string } | null; visaType?: { name: string } | null;
}

const Stars = ({ n, size = 'w-4 h-4' }: { n: number; size?: string }) => (
  <span className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= n ? 'fill-gold-500 text-gold-500' : 'text-slate-300'}`} />)}
  </span>
);

/** Approved, verified reviews with filters and load more, plus the moderated submit form. */
export default function Testimonials() {
  const [summary, setSummary] = useState<{ average: number; count: number } | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filters, setFilters] = useState({ country: '', rating: '', sort: 'newest' });
  const [items, setItems] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', city: '', applicationRef: '', rating: 0, text: '', consent: false, website: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/public/testimonials/summary').then((r) => setSummary(r.data.data)).catch(() => {});
    getPublicCountries().then((r) => setCountries(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/public/testimonials', { params: { ...filters, page } })
      .then((r) => { setItems((prev) => (page === 1 ? r.data.data.items : [...prev, ...r.data.data.items])); setHasMore(r.data.data.hasMore); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters, page]);

  const setFilter = (patch: Partial<typeof filters>) => { setPage(1); setFilters((f) => ({ ...f, ...patch })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.rating) { setError('Choose a star rating'); return; }
    setSending(true);
    try {
      const r = await api.post('/public/testimonials', form);
      setSent(r.data.message);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not send your review. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const input = 'mt-1 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm';

  return (
    <>
      <section className="bg-gradient-to-br from-brand-950 to-brand-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-400 mb-3">Customer reviews</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold">What travellers say</h1>
          {summary && summary.count > 0 ? (
            <div className="mt-5 flex items-center gap-3">
              <span className="text-4xl font-extrabold">{summary.average.toFixed(1)}</span>
              <span><Stars n={Math.round(summary.average)} size="w-5 h-5" /><span className="text-sm text-white/70">{summary.count} verified review{summary.count === 1 ? '' : 's'}</span></span>
            </div>
          ) : <p className="mt-4 text-white/80">Every review here comes from a customer whose visa we processed.</p>}
        </div>
      </section>

      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-6">
            <select aria-label="Country" value={filters.country} onChange={(e) => setFilter({ country: e.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
              <option value="">All countries</option>
              {countries.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select aria-label="Rating" value={filters.rating} onChange={(e) => setFilter({ rating: e.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
              <option value="">Any rating</option>
              {[5, 4, 3].map((n) => <option key={n} value={n}>{n} stars{n < 5 ? ' & up' : ''}</option>)}
            </select>
            <select aria-label="Sort" value={filters.sort} onChange={(e) => setFilter({ sort: e.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
              <option value="newest">Newest</option>
              <option value="highest">Highest rated</option>
            </select>
          </div>

          {!loading && items.length === 0 ? (
            <p className="py-12 text-center text-slate-500">No reviews match these filters yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map((t) => (
                <article key={t._id} className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col">
                  <Stars n={t.rating} />
                  <p className="mt-3 text-sm text-slate-700 leading-relaxed flex-1">{t.text}</p>
                  <div className="mt-4">
                    <p className="font-semibold text-brand-950 flex items-center gap-1.5">{t.name}{t.verified && <BadgeCheck className="w-4 h-4 text-green-600" aria-label="Verified customer" />}</p>
                    <p className="text-xs text-slate-500">{[t.city, [t.country?.name, t.visaType?.name].filter(Boolean).join(' · '), formatDate(t.createdAt)].filter(Boolean).join(' · ')}</p>
                  </div>
                </article>
              ))}
              {loading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          )}
          {hasMore && !loading && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-brand-950 px-5 py-2.5 text-sm font-bold text-brand-950 hover:bg-brand-950 hover:text-white">Load more</button>
            </div>
          )}
        </div>
      </section>

      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-[#f4f2ee]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-brand-950">Share your experience</h2>
          <p className="mt-2 text-slate-600">Reviews are for customers whose visa we got approved. We check each one before it goes live.</p>
          {sent ? (
            <p className="mt-6 flex items-center gap-2 rounded-xl bg-white border border-green-200 p-4 text-green-800"><CheckCircle className="w-5 h-5" />{sent}</p>
          ) : (
            <form onSubmit={submit} className="mt-6 rounded-2xl bg-white p-6 shadow-sm space-y-4">
              <input type="text" name="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-sm font-semibold text-slate-700">Name<input required minLength={2} maxLength={50} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} /></label>
                <label className="block text-sm font-semibold text-slate-700">City<input maxLength={40} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={input} /></label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">Application ID
                <input required placeholder="PRS-UNI-24817" value={form.applicationRef} onChange={(e) => setForm({ ...form, applicationRef: e.target.value.toUpperCase() })} className={input} />
              </label>
              <div>
                <p className="text-sm font-semibold text-slate-700">Rating</p>
                <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={form.rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setForm({ ...form, rating: n })}>
                      <Star className={`w-7 h-7 ${n <= form.rating ? 'fill-gold-500 text-gold-500' : 'text-slate-300'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm font-semibold text-slate-700">Your review
                <textarea required minLength={30} maxLength={800} rows={5} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm" />
                <span className="block text-right text-xs font-normal text-slate-400">{form.text.length}/800</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input type="checkbox" required checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-0.5 rounded" />
                I agree to Pravasa Transworld publishing my review with my first name and city.
              </label>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={sending} className="w-full h-12 rounded-lg bg-brand-950 text-white font-bold hover:bg-brand-900 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}Submit review
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
