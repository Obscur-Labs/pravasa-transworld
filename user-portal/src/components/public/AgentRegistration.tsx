'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Loader2 } from 'lucide-react';
import { submitServiceInquiry } from '@/lib/api';

const VOLUMES = ['1 to 10', '11 to 50', '51 to 200', 'More than 200'];
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const empty = { agency: '', name: '', phone: '', email: '', gstin: '', location: '', volume: '', destinations: '' };

const inputClass = 'mt-1 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30';

/** Travel-agent sign-up; lands in the admin Inquiries page under B2B agents. */
export default function AgentRegistration() {
  const [form, setForm] = useState(empty);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: key === 'gstin' ? e.target.value.toUpperCase() : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const digits = form.phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(digits)) { setError('Enter a 10-digit Indian mobile number'); return; }
    if (form.gstin && !GSTIN_RE.test(form.gstin)) { setError('GSTIN should look like 24ABCDE1234F1Z5'); return; }
    setSending(true);
    try {
      await submitServiceInquiry('b2b_agent', { ...form, phone: `+91 ${digits}`, consent });
      setSent(true);
      setForm(empty);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl bg-white text-slate-900 p-8 shadow-xl text-center">
        <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-brand-950">Thanks, we have your details</h2>
        <p className="text-sm text-slate-500 mt-1">Our team will call you within one working day to set up your agent account.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white text-slate-900 p-6 shadow-xl space-y-3.5">
      <h2 className="text-lg font-bold text-brand-950">Register your agency</h2>
      <label className="block"><span className="text-xs font-bold text-slate-700">Agency name</span>
        <input required value={form.agency} onChange={set('agency')} placeholder="Your agency" className={inputClass} /></label>
      <label className="block"><span className="text-xs font-bold text-slate-700">Contact person</span>
        <input required value={form.name} onChange={set('name')} placeholder="Full name" className={inputClass} /></label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block"><span className="text-xs font-bold text-slate-700">Mobile</span>
          <input required type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="+91 98XXX XXXXX" className={inputClass} /></label>
        <label className="block"><span className="text-xs font-bold text-slate-700">Email (optional)</span>
          <input type="email" value={form.email} onChange={set('email')} placeholder="you@agency.com" className={inputClass} /></label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block"><span className="text-xs font-bold text-slate-700">GSTIN (optional)</span>
          <input value={form.gstin} onChange={set('gstin')} placeholder="24XXXXX..." maxLength={15} className={inputClass} /></label>
        <label className="block"><span className="text-xs font-bold text-slate-700">City</span>
          <input required value={form.location} onChange={set('location')} placeholder="Surat" className={inputClass} /></label>
      </div>
      <label className="block"><span className="text-xs font-bold text-slate-700">Visa applications per month</span>
        <select required value={form.volume} onChange={set('volume')} className={inputClass}>
          <option value="" disabled>Pick one</option>
          {VOLUMES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select></label>
      <label className="flex items-start gap-2 text-xs text-slate-500">
        <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 rounded" />
        <span>I agree to be contacted about the B2B programme and accept the <Link href="/terms" className="underline">terms</Link>.</span>
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={sending} className="w-full h-12 rounded-lg bg-brand-950 text-white font-bold hover:bg-brand-900 disabled:opacity-60 inline-flex items-center justify-center gap-2">
        {sending && <Loader2 className="w-4 h-4 animate-spin" />}Submit
      </button>
    </form>
  );
}
