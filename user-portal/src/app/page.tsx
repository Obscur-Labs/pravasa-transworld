import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import PromoPopup from '@/components/landing/PromoPopup';
import DestinationsExplorer from '@/components/landing/DestinationsExplorer';
import { JsonLd } from '@/components/seo/JsonLd';
import { ArrowRight } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'Visa Services Online: Apply for Tourist, Student & Work Visas',
  description:
    'Apply for your visa online with Pravasa Transworld. Expert immigration assistance for 50+ countries: tourist, student, work, and business visas. Real-time tracking, fast processing, transparent pricing.',
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: 'Pravasa Transworld | Apply for Your Visa Online',
    description:
      'Immigration made simple. Apply for tourist, student, work, or business visas for 50+ countries. Track your application in real time.',
    url: BASE_URL,
  },
  twitter: {
    title: 'Pravasa Transworld | Apply for Your Visa Online',
    description:
      'Immigration made simple. Apply for tourist, student, work, or business visas for 50+ countries. Track your application in real time.',
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Pravasa Transworld',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description:
    'Professional visa and immigration consultancy services for 50+ countries including tourist, student, work, and business visas.',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    availableLanguage: ['English', 'Hindi'],
  },
  areaServed: 'Worldwide',
  serviceType: 'Immigration and Visa Services',
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Pravasa Transworld',
  url: BASE_URL,
  description: 'Professional visa and immigration consultancy for 50+ countries.',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Visa Application & Immigration Services',
  provider: { '@type': 'Organization', name: 'Pravasa Transworld', url: BASE_URL },
  description:
    'End-to-end visa application processing for tourist, student, work, and business visas across 50+ countries.',
  areaServed: 'Worldwide',
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Visa Services',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Tourist Visa Processing' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Student Visa Processing' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Work Visa Processing' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Business Visa Processing' } },
    ],
  },
};

// Deliberately not async and fetching nothing: this page is static shell + SEO metadata,
// and DestinationsExplorer loads the country list in the browser. Rendering the list here
// would make Next prerender it at build time, so newly published countries would not show
// on the live site until the next deploy.
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={serviceSchema} />
      <Navbar />

      <DestinationsExplorer />

      {/* ── CTA ── */}
      <section className="py-14 px-4 bg-white border-t border-slate-100">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Ready to apply?</h2>
          <p className="text-slate-500 font-medium mb-6">Create a free account and track your visa in real time.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-brand-600/20 hover:scale-105 duration-200"
          >
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
      <PromoPopup />
    </div>
  );
}
