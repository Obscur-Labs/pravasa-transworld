import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AboutContent from '@/components/public/AboutContent';
import { JsonLd } from '@/components/seo/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'About Us: Your Visa Partner from Surat',
  description:
    'Pravasa Transworld Pvt Ltd, Surat, Gujarat, helps Indian travellers get e-visas, Schengen visas and arrival cards online, with careful document checks and WhatsApp updates.',
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: 'About Pravasa Transworld',
    description: 'Your visa partner from Surat, Gujarat.',
    url: `${BASE_URL}/about`,
  },
};

const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About Pravasa Transworld',
  url: `${BASE_URL}/about`,
  description: 'Online visa, e-visa and arrival card services for Indian travellers, from Surat, Gujarat.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <JsonLd data={aboutSchema} />
      <Navbar />
      <section className="bg-gradient-to-br from-brand-950 to-brand-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-400 mb-3">About us</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight max-w-3xl">Your visa partner from Surat, Gujarat</h1>
          <p className="mt-5 text-lg text-white/80 max-w-2xl leading-relaxed">
            Pravasa Transworld Pvt Ltd helps Indian travellers get e-visas, Schengen visas and arrival cards online, with
            careful document checks and updates on WhatsApp.
          </p>
        </div>
      </section>
      <AboutContent />
      <Footer />
    </div>
  );
}
