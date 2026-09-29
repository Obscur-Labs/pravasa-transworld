'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { getPublicCountryBySlug } from '@/lib/api';
import { useVisaConfigLabels } from '@/lib/useVisaConfigLabels';
import type { Country, VisaType } from '@/types';
import {
  ArrowRight, ChevronRight, ChevronLeft, Clock, Shield, Globe, CreditCard,
  Loader2, ArrowLeft, ChevronDown, BadgeCheck, Landmark,
} from 'lucide-react';

interface PageData { country: Country; visaTypes: VisaType[] }

const CAT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  tourist:  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  business: { bg: 'bg-brand-50',    text: 'text-brand-700',    dot: 'bg-brand-500'    },
  student:  { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
  transit:  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
};

/* ─── Image Slider ─── */
function ImageSlider({ images, country }: { images: string[]; country: Country }) {
  const [cur, setCur] = useState(0);
  const flagUrl = `https://flagcdn.com/w160/${country.flag}.png`;

  if (images.length === 0) {
    return (
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-brand-50 aspect-[16/9] flex items-center justify-center border border-slate-100">
        <img src={flagUrl} alt={country.name} className="w-32 h-auto object-contain opacity-40" />
      </div>
    );
  }

  const prev = () => setCur((c) => (c === 0 ? images.length - 1 : c - 1));
  const next = () => setCur((c) => (c === images.length - 1 ? 0 : c + 1));

  return (
    <div className="relative rounded-2xl overflow-hidden aspect-[16/9] bg-slate-100 shadow-md group">
      {/* Images */}
      <div className="relative w-full h-full">
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${country.name} ${i + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === cur ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
      </div>

      {/* Gradient overlay bottom */}
      <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

      {/* Arrows (only if >1) */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
          >
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCur(i)}
                className={`rounded-full transition-all duration-300 ${i === cur ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── FAQ Accordion ─── */
function FAQAccordion({ faqs }: { faqs: { question: string; answer: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (!faqs.length) return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-slate-800 text-base">Frequently Asked Questions</h3>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">{faqs.length} question{faqs.length !== 1 ? 's' : ''} answered</p>
        </div>
        <span className="text-xs bg-brand-50 text-brand-600 font-bold px-2.5 py-1 rounded-full border border-brand-100">
          FAQ
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-slate-50">
        {faqs.map((faq, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className={isOpen ? 'bg-brand-50/30' : ''}>
              <button
                className="w-full text-left px-6 py-4 flex items-start justify-between gap-4 hover:bg-slate-50/60 transition-colors group"
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center mt-0.5 transition-colors ${
                    isOpen ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-600'
                  }`}>
                    {i + 1}
                  </span>
                  <span className={`font-semibold text-sm leading-snug transition-colors ${isOpen ? 'text-brand-700' : 'text-slate-800'}`}>
                    {faq.question}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-all duration-200 ${
                  isOpen ? 'rotate-180 text-brand-500' : 'text-slate-300 group-hover:text-slate-400'
                }`} />
              </button>

              {/* Answer, smooth height with max-height trick */}
              <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-6 pb-5 pl-[3.75rem]">
                  <p className="text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Visa Info Dot Grid ─── */
const DOT_COLORS = ['bg-brand-500', 'bg-brand-500', 'bg-brand-500', 'bg-emerald-500', 'bg-orange-400'];

function VisaInfoGrid({ vt }: { vt: VisaType }) {
  const { labelFor } = useVisaConfigLabels();
  const items = [
    { label: 'Visa Type', value: labelFor('visaSubType', vt.visaSubType) },
    { label: 'Length of Stay', value: vt.stayDuration || '-' },
    { label: 'Entry', value: vt.entry?.map((e) => labelFor('entryType', e)).join(' / ') || '-' },
    { label: 'Validity', value: vt.validity || '-' },
    { label: 'Processing', value: vt.processingTime || '-' },
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
        <h3 className="font-extrabold text-slate-800 text-base">Visa Information</h3>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">Based on: {vt.name}</p>
      </div>
      <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-5">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-start gap-2.5">
            <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${DOT_COLORS[i]}`} />
            <div>
              <p className="text-xs text-slate-400 font-medium leading-none mb-1">{item.label}:</p>
              <p className="text-sm font-extrabold text-slate-800">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function CountryDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedVt, setSelectedVt] = useState(0);

  useEffect(() => {
    if (!slug) return;
    getPublicCountryBySlug(slug)
      .then((r) => setData(r.data.data))
      .catch((err) => { if (err.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (data) {
      document.title = `${data.country.name} Visa | Pravasa Transworld`;
    }
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <Globe className="w-12 h-12 text-slate-200" />
          <p className="text-2xl font-extrabold text-slate-800">Destination not found</p>
          <p className="text-slate-500">This country isn't on our website yet.</p>
          <Link href="/countries" className="inline-flex items-center gap-2 text-brand-600 font-semibold hover:underline">
            <ArrowLeft className="w-4 h-4" /> All destinations
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { country, visaTypes } = data;
  const wc = country.webContent;
  const images = country.images ?? [];
  const vt = visaTypes[selectedVt];
  const faqs = wc?.faqs ?? [];

  // Visa fee + VFS fee + service fee, with 18% GST on the service fee only (visa + VFS are
  // untaxed), matches what is charged at checkout.
  const adultTotal = vt ? vt.adultPrice + (vt.adultVfsFee || 0) + (vt.adultServiceFee || 0) + Math.round((vt.adultServiceFee || 0) * 0.18) : 0;
  const childTotal = vt ? (vt.childPrice || 0) + (vt.childVfsFee || 0) + (vt.childServiceFee || 0) + Math.round((vt.childServiceFee || 0) * 0.18) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* ── Page Header ── */}
      <div className="relative overflow-hidden bg-white border-b border-slate-100">
        {/* Faint world map watermark */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <svg className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] opacity-[0.04] text-brand-600" viewBox="0 0 1000 500" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="500" cy="250" rx="490" ry="240" stroke="currentColor" strokeWidth="8"/>
            <line x1="10" y1="250" x2="990" y2="250" stroke="currentColor" strokeWidth="4"/>
            <line x1="500" y1="10" x2="500" y2="490" stroke="currentColor" strokeWidth="4"/>
            <ellipse cx="500" cy="250" rx="250" ry="240" stroke="currentColor" strokeWidth="4"/>
            <ellipse cx="500" cy="250" rx="490" ry="120" stroke="currentColor" strokeWidth="3"/>
          </svg>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-4">
            <Link href="/" className="hover:text-brand-600 transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/countries" className="hover:text-brand-600 transition-colors">Destinations</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-600">{country.name}</span>
          </nav>

          <div className="flex items-center gap-4">
            <div className="relative w-14 h-10 rounded-lg overflow-hidden shadow-md border border-slate-100 flex-shrink-0">
              <img src={`https://flagcdn.com/w80/${country.flag}.png`} alt={country.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-none">{country.name}</h1>
              <p className="text-sm font-semibold text-slate-400 mt-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Visa
                {wc?.heroTagline && <span className="text-slate-300 mx-1">·</span>}
                {wc?.heroTagline && <span className="text-slate-500 font-medium">{wc.heroTagline}</span>}
              </p>
            </div>
          </div>

          {/* Highlights */}
          {wc?.highlights && wc.highlights.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {wc.highlights.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-brand-50 text-brand-700 font-semibold px-3 py-1 rounded-full border border-brand-100">
                  <BadgeCheck className="w-3 h-3" /> {h}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Slider */}
            <ImageSlider images={images} country={country} />

            {/* Visa Info Grid */}
            {vt && <VisaInfoGrid vt={vt} />}

            {/* Overview */}
            {wc?.overview && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 text-base">{country.name} Overview</h3>
                </div>
                <div className="px-6 py-5">
                  <p className="text-slate-600 leading-relaxed text-[15px]">{wc.overview}</p>
                </div>
              </div>
            )}

            {/* Requirements */}
            {wc?.requirements && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 text-base">Visa Requirements</h3>
                </div>
                <div className="px-6 py-5">
                  <p className="text-slate-600 leading-relaxed text-[15px] whitespace-pre-line">{wc.requirements}</p>
                </div>
              </div>
            )}

            {/* Processing & Tips */}
            {(wc?.processingInfo || wc?.tips) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {wc?.processingInfo && (
                  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-brand-600" />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-sm">Processing</h3>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{wc.processingInfo}</p>
                  </div>
                )}
                {wc?.tips && (
                  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                        <Landmark className="w-4 h-4 text-amber-600" />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-sm">Pro Tips</h3>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{wc.tips}</p>
                  </div>
                )}
              </div>
            )}

            {/* FAQ */}
            {faqs.length > 0 && <FAQAccordion faqs={faqs} />}

            {/* Empty state */}
            {!wc?.overview && !wc?.requirements && !wc?.processingInfo && !wc?.tips && faqs.length === 0 && images.length === 0 && (
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-10 text-center">
                <Globe className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">Detailed information coming soon.</p>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">

            {/* Available Visa Types */}
            {visaTypes.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                  <h3 className="font-extrabold text-slate-800 text-sm">Available Visa</h3>
                </div>
                <div className="p-3 space-y-2">
                  {visaTypes.map((v, i) => {
                    const cat = CAT_COLORS[v.visaCategory] ?? CAT_COLORS.tourist;
                    const isSelected = i === selectedVt;
                    return (
                      <button
                        key={v._id}
                        onClick={() => setSelectedVt(i)}
                        className={`w-full text-left p-3 rounded-xl border transition-all duration-150 ${
                          isSelected
                            ? 'border-brand-200 bg-brand-50/60 shadow-sm'
                            : 'border-slate-100 hover:border-brand-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <Globe className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-brand-600' : 'text-slate-400'}`} />
                          <div>
                            <p className={`text-sm font-extrabold ${isSelected ? 'text-brand-700' : 'text-slate-800'}`}>{v.name}</p>
                            {v.description && (
                              <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">{v.description}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pricing Plans */}
            {vt && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <h3 className="font-extrabold text-slate-800 text-sm">Pricing Plans</h3>
                </div>
                <div className="p-5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Standard (Per Adult)</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-brand-600">Total</span>
                    <span className="text-base font-extrabold text-brand-600">₹{adultTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium text-right">Inclusive of 18% GST</p>
                  {vt.childPrice > 0 && childTotal !== adultTotal && (
                    <p className="text-xs text-slate-400 mt-3 font-medium">
                      Child price: ₹{childTotal.toLocaleString('en-IN')} per child
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Apply CTA */}
            <div className="space-y-3">
              <Link
                href="/register"
                className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-extrabold text-sm px-5 py-3.5 rounded-2xl w-full transition-all shadow-lg shadow-brand-600/20"
              >
                Start Application <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium">
                <Shield className="w-3.5 h-3.5" />
                100% Secure &amp; Guaranteed
              </div>
            </div>

            {/* Already have account */}
            <p className="text-center text-xs text-slate-400 font-medium">
              Already have an account?{' '}
              <Link href="/login" className="text-brand-600 font-semibold hover:underline">Sign in</Link>
            </p>
          </div>

        </div>

        {/* Bottom nav */}
        <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between">
          <Link href="/countries" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 font-semibold text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> All Destinations
          </Link>
          <Link href="/register" className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors">
            Apply for {country.name} Visa <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
