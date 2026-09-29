'use client';
import { useEffect, useState } from 'react';
import { Download, CreditCard, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { getUserPayments, downloadReceipt } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';

interface Payment {
  _id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transactionId: string;
  markedByAdmin: boolean;
  paidAt: string;
  createdAt: string;
  application: {
    referenceId: string;
    visaType: { name: string };
    country: { name: string; flag: string };
  };
}

const methodLabel = (m: string) => {
  if (m === 'cash') return 'Cash';
  if (m === 'manual_override') return 'Admin Override';
  return 'Online';
};

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    getUserPayments()
      .then((r) => setPayments(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadReceipt = async (id: string, ref: string) => {
    setDownloading(id);
    try {
      const res = await downloadReceipt(id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${ref}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', description: 'Could not generate receipt.', variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Payment History</h1>
        <p className="text-slate-500 text-sm mt-1">All transactions with downloadable PDF receipts.</p>
      </div>

      {payments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400 mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(total)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400 mb-1">Transactions</p>
            <p className="text-2xl font-bold text-slate-900">{payments.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400 mb-1">Last Payment</p>
            <p className="text-2xl font-bold text-slate-900">
              {payments[0] ? formatDate(payments[0].paidAt || payments[0].createdAt) : '-'}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="hidden sm:grid grid-cols-6 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-3 w-20" />)}
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-2 sm:gap-4 px-5 py-4 items-center">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-5 h-3 rounded flex-shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <CreditCard className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-700 mb-2">No payments yet</h3>
          <p className="text-slate-400 text-sm">Your payment history will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="hidden sm:grid grid-cols-6 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200">
            {['Visa / Destination', 'Application No.', 'Method', 'Date', 'Amount', ''].map((h) => (
              <p key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</p>
            ))}
          </div>
          <div className="divide-y divide-slate-100">
            {payments.map((p) => (
              <div key={p._id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 sm:gap-4 px-5 py-4 items-center">
                <div className="sm:col-span-1 flex items-center gap-2">
                  <img
                    src={`https://flagcdn.com/w20/${p.application?.country?.flag}.png`}
                    alt=""
                    className="w-5 h-3 object-cover rounded"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.application?.visaType?.name}</p>
                    <p className="text-xs text-slate-400">{p.application?.country?.name}</p>
                  </div>
                </div>
                <p className="font-mono text-xs text-slate-500 truncate">{p.application?.referenceId}</p>
                <div>
                  <Badge variant={p.method === 'cash' ? 'warning' : 'info'} className="text-xs">
                    {methodLabel(p.method)}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500">{formatDate(p.paidAt || p.createdAt)}</p>
                <p className="text-sm font-bold text-slate-900">{formatCurrency(p.amount)}</p>
                <button
                  onClick={() => handleDownloadReceipt(p._id, p.application?.referenceId)}
                  disabled={downloading === p._id}
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors disabled:opacity-50"
                >
                  {downloading === p._id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Receipt
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
