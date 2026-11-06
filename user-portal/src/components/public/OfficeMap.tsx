'use client';
import { MapPin } from 'lucide-react';
import { useBusinessInfo } from '@/lib/business';

/** Google Maps embed of the office address from the admin's business details. No API key needed. */
export default function OfficeMap({ className = '' }: { className?: string }) {
  const biz = useBusinessInfo();
  const query = encodeURIComponent(biz.address);
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${className}`}>
      <iframe
        title={`Map of ${biz.address}`}
        src={`https://www.google.com/maps?q=${query}&output=embed`}
        className="absolute inset-0 w-full h-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noopener noreferrer"
        className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-brand-900 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-brand-800">
        <MapPin className="w-3.5 h-3.5" />Open in Google Maps
      </a>
    </div>
  );
}
