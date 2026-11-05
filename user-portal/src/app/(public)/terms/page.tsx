import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import LegalContact from '@/components/layout/LegalContact';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Read the terms and conditions governing use of Pravasa Transworld\'s visa application and immigration services platform.',
  alternates: { canonical: `${BASE_URL}/terms` },
  openGraph: {
    title: 'Terms of Service | Pravasa Transworld',
    description: 'Terms and conditions governing use of Pravasa Transworld\'s visa services platform.',
    url: `${BASE_URL}/terms`,
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: 5 November 2026</p>
        <div className="space-y-8 text-slate-600">
          {[
            ['Acceptance of Terms', 'By using Pravasa Transworld, you agree to these Terms of Service. If you do not agree, please do not use our platform.'],
            ['Services', 'Pravasa Transworld provides a platform for visa application management. We are not a government entity and do not guarantee visa approval, which is at the sole discretion of respective embassies.'],
            ['User Responsibilities', 'You are responsible for providing accurate information and valid documents. Submitting false information may result in application rejection and account termination.'],
            ['Payment Terms', 'Fees are paid when you submit an application, by UPI or bank transfer. Our team verifies the payment before reviewing your documents. Fees are non-refundable once the application has been submitted to the embassy or VFS, unless Pravasa Transworld is at fault.'],
            ['Intellectual Property', 'All content on Pravasa Transworld is owned by Pravasa Transworld and protected by applicable intellectual property laws.'],
            ['Limitation of Liability', 'Pravasa Transworld is not liable for visa rejections, embassy decisions, or delays beyond our control. Our maximum liability is limited to fees paid for the specific application.'],
            ['Governing Law & Jurisdiction', 'These terms are governed by the laws of India. Any dispute arising from them is subject to the exclusive jurisdiction of the courts at Surat, Gujarat.'],
          ].map(([title, text]) => (
            <div key={title}>
              <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
              <p className="leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <LegalContact />
      </main>
      <Footer />
    </div>
  );
}
