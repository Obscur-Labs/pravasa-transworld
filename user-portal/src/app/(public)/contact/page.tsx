import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ContactSection from '@/components/landing/ContactSection';
import { JsonLd } from '@/components/seo/JsonLd';
import { MessageCircle } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'Contact Us: Talk to a Visa Expert',
  description:
    'Get in touch with Pravasa Transworld for help with document checklists, visa eligibility, application status, and more.',
  alternates: {
    canonical: `${BASE_URL}/contact`,
  },
  openGraph: {
    title: 'Contact Pravasa Transworld',
    description: 'Our visa experts are available to guide you through any part of the process.',
    url: `${BASE_URL}/contact`,
  },
};

const contactSchema = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact Pravasa Transworld',
  url: `${BASE_URL}/contact`,
};

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <JsonLd data={contactSchema} />
      <Navbar />

      <section className="relative overflow-hidden bg-white border-b border-slate-100">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-600 text-xs font-bold px-4 py-1.5 rounded-full mb-5 uppercase tracking-widest">
            <MessageCircle className="w-3.5 h-3.5" />
            We're Here to Help
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight leading-tight">
            Get In <span className="text-brand-600">Touch</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-xl mx-auto text-[15px] leading-relaxed">
            Questions about your visa application? Our team responds within 24 hours.
          </p>
        </div>
      </section>

      <ContactSection />
      <Footer />
    </div>
  );
}
