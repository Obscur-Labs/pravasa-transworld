import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Script from 'next/script';
import { Toaster } from '@/components/ui/toaster';
import ServiceWorkerRegistrar from '@/components/pwa/ServiceWorkerRegistrar';
import { PWA_CAPTURE_SCRIPT } from '@/lib/pwaCaptureScript';

const inter = Inter({ subsets: ['latin'] });

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pravasatransworld.com';

export const viewport: Viewport = {
  themeColor: '#0B2E3D', // brand navy, straight off the logo
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: 'Pravasa Transworld | Professional Visa & Immigration Services',
    template: '%s | Pravasa Transworld',
  },

  description:
    'Pravasa Transworld offers expert visa consultancy for 50+ countries. Apply online for tourist, student, work, or business visas with fast processing and real-time status tracking.',

  keywords: [
    'visa services india',
    'visa consultancy',
    'visa application online',
    'tourist visa',
    'student visa',
    'work visa',
    'business visa',
    'immigration assistance',
    'schengen visa',
    'usa visa',
    'uk visa',
    'canada visa',
    'australia visa',
    'visa processing',
    'pravasa transworld',
  ],

  authors: [{ name: 'Pravasa Transworld', url: BASE_URL }],
  creator: 'Pravasa Transworld',
  publisher: 'Pravasa Transworld',
  category: 'Immigration Services',

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'Pravasa Transworld',
    title: 'Pravasa Transworld | Professional Visa & Immigration Services',
    description:
      'Expert visa consultancy for 50+ countries. Fast online applications, real-time tracking, and dedicated immigration support.',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Pravasa Transworld | Professional Visa & Immigration Services',
    description:
      'Expert visa consultancy for 50+ countries. Fast online applications, real-time tracking, and dedicated immigration support.',
    creator: '@pravasatransworld',
    site: '@pravasatransworld',
  },

  alternates: {
    canonical: BASE_URL,
    languages: { 'en-US': BASE_URL },
  },

  // All generated from the logo's plane-and-pin mark; see /public.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: '/apple-touch-icon.png',
  },

  manifest: '/site.webmanifest',
  applicationName: 'Pravasa Transworld',
  // iPhone/iPad "Add to Home Screen": open full-screen with the short name under the icon.
  appleWebApp: { capable: true, title: 'Pravasa', statusBarStyle: 'default' },

  other: {
    // Next only emits the standard tag; iOS before 16.4 needs Apple's to open full-screen.
    'apple-mobile-web-app-capable': 'yes',
    ...(process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION
      ? { 'google-site-verification': process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION }
      : {}),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Script id="pwa-install-capture" strategy="beforeInteractive">{PWA_CAPTURE_SCRIPT}</Script>
        {children}
        <Toaster />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
