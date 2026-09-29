import { Globe2, Upload, CreditCard, CheckCircle, Package } from 'lucide-react';

const steps = [
  { icon: Globe2, title: 'Select Visa', desc: 'Choose your destination country and the visa type you need.' },
  { icon: Upload, title: 'Upload Documents', desc: 'Securely upload your required documents directly from your device.' },
  { icon: CheckCircle, title: 'Verification', desc: 'Our team reviews your documents and notifies you promptly.' },
  { icon: CreditCard, title: 'Make Payment', desc: 'Pay securely after document approval, no upfront charges.' },
  { icon: Package, title: 'Visa Delivered', desc: 'Download your visa or receive it directly to your dashboard.' },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden border-t border-slate-100">
      {/* Decorative background blobs */}
      <div className="absolute top-0 right-10 w-96 h-96 bg-brand-100/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-indigo-100/20 rounded-full blur-3xl pointer-events-none animate-float" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <span className="inline-block bg-brand-50 text-brand-800 border border-brand-100/60 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest shadow-sm">
            Simple Process
          </span>
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">How It Works</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto font-semibold">
            Five simple steps from application to visa delivery. No complex forms or hidden terms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div 
                key={idx} 
                className="relative flex flex-col items-center text-center group bg-white rounded-3xl p-6 border border-slate-100 hover:border-brand-200 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_15px_30px_rgba(48,149,192,0.04)] shadow-sm"
              >
                <div className="relative z-10 w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-5 border border-brand-100/50 transition-all duration-300">
                  <Icon className="w-7 h-7 text-brand-600 transition-transform duration-300" />
                  <span className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-brand-600 text-white text-xs font-black rounded-full flex items-center justify-center shadow-md">
                    {idx + 1}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
