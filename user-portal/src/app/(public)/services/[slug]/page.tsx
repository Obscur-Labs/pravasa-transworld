import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, MessageCircle, Phone } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ServiceInquiryForm from '@/components/services/ServiceInquiryForm';
import { SERVICES, serviceBySlug } from '@/lib/services';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';
const PHONE = '+91 84693 24000';
const PHONE_DIGITS = '918469324000';

const STEPS = [
  ['Share your plan', 'Fill in the form. It takes about a minute.'],
  ['Get options', 'We send quotes on WhatsApp, usually within a few working hours.'],
  ['Confirm and go', 'Pick what suits you and we take care of the booking.'],
];

export const dynamicParams = false;
export const generateStaticParams = () => SERVICES.map((s) => ({ slug: s.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const service = serviceBySlug((await params).slug);
  if (!service) return {};
  const url = `${BASE_URL}/services/${service.slug}`;
  return {
    title: service.name,
    description: service.description,
    alternates: { canonical: url },
    openGraph: { title: `${service.name} | Pravasa Transworld`, description: service.description, url },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const service = serviceBySlug((await params).slug);
  if (!service) notFound();
  const Icon = service.icon;
  const others = SERVICES.filter((s) => s.key !== service.key);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 border border-brand-100">
            <Icon className="h-7 w-7 text-brand-600" aria-hidden />
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{service.title}</h1>
          <p className="mt-4 text-slate-500 font-medium max-w-xl mx-auto text-[15px] leading-relaxed">{service.tagline}</p>
        </div>
      </section>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-8 items-start">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 shadow-[0_20px_50px_rgba(11,46,61,0.04)]">
            <ServiceInquiryForm serviceKey={service.key} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <h2 className="font-extrabold text-slate-900">Why book with us</h2>
              <ul className="mt-3 space-y-2.5">
                {service.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm font-semibold text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{h}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <h2 className="font-extrabold text-slate-900">How it works</h2>
              <ol className="mt-3 space-y-3">
                {STEPS.map(([title, body], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{title}</p>
                      <p className="text-xs font-medium text-slate-500">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-3xl bg-brand-900 p-6 text-white">
              <h2 className="font-extrabold">Prefer to talk?</h2>
              <p className="mt-1 text-sm text-brand-100">Call or message us and we will sort it out with you.</p>
              <div className="mt-4 flex flex-col gap-2">
                <a href={`tel:+${PHONE_DIGITS}`} className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-bold hover:bg-white/20">
                  <Phone className="h-4 w-4" />{PHONE}
                </a>
                <a href={`https://wa.me/${PHONE_DIGITS}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-gold-600 py-2.5 text-sm font-bold hover:bg-gold-700">
                  <MessageCircle className="h-4 w-4" />WhatsApp us
                </a>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-12">
          <h2 className="text-center text-xs font-bold uppercase tracking-widest text-slate-400">More services</h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {others.map((s) => {
              const OtherIcon = s.icon;
              return (
                <Link key={s.key} href={`/services/${s.slug}`}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm transition-colors hover:border-brand-200">
                  <OtherIcon className="h-5 w-5 text-brand-600" aria-hidden />
                  <span className="text-sm font-bold text-slate-700">{s.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
