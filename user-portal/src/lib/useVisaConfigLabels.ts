'use client';
import { useEffect, useState } from 'react';
import { getPublicVisaConfig } from './api';

interface VisaConfigOption {
  category: string;
  value: string;
  label: string;
}

// Fetches the admin-configured display labels for jurisdiction/visaCategory/visaSubType/
// entryType (Visa Config page in admin-portal) so the website never shows a stale,
// hardcoded, or half-capitalized version of a value the admin controls.
export function useVisaConfigLabels() {
  const [options, setOptions] = useState<VisaConfigOption[]>([]);

  useEffect(() => {
    getPublicVisaConfig().then((r) => setOptions(r.data.data)).catch(() => {});
  }, []);

  const labelFor = (category: string, value: string | undefined, fallback?: string): string => {
    if (!value) return fallback ?? '-';
    const found = options.find((o) => o.category === category && o.value === value);
    return found?.label ?? fallback ?? value;
  };

  return { labelFor };
}
