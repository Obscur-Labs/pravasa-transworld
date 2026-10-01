'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Minus, Plus, Send } from 'lucide-react';
import { submitServiceInquiry } from '@/lib/api';
import { SERVICES, type ServiceField, type ServiceKey } from '@/lib/services';

const PHONE_CODES = ['+91', '+971', '+1', '+44', '+65', '+61', '+966', '+974', '+965', '+968', 'Other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  'w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:bg-white transition-colors';
const SPAN: Record<number, string> = { 2: 'col-span-3 sm:col-span-2', 3: 'col-span-6 sm:col-span-3', 4: 'col-span-6 sm:col-span-4', 6: 'col-span-6' };

// Local yyyy-mm-dd, the format <input type="date"> reads and writes.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isActive = (f: ServiceField, values: Record<string, string>) => !f.when || f.when.in.includes(values[f.when.key]);

export default function ServiceInquiryForm({ serviceKey }: { serviceKey: ServiceKey }) {
  const service = SERVICES.find((s) => s.key === serviceKey)!;
  const initial = useMemo(
    () => Object.fromEntries(service.fields.map((f) => [f.key, f.defaultValue ?? ''])) as Record<string, string>,
    [service],
  );

  const [values, setValues] = useState(initial);
  const [contact, setContact] = useState({ name: '', email: '', code: '+91', phone: '', location: '' });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors(({ [key]: _, ...rest }) => rest);
  };
  const setC = (key: keyof typeof contact, value: string) => {
    setContact((c) => ({ ...c, [key]: value }));
    setErrors(({ [key]: _, ...rest }) => rest);
  };

  const sections = [...new Set(service.fields.map((f) => f.section))];
  const labelOf = (key: string) => service.fields.find((f) => f.key === key)!.label.toLowerCase();

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const f of service.fields) {
      if (!isActive(f, values)) continue;
      const v = values[f.key].trim();
      if (!v) { if (f.required) errs[f.key] = `${f.label} is required`; continue; }
      if (f.type === 'number') {
        const n = Number(v);
        if (!Number.isFinite(n) || (f.min != null && n < f.min) || (f.max != null && n > f.max)) errs[f.key] = `Enter a number from ${f.min ?? 0} to ${f.max}`;
      }
      if (f.after && values[f.after] && v < values[f.after]) errs[f.key] = `Must be on or after the ${labelOf(f.after)}`;
      if (f.differentFrom && v === values[f.differentFrom] && v !== 'Other') errs[f.key] = `Must differ from "${labelOf(f.differentFrom)}"`;
    }
    if (!contact.name.trim()) errs.name = 'Your name is required';
    if (contact.email && !EMAIL_RE.test(contact.email.trim())) errs.email = 'That email does not look right';
    const digits = contact.phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) errs.phone = 'Enter a valid WhatsApp number';
    if (!contact.location.trim()) errs.location = 'Your city or pincode is required';
    if (!consent) errs.consent = 'Please accept to send your request';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`field-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    try {
      const answers = Object.fromEntries(service.fields.filter((f) => isActive(f, values)).map((f) => [f.key, values[f.key].trim()]));
      await submitServiceInquiry(service.key, {
        ...answers,
        name: contact.name.trim(),
        email: contact.email.trim(),
        phone: contact.code === 'Other' ? contact.phone.trim() : `${contact.code} ${contact.phone.trim()}`,
        location: contact.location.trim(),
        consent: true,
      });
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Could not send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setValues(initial);
    setConsent(false);
    setErrors({});
    setSent(false);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center py-10 px-4">
        <span className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Request received</h2>
        <p className="mt-2 max-w-sm text-sm font-medium text-slate-600">
          Thanks, {contact.name.split(' ')[0]}. Our team will reach you on WhatsApp at {contact.code === 'Other' ? '' : `${contact.code} `}{contact.phone} with options, usually within a few working hours.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={reset} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Send another request
          </button>
          <Link href="/" className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
            Explore visas
          </Link>
        </div>
      </div>
    );
  }

  const error = (key: string) => errors[key] && <p className="mt-1 text-xs font-semibold text-red-600">{errors[key]}</p>;
  const ring = (key: string) => (errors[key] ? ' border-red-300 focus:ring-red-400 focus:border-red-400' : '');

  const renderField = (f: ServiceField) => {
    const v = values[f.key];
    const id = `field-${f.key}`;
    const label = (
      <label htmlFor={id} className="block text-sm font-bold text-slate-700 mb-1.5">
        {f.label}{f.required && <span className="text-red-500"> *</span>}
      </label>
    );

    if (f.type === 'choice' && f.display !== 'select') {
      return (
        <div key={f.key} className={SPAN[f.span ?? 6]} id={id}>
          <p className="block text-sm font-bold text-slate-700 mb-1.5">{f.label}{f.required && <span className="text-red-500"> *</span>}</p>
          <div role="radiogroup" aria-label={f.label} className="flex flex-wrap gap-2">
            {f.options!.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={v === o}
                onClick={() => set(f.key, o)}
                className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  v === o ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
          {error(f.key)}
        </div>
      );
    }

    if (f.type === 'choice') {
      return (
        <div key={f.key} className={SPAN[f.span ?? 6]}>
          {label}
          <select id={id} value={v} onChange={(e) => set(f.key, e.target.value)} className={inputClass + ring(f.key)}>
            {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {error(f.key)}
        </div>
      );
    }

    // Small counts get a stepper; large amounts a plain numeric input.
    if (f.type === 'number' && (f.max ?? 0) <= 100) {
      const n = Number(v || 0);
      const step = (d: number) => set(f.key, String(Math.min(f.max ?? 99, Math.max(f.min ?? 0, n + d))));
      return (
        <div key={f.key} className={SPAN[f.span ?? 2]}>
          {label}
          <div className={`flex h-11 items-center rounded-xl border bg-slate-50 ${errors[f.key] ? 'border-red-300' : 'border-slate-200'}`}>
            <button type="button" onClick={() => step(-1)} disabled={n <= (f.min ?? 0)} aria-label={`Fewer ${f.label.toLowerCase()}`}
              className="h-full px-3 text-slate-500 hover:text-brand-700 disabled:opacity-30">
              <Minus className="w-4 h-4" />
            </button>
            <input id={id} inputMode="numeric" value={v} onChange={(e) => set(f.key, e.target.value.replace(/\D/g, '').slice(0, 3))}
              className="w-full min-w-0 bg-transparent text-center text-sm font-bold text-slate-900 tabular-nums focus:outline-none" />
            <button type="button" onClick={() => step(1)} disabled={n >= (f.max ?? 99)} aria-label={`More ${f.label.toLowerCase()}`}
              className="h-full px-3 text-slate-500 hover:text-brand-700 disabled:opacity-30">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {error(f.key)}
        </div>
      );
    }

    if (f.type === 'longtext') {
      return (
        <div key={f.key} className={SPAN[f.span ?? 6]}>
          {label}
          <textarea id={id} rows={3} maxLength={2000} placeholder={f.placeholder} value={v} onChange={(e) => set(f.key, e.target.value)}
            className={inputClass.replace('h-11', 'py-2.5') + ' resize-none' + ring(f.key)} />
          {error(f.key)}
        </div>
      );
    }

    const min = f.type === 'date' ? [today(), f.after ? values[f.after] : ''].sort().pop() : undefined;
    return (
      <div key={f.key} className={SPAN[f.span ?? 6]}>
        {label}
        <input
          id={id}
          type={f.type === 'date' ? 'date' : 'text'}
          inputMode={f.type === 'number' ? 'decimal' : undefined}
          min={min}
          maxLength={200}
          placeholder={f.placeholder}
          value={v}
          onChange={(e) => set(f.key, f.type === 'number' ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)}
          className={inputClass + ring(f.key)}
        />
        {error(f.key)}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {sections.map((section, i) => (
        <fieldset key={section}>
          <legend className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] text-brand-700">{i + 1}</span>
            {section}
          </legend>
          <div className="grid grid-cols-6 gap-4">
            {service.fields.filter((f) => f.section === section && isActive(f, values)).map(renderField)}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] text-brand-700">{sections.length + 1}</span>
          Your details
        </legend>
        <div className="grid grid-cols-6 gap-4">
          <div className="col-span-6 sm:col-span-3">
            <label htmlFor="field-name" className="block text-sm font-bold text-slate-700 mb-1.5">Full name<span className="text-red-500"> *</span></label>
            <input id="field-name" autoComplete="name" maxLength={100} value={contact.name} onChange={(e) => setC('name', e.target.value)} className={inputClass + ring('name')} />
            {error('name')}
          </div>
          <div className="col-span-6 sm:col-span-3">
            <label htmlFor="field-phone" className="block text-sm font-bold text-slate-700 mb-1.5">WhatsApp number<span className="text-red-500"> *</span></label>
            <div className="flex gap-2">
              <select aria-label="Country code" value={contact.code} onChange={(e) => setC('code', e.target.value)} className={inputClass + ' w-[5.5rem] shrink-0 px-2'}>
                {PHONE_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input id="field-phone" type="tel" autoComplete="tel-national" maxLength={20}
                placeholder={contact.code === 'Other' ? 'With country code' : '98765 43210'}
                value={contact.phone} onChange={(e) => setC('phone', e.target.value.replace(/[^\d\s+]/g, ''))} className={inputClass + ring('phone')} />
            </div>
            {error('phone')}
          </div>
          <div className="col-span-6 sm:col-span-3">
            <label htmlFor="field-email" className="block text-sm font-bold text-slate-700 mb-1.5">Email <span className="font-medium text-slate-400">(optional)</span></label>
            <input id="field-email" type="email" autoComplete="email" maxLength={200} value={contact.email} onChange={(e) => setC('email', e.target.value)} className={inputClass + ring('email')} />
            {error('email')}
          </div>
          <div className="col-span-6 sm:col-span-3">
            <label htmlFor="field-location" className="block text-sm font-bold text-slate-700 mb-1.5">City or pincode<span className="text-red-500"> *</span></label>
            <input id="field-location" autoComplete="postal-code" maxLength={100} value={contact.location} onChange={(e) => setC('location', e.target.value)} className={inputClass + ring('location')} />
            {error('location')}
          </div>
        </div>
      </fieldset>

      <div>
        <label id="field-consent" className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErrors(({ consent: _, ...rest }) => rest); }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          <span className="text-sm font-medium text-slate-600">
            {service.consent} See our <Link href="/terms" className="font-semibold text-brand-700 underline">terms</Link> and <Link href="/privacy" className="font-semibold text-brand-700 underline">privacy policy</Link>.
          </span>
        </label>
        {error('consent')}
      </div>

      {serverError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{serverError}</div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/15 transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <><Send className="w-4 h-4" />{service.submitLabel}</>}
      </button>
      <p className="-mt-5 text-center text-xs font-medium text-slate-400">No payment needed. We send quotes first.</p>
    </form>
  );
}
