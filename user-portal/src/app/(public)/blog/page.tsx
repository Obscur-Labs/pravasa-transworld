import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { BlogList } from '@/components/public/Blog';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'Blog: Visa Guides and Travel Tips',
  description: 'Visa guides, document checklists and travel tips for Indian travellers from Pravasa Transworld.',
  alternates: { canonical: `${BASE_URL}/blog` },
};

export default function BlogPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <BlogList />
      <Footer />
    </div>
  );
}
