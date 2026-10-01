'use client';
import { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle, Loader2 } from 'lucide-react';
import { submitContactLead } from '@/lib/api';

export default function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await submitContactLead(form);
      setSent(true);
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-24 bg-gradient-to-b from-white to-brand-50/20 relative overflow-hidden border-t border-slate-100">
      {/* Decorative light glowing blobs with very slow & gentle animations */}
      <div className="absolute top-0 left-1/3 w-96 h-96 bg-brand-100/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-0 right-10 w-80 h-80 bg-indigo-100/20 rounded-full blur-3xl pointer-events-none animate-float" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block bg-brand-50 text-brand-800 border border-brand-100/60 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest shadow-sm">
            Get In Touch
          </span>
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Need Help?</h2>
          <p className="text-lg text-slate-600 max-w-xl mx-auto font-semibold">
            Our visa experts are available to guide you through any part of the process.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left info */}
          <div>
            <div className="space-y-4 mb-10">
              {[
                { icon: Mail, label: 'Email Us', value: 'support.pravasatransworld@gmail.com', href: 'mailto:support.pravasatransworld@gmail.com' },
                { icon: Phone, label: 'Call Us', value: '+91 84693 24000', href: 'tel:+918469324000' },
                { icon: MapPin, label: 'Hours', value: 'Mon–Fri, 9AM–6PM EST' },
              ].map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="bg-white rounded-3xl px-5 py-4 flex items-center gap-4 border border-slate-100 hover:border-brand-200 shadow-sm transition-all duration-300">
                  <div className="w-10 h-10 bg-brand-50 border border-brand-100/50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold tracking-wide uppercase">{label}</p>
                    {href
                      ? <a href={href} className="block text-slate-800 font-extrabold text-sm mt-0.5 hover:text-brand-700 hover:underline break-all">{value}</a>
                      : <p className="text-slate-800 font-extrabold text-sm mt-0.5">{value}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h4 className="text-slate-900 font-extrabold text-base mb-3">Why Contact Us?</h4>
              <ul className="space-y-2">
                {[
                  'Document checklist help',
                  'Visa eligibility questions',
                  'Application status support',
                  'Special case guidance',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-slate-600 text-sm font-semibold">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right form */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-[0_20px_50px_rgba(48,149,192,0.04)]">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Message Sent!</h3>
                <p className="text-slate-600 text-sm mb-6 font-semibold">Thank you for reaching out. Our team will get back to you within 24 hours.</p>
                <button
                  onClick={() => setSent(false)}
                  className="text-sm text-brand-600 hover:text-brand-700 transition-colors font-bold underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-slate-900 mb-6">Send us a message</h3>
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Your full name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all duration-300 focus:bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Phone</label>
                      <input
                        type="tel"
                        placeholder="+1 (000) 000-0000"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all duration-300 focus:bg-white font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="you@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all duration-300 focus:bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Message *</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="How can we help you?"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none transition-all duration-300 focus:bg-white font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold py-3 rounded-2xl transition-all duration-300 text-sm shadow-lg shadow-brand-600/10 hover:shadow-brand-600/20 hover:scale-[1.02] active:scale-[0.98] border-0"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin text-white" />Sending...</>
                    ) : (
                      <><Send className="w-4 h-4 text-white" />Send Message</>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
