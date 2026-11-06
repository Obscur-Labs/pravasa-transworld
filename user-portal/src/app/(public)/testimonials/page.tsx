import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Testimonials from '@/components/public/Testimonials';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'Customer reviews',
  description: 'Verified reviews from travellers whose visas Pravasa Transworld processed.',
  alternates: { canonical: `${BASE_URL}/testimonials` },
};

export default function TestimonialsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <Testimonials />
      <Footer />
    </div>
  );
}
