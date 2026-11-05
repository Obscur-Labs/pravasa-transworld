import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import LegalContact from '@/components/layout/LegalContact';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how Pravasa Transworld collects, uses, and protects your personal data. Your privacy is our priority. Read our full policy here.',
  alternates: { canonical: `${BASE_URL}/privacy` },
  openGraph: {
    title: 'Privacy Policy | Pravasa Transworld',
    description: 'Learn how Pravasa Transworld collects, uses, and protects your personal data.',
    url: `${BASE_URL}/privacy`,
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: 5 November 2026</p>
        <div className="space-y-8 text-slate-600">
          {[
            ['Information We Collect', 'We collect personal information you provide during registration and visa application, including your name, email address, phone number, passport details, and uploaded documents.'],
            ['How We Use Your Information', 'Your information is used solely to process your visa applications, communicate updates, and improve our services. We do not sell your data to third parties.'],
            ['Data Security', 'All documents and personal data are encrypted in transit and at rest using industry-standard encryption. We use Cloudinary for secure document storage.'],
            ['Data Retention', 'We retain your data for as long as necessary to fulfill your application and comply with legal obligations. You may request deletion of your account and data at any time.'],
            ['Your Rights', 'You have the right to access, correct, or delete your personal information. Write to us at the email below for any privacy-related request.'],
            ['Governing Law', 'This policy is governed by the laws of India, including the Digital Personal Data Protection Act, 2023. Disputes are subject to the courts at Surat, Gujarat.'],
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
