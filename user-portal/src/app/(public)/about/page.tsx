import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/landing/Hero';
import HowItWorks from '@/components/landing/HowItWorks';
import CountriesSlider from '@/components/landing/CountriesSlider';
import Benefits from '@/components/landing/Benefits';
import Testimonials from '@/components/landing/Testimonials';
import FAQ from '@/components/landing/FAQ';
import { JsonLd } from '@/components/seo/JsonLd';
import PromoPopup from '@/components/landing/PromoPopup';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'About Us: Immigration Made Simple',
  description:
    'Learn how Pravasa Transworld simplifies visa applications for 50+ countries: our process, benefits, and what travelers say about us.',
  alternates: {
    canonical: `${BASE_URL}/about`,
  },
  openGraph: {
    title: 'About Pravasa Transworld',
    description: 'Immigration made simple. See how our visa application process works.',
    url: `${BASE_URL}/about`,
  },
};

const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About Pravasa Transworld',
  url: `${BASE_URL}/about`,
  description:
    'Professional visa and immigration consultancy services for 50+ countries including tourist, student, work, and business visas.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-brand-950">
      <JsonLd data={aboutSchema} />
      <Navbar />
      <Hero />
      <HowItWorks />
      <CountriesSlider />
      <Benefits />
      <Testimonials />
      <FAQ />
      <Footer />
      <PromoPopup />
    </div>
  );
}
