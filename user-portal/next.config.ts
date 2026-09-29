import type { NextConfig } from 'next';

const PRIVATE_ROUTES = [
  '/login',
  '/register',
  '/dashboard/:path*',
  '/applications/:path*',
  '/apply',
  '/my-visas',
  '/notifications',
  '/document-vault',
  '/profile',
  '/payment-history',
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: 'res.cloudinary.com' }],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  },
  async headers() {
    return [
      ...PRIVATE_ROUTES.map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
      // Browsers must always see the latest service worker, or a fix to it could take
      // days to reach installed apps.
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/site.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ];
  },
};

export default nextConfig;
