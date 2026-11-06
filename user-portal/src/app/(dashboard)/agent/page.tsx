'use client';
import { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAgentAccount } from '@/lib/api';
import { formatCurrency, formatDate, todayIST } from '@/lib/utils';

interface Account {
  isAgent: boolean; agentCode: string; creditLimit: number; owed: number; available: number; paused: boolean; paymentTermsDays: number;
  opening: number; invoiced: number; received: number; closing: number;
  lines: { _id: string; date: string; description: string; debit: number; credit: number; balance: number }[];
}

const monthAgo = () => new Date(Date.now() + 5.5 * 3600000 - 30 * 86400000).toISOString().slice(0, 10);

/** A B2B agent's credit position and statement with running balance. */
export default function AgentAccountPage() {
  const [range, setRange] = useState({ from: monthAgo(), to: todayIST() });
  const [data, setData] = useState<Account | null>(null);

  useEffect(() => {
    setData(null);
    getAgentAccount(range).then((r) => setData(r.data.data)).catch(() => {});
  }, [range]);

  if (data && !data.isAgent) {
    return <div className="page-container"><p className="text-slate-500">This page is for B2B travel agents.</p></div>;
  }

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Briefcase className="w-6 h-6 text-gold-600" />Agent Account</h1>
      <p className="text-sm text-slate-500 mt-1">{data?.agentCode ? `${data.agentCode} · ` : ''}Payment terms: {data ? `${data.paymentTermsDays} days` : '...'}</p>
      {data?.paused && <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">Your credit is paused. Please contact us to resume billing orders to credit.</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        {[['Credit limit', data?.creditLimit], ['Owed now', data?.owed], ['Available', data?.available], ['Closing (period)', data?.closing]].map(([label, value]) => (
          <Card key={label as string}><CardContent className="p-5">
            <p className="text-xs text-slate-500">{label}</p>
            {data ? <p className="text-xl font-bold text-slate-900">{formatCurrency(value as number)}</p> : <Skeleton className="h-7 w-24 mt-1" />}
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-slate-900 mr-auto">Statement</h2>
          <input type="date" aria-label="From" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 rounded-lg border border-slate-200 px-2 text-sm" />
          <input type="date" aria-label="To" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 rounded-lg border border-slate-200 px-2 text-sm" />
        </div>
        <CardContent className="p-0 overflow-x-auto">
          {!data ? <Skeleton className="h-40 m-4" /> : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-400"><tr>{['Date', 'Particulars', 'Debit', 'Credit', 'Balance'].map((h) => <th key={h} className="text-left px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="px-4 py-2">{formatDate(range.from)}</td><td className="px-4 py-2">Opening balance</td><td /><td /><td className="px-4 py-2 font-medium">{formatCurrency(data.opening)}</td></tr>
                {data.lines.map((l) => (
                  <tr key={l._id}>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(l.date)}</td>
                    <td className="px-4 py-2">{l.description}</td>
                    <td className="px-4 py-2">{l.debit ? formatCurrency(l.debit) : ''}</td>
                    <td className="px-4 py-2 text-green-700">{l.credit ? formatCurrency(l.credit) : ''}</td>
                    <td className="px-4 py-2 font-medium">{formatCurrency(l.balance)}</td>
                  </tr>
                ))}
                {data.lines.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No entries in this period</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
