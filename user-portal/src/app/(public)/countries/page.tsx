import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CountryListing from '@/components/countries/CountryListing';
import { JsonLd } from '@/components/seo/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'All Destinations: Visa Prices & Processing Times',
  description: 'Every country Pravasa Transworld processes visas and arrival cards for, with starting prices per adult and processing times.',
  alternates: { canonical: `${BASE_URL}/countries` },
  openGraph: {
    title: 'All Destinations | Pravasa Transworld',
    description: 'Visa and arrival card prices and processing times for every destination we serve.',
    url: `${BASE_URL}/countries`,
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Countries', item: `${BASE_URL}/countries` },
  ],
};

// Static shell; the list itself loads in the browser so newly published countries
// appear without a redeploy.
export default function CountriesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <JsonLd data={breadcrumbSchema} />
      <Navbar />
      <CountryListing />
      <Footer />
    </div>
  );
}
