'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Clock, CheckCircle, XCircle, Plus, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboard } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import type { Application } from '@/types';
import { STATUS_LABELS } from '@/types';

const statusVariant = (s: string) => {
  if (s === 'visa_approved' || s === 'visa_delivered') return 'success';
  if (s === 'visa_rejected') return 'destructive';
  if (s === 'payment_pending' || s === 'submitted') return 'warning';
  return 'info';
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ active: 0, pending: 0, approved: 0, rejected: 0, total: 0 });
  const [recent, setRecent] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then((res) => {
        setStats(res.data.data.stats);
        setRecent(res.data.data.recent);
      })
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Active Applications', value: stats.active, icon: FileText, color: 'text-brand-600', bg: 'bg-brand-50' },
    { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-slate-500 text-sm mt-1">Track all your visa applications in one place.</p>
        </div>
        <Button asChild>
          <Link href="/apply">
            <Plus className="w-4 h-4 mr-2" />
            New Application
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                {loading
                  ? <Skeleton className="h-8 w-10" />
                  : <p className="text-2xl font-bold text-slate-900">{s.value}</p>}
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Applications</h2>
          <Link href="/applications" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-5 rounded" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">No applications yet</p>
              <p className="text-slate-400 text-xs mt-1">Start by applying for your first visa.</p>
              <Button className="mt-4" asChild><Link href="/apply">Apply Now</Link></Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((app) => (
                <Link
                  key={app._id}
                  href={`/applications/${app._id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img src={`https://flagcdn.com/w40/${app.country?.flag}.png`} alt={app.country?.name} className="w-8 h-5 object-cover rounded" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{app.visaType?.name}</p>
                      <p className="text-xs text-slate-400">{app.referenceId} · {formatDate(app.createdAt)}</p>
                    </div>
                  </div>
                  <Badge variant={statusVariant(app.status) as any}>
                    {STATUS_LABELS[app.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
