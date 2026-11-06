import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import PromoPopup from '@/components/landing/PromoPopup';
import HomeSections from '@/components/home/HomeSections';
import { JsonLd } from '@/components/seo/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'Visa Services Online: Apply for Tourist, Student & Work Visas',
  description:
    'Apply for your visa online with Pravasa Transworld. Expert immigration assistance for Indian travellers: tourist, student, work, and business visas. Real-time tracking, fast processing, transparent pricing.',
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: 'Pravasa Transworld | Apply for Your Visa Online',
    description:
      'Immigration made simple. Apply for tourist, student, work, or business visas for Indian travellers. Track your application in real time.',
    url: BASE_URL,
  },
  twitter: {
    title: 'Pravasa Transworld | Apply for Your Visa Online',
    description:
      'Immigration made simple. Apply for tourist, student, work, or business visas for Indian travellers. Track your application in real time.',
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Pravasa Transworld',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description:
    'Professional visa and immigration consultancy services for Indian travellers including tourist, student, work, and business visas.',
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
  description: 'Professional visa and immigration consultancy for Indian travellers.',
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
    'End-to-end visa application processing for tourist, student, work, and business visas across Indian travellers.',
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
// and HomeSections loads the country list in the browser. Rendering the list here
// would make Next prerender it at build time, so newly published countries would not show
// on the live site until the next deploy.
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={serviceSchema} />
      <Navbar />

      <HomeSections />

      <Footer />
      <PromoPopup />
    </div>
  );
}
