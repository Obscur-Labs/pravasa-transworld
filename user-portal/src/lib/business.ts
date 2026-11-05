'use client';
import { useEffect, useState } from 'react';
import api from './api';

/** Public contact details, edited in the admin under Configurations > Receipt. */
export interface BusinessInfo {
  companyName: string;
  address: string;
  phones: string[];
  email: string;
  website: string;
  businessHours: string;
}

// Rendered on first paint (and on the server) so the page is never blank or wrong
// while the live values load. Mirrors the backend defaults.
export const DEFAULT_BUSINESS: BusinessInfo = {
  companyName: 'Pravasa Transworld Pvt Ltd',
  address: 'Office 228, Royal Square, VIP Cir to Utran Rd, Utran, Surat, Gujarat - 394105',
  phones: ['+91 84695 24000', '+91 84693 24000'],
  email: 'support.pravasatransworld@gmail.com',
  website: 'www.pravasatransworld.com',
  businessHours: 'Mon–Sat 10 AM – 7 PM IST',
};

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const whatsappHref = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const websiteHref = (site: string) => (/^https?:\/\//.test(site) ? site : `https://${site}`);

// One request per page load, shared by every component that asks.
let pending: Promise<BusinessInfo> | null = null;
const load = () => {
  pending ??= api.get('/public/business-info')
    .then((r) => ({ ...DEFAULT_BUSINESS, ...r.data.data }) as BusinessInfo)
    .catch(() => {
      pending = null;
      return DEFAULT_BUSINESS;
    });
  return pending;
};

export function useBusinessInfo(): BusinessInfo {
  const [info, setInfo] = useState(DEFAULT_BUSINESS);
  useEffect(() => {
    let live = true;
    load().then((i) => { if (live) setInfo(i); });
    return () => { live = false; };
  }, []);
  return info;
}
