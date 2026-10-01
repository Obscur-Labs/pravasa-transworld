import type { MetadataRoute } from 'next';
import { SERVICES } from '@/lib/services';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...SERVICES.map((s) => ({
      url: `${BASE}/services/${s.slug}`,
      lastModified: new Date('2026-10-01'),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    {
      url: `${BASE}/privacy`,
      lastModified: new Date('2025-06-01'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/terms`,
      lastModified: new Date('2025-06-01'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
