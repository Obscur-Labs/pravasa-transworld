import { Zap, Shield, Activity, Globe2, Clock, HeartHandshake } from 'lucide-react';

const benefits = [
  {
    icon: Zap,
    title: 'Fast Processing',
    desc: 'Get your visa processed in as little as 5 business days with our expedited service.',
    gradient: 'from-brand-50 to-indigo-50/50 border-brand-100/50',
    iconColor: 'text-brand-600',
  },
  {
    icon: Shield,
    title: 'Secure Documents',
    desc: 'Your documents are encrypted, stored securely, and never shared without consent.',
    gradient: 'from-brand-50 to-indigo-50/50 border-brand-100/50',
    iconColor: 'text-brand-600',
  },
  {
    icon: Activity,
    title: 'Real-Time Tracking',
    desc: 'Monitor every stage of your application with our live status timeline.',
    gradient: 'from-brand-50 to-indigo-50/50 border-brand-100/50',
    iconColor: 'text-brand-600',
  },
  {
    icon: Globe2,
    title: '40+ Destinations',
    desc: 'Apply for visas to over 40 countries with one unified platform.',
    gradient: 'from-brand-50 to-indigo-50/50 border-brand-100/50',
    iconColor: 'text-brand-600',
  },
  {
    icon: Clock,
    title: 'Pay After Approval',
    desc: 'No upfront fees. Payment is only collected after your documents are approved.',
    gradient: 'from-brand-50 to-indigo-50/50 border-brand-100/50',
    iconColor: 'text-brand-600',
  },
  {
    icon: HeartHandshake,
    title: 'Expert Support',
    desc: 'Our visa specialists are on hand to guide you through every step of the process.',
    gradient: 'from-brand-50 to-indigo-50/50 border-brand-100/50',
    iconColor: 'text-brand-600',
  },
];

export default function Benefits() {
  return (
    <section className="py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden border-t border-slate-100">
      {/* Subtle light background blobs */}
      <div className="absolute top-0 left-10 w-96 h-96 bg-brand-100/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-0 right-10 w-80 h-80 bg-indigo-100/20 rounded-full blur-3xl pointer-events-none animate-float" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-brand-50 text-brand-800 border border-brand-100/60 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest shadow-sm">
            Why Pravasa Transworld
          </span>
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Everything You Need</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto font-semibold">
            Built for travelers who value clarity, speed, and security.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="bg-white rounded-3xl p-7 border border-slate-100 hover:border-brand-200 shadow-sm hover:shadow-[0_15px_30px_rgba(48,149,192,0.04)] transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${b.gradient} border flex items-center justify-center mb-5`}>
                  <Icon className={`w-7 h-7 ${b.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{b.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-semibold">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
