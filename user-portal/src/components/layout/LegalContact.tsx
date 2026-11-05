'use client';
import { telHref, useBusinessInfo } from '@/lib/business';

/** Who to write to about the policy, from the shared business details. */
export default function LegalContact() {
  const biz = useBusinessInfo();
  return (
    <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
      <h2 className="text-xl font-bold text-slate-900 mb-2">Contact</h2>
      <p className="leading-relaxed">
        {biz.companyName}, {biz.address}
        <br />
        Email: <a href={`mailto:${biz.email}`} className="text-brand-900 underline">{biz.email}</a>
        <br />
        Phone: {biz.phones.map((p, i) => (
          <span key={p}>{i > 0 && ' / '}<a href={telHref(p)} className="text-brand-900 underline">{p}</a></span>
        ))}
        <br />
        Hours: {biz.businessHours}
      </p>
    </div>
  );
}
