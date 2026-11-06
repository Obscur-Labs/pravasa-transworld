import type { Metadata } from 'next';
import { BarChart3, CreditCard, IndianRupee, TrendingUp } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AgentRegistration from '@/components/public/AgentRegistration';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const metadata: Metadata = {
  title: 'B2B Travel Agents',
  description: 'Special B2B visa prices, credit limit and monthly commission for travel agents. Register your agency with Pravasa Transworld.',
  alternates: { canonical: `${BASE_URL}/b2b-agents` },
};

const PERKS = [
  { icon: IndianRupee, title: 'B2B prices', text: 'Lower net rates on every visa.' },
  { icon: TrendingUp, title: 'Commission', text: 'Monthly commission credited to your statement.' },
  { icon: CreditCard, title: 'Credit limit', text: 'Apply now and settle within the agreed terms.' },
  { icon: BarChart3, title: 'Agent dashboard', text: 'Track all your clients and download statements.' },
];

export default function B2BAgentsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <section className="bg-gradient-to-br from-brand-950 to-brand-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold-400 mb-3">For travel agents</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">Grow with Pravasa B2B</h1>
            <p className="mt-4 text-white/80 text-lg max-w-xl">
              Special B2B prices, a credit limit, monthly commission and your own agent dashboard.
            </p>
          </div>
          <AgentRegistration />
        </div>
      </section>
      <section className="py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <Icon className="w-6 h-6 text-gold-600 mb-3" aria-hidden />
              <h2 className="text-lg font-bold text-brand-950 mb-1">{title}</h2>
              <p className="text-sm text-slate-500 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
