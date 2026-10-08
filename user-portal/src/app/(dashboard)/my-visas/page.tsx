'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Stamp, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import { getApplications } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Application } from '@/types';

export default function MyVisasPage() {
  const [visas, setVisas] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApplications()
      .then((r) => {
        const done = r.data.data.filter((a: Application) =>
          ['visa_approved', 'visa_delivered'].includes(a.status)
        );
        // Sort newest first
        done.sort((a: Application, b: Application) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setVisas(done);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Visas</h1>
        <p className="text-slate-500 text-sm mt-1">All approved and delivered visas, newest first.</p>
      </div>

      {loading ? (
        <CardGridSkeleton count={4} className="md:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 gap-5" cardClassName="h-56" />
      ) : visas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Stamp className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-700 mb-2">No visas yet</h3>
          <p className="text-slate-400 text-sm mb-6">Approved visas will appear here.</p>
          <Button asChild><Link href="/apply">Apply for Visa</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
          {visas.map((app) => (
            <Card key={app._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://flagcdn.com/w40/${app.country?.flag}.png`}
                      alt={app.country?.name}
                      className="w-10 h-7 object-cover rounded"
                    />
                    <div>
                      <h3 className="font-bold text-slate-900">{app.visaType?.name}</h3>
                      <p className="text-sm text-slate-500">{app.country?.name}</p>
                    </div>
                  </div>
                  <Badge variant={app.status === 'visa_delivered' ? 'success' : 'info'}>
                    {app.status === 'visa_delivered' ? 'Delivered' : 'Approved'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-xs text-slate-400">Application No.</p>
                    <p className="font-mono text-xs text-slate-600">{app.referenceId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Date</p>
                    <p className="font-medium text-slate-700">{formatDate(app.updatedAt)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/applications/${app._id}`}
                    className="flex-1 text-center text-sm font-medium text-brand-600 border border-brand-200 rounded-lg py-1.5 hover:bg-brand-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View Details
                  </Link>
                  {app.status === 'visa_delivered' && (
                    <Link
                      href={`/applications/${app._id}`}
                      className="flex-1 text-center text-sm font-semibold bg-green-600 text-white rounded-lg py-1.5 hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Visa
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
