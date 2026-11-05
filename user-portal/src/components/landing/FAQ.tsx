'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'How long does visa processing take?',
    a: 'Processing times vary by country and visa type. Tourist visas typically take 5–15 business days, while student and work visas may take 15–30 days. You can see the estimated time for each visa type before applying.',
  },
  {
    q: 'What documents do I need to upload?',
    a: "Required documents vary by visa type. After selecting your visa, you'll see the exact list. Common documents include a passport copy, photographs, bank statements, and travel itinerary.",
  },
  {
    q: 'When do I pay the visa fee?',
    a: 'Payment is only required after our team reviews and approves your documents. This ensures you only pay when your application is on track.',
  },
  {
    q: 'How will I receive my visa?',
    a: "Once approved, your visa is uploaded to your Pravasa Transworld dashboard. You'll receive an email notification and can download the PDF directly from your application page.",
  },
  {
    q: 'What happens if my documents are rejected?',
    a: "If a document is rejected, you'll receive a notification with the reason. You can re-upload the corrected document directly from your application page.",
  },
  {
    q: 'Is my personal data secure?',
    a: 'Yes. All documents are encrypted and stored on secure cloud infrastructure. We never share your data with third parties without your explicit consent.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden border-t border-slate-100">
      {/* Light background blobs */}
      <div className="absolute top-0 left-10 w-96 h-96 bg-brand-100/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-0 right-10 w-80 h-80 bg-gold-100/20 rounded-full blur-3xl pointer-events-none animate-float" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-brand-50 text-brand-800 border border-brand-100/60 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest shadow-sm">
            FAQ
          </span>
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Frequently Asked Questions</h2>
          <p className="text-lg text-slate-600 font-semibold">Everything you need to know about Pravasa Transworld.</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className={`bg-white border rounded-3xl overflow-hidden transition-all duration-300 ${
                open === idx 
                  ? 'border-brand-200 bg-brand-50/10 shadow-[0_15px_30px_rgba(48,149,192,0.03)] scale-[1.01]' 
                  : 'border-slate-200 shadow-sm'
              }`}
            >
              <button
                className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                onClick={() => setOpen(open === idx ? null : idx)}
              >
                <span className={`font-bold text-sm pr-4 transition-colors ${open === idx ? 'text-brand-600' : 'text-slate-800'}`}>
                  {faq.q}
                </span>
                <ChevronDown
                  className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                    open === idx ? 'rotate-180 text-brand-600' : 'text-slate-400'
                  }`}
                />
              </button>
              {open === idx && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                  <p className="text-slate-600 text-sm leading-relaxed font-semibold">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
