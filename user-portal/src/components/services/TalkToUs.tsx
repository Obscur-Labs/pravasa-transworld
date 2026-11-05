'use client';
import { MessageCircle, Phone } from 'lucide-react';
import { telHref, useBusinessInfo, whatsappHref } from '@/lib/business';

/** Call and WhatsApp buttons from the shared business details; the first number takes WhatsApp. */
export default function TalkToUs() {
  const biz = useBusinessInfo();
  const [primary] = biz.phones;

  return (
    <div className="rounded-3xl bg-brand-900 p-6 text-white">
      <h2 className="font-extrabold">Prefer to talk?</h2>
      <p className="mt-1 text-sm text-brand-100">Call or message us and we will sort it out with you. {biz.businessHours}.</p>
      <div className="mt-4 flex flex-col gap-2">
        {biz.phones.map((p) => (
          <a key={p} href={telHref(p)} className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-bold hover:bg-white/20">
            <Phone className="h-4 w-4" />{p}
          </a>
        ))}
        {primary && (
          <a href={whatsappHref(primary)} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-gold-600 py-2.5 text-sm font-bold hover:bg-gold-700">
            <MessageCircle className="h-4 w-4" />WhatsApp us
          </a>
        )}
      </div>
    </div>
  );
}
