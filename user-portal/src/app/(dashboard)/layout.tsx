import DashboardShell from '@/components/layout/DashboardShell';

// Every page under (dashboard) is a `'use client'` component that fetches its
// own data behind the auth token, so there is nothing meaningful to render on
// the server, prerendering just bakes a stale shell into the build and makes
// deployed changes show up late. This layout stays a server component purely
// so the segment config below can opt the whole group out of prerendering.
export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
