import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ArrivalCards from '@/components/public/ArrivalCards';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'Digital Arrival Cards',
  description: 'Digital arrival cards filled and submitted for you, with the confirmation and QR code sent on WhatsApp and email.',
  alternates: { canonical: `${BASE_URL}/arrival-cards` },
};

export default function ArrivalCardsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <ArrivalCards />
      <Footer />
    </div>
  );
}
