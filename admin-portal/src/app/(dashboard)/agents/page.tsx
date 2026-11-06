'use client';
import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Download, Loader2, Mail, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import {
  createAgent, emailAgentStatement, exportAgentStatement, getAgents, getAgentStatement, postAgentCommission, recordAgentPayment, updateAgent,
} from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

interface Agent {
  _id: string; name: string; email: string; phone: string; agentCode: string; city: string; contactPerson: string; gstNumber: string;
  creditLimit: number; commissionPct: number; paymentTermsDays: number; used: number; pct: number; apps30: number;
  status: 'active' | 'near_limit' | 'over_limit' | 'paused';
}
interface Kpis { active: number; addedThisMonth: number; creditExtended: number; outstanding: number; commissionThisMonth: number; avgCommission: number }
interface Statement {
  opening: number; invoiced: number; received: number; closing: number; dueBy: string | null;
  lines: { _id: string; date: string; kind: string; description: string; debit: number; credit: number; balance: number }[];
}

const STATUS: Record<Agent['status'], { label: string; tone: string }> = {
  active: { label: 'Active', tone: 'bg-success/10 text-success' },
  near_limit: { label: 'Near limit', tone: 'bg-warning/10 text-warning' },
  over_limit: { label: 'Over limit', tone: 'bg-destructive/10 text-destructive' },
  paused: { label: 'Paused', tone: 'bg-muted text-muted-foreground' },
};
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() + 5.5 * 3600000 - n * 86400000).toISOString().slice(0, 10);
const emptyForm = { name: '', contactPerson: '', phone: '', email: '', gstNumber: '', city: '', creditLimit: '0', commissionPct: '0', paymentTermsDays: '15', agentPaused: false, sendLogin: true };

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState({ from: daysAgo(30), to: istToday() });
  const [statement, setStatement] = useState<Statement | null>(null);
  const [editing, setEditing] = useState<Agent | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [paying, setPaying] = useState(false);
  const [payment, setPayment] = useState({ amount: '', date: istToday(), mode: 'NEFT', reference: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => getAgents()
    .then((r) => { setAgents(r.data.data.agents); setKpis(r.data.data.kpis); setSelected((s) => s || r.data.data.agents[0]?._id || null); })
    .catch(() => toast({ title: 'Could not load agents', variant: 'destructive' }))
    .finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!selected) return;
    setStatement(null);
    getAgentStatement(selected, range).then((r) => setStatement(r.data.data)).catch(() => {});
  }, [selected, range, agents]);

  const agent = agents.find((a) => a._id === selected);

  const openForm = (a: Agent | 'new') => {
    setEditing(a);
    setForm(a === 'new' ? emptyForm : {
      name: a.name, contactPerson: a.contactPerson, phone: a.phone, email: a.email, gstNumber: a.gstNumber, city: a.city,
      creditLimit: String(a.creditLimit), commissionPct: String(a.commissionPct), paymentTermsDays: String(a.paymentTermsDays), agentPaused: a.status === 'paused', sendLogin: false,
    });
  };

  const run = async (fn: () => Promise<{ data: { message?: string } }>, done: string) => {
    setBusy(true);
    try {
      const r = await fn();
      toast({ title: r.data.message || done, variant: 'success' });
      await load();
      return true;
    } catch (err: any) {
      toast({ title: 'Something went wrong', description: err.response?.data?.message, variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveAgent = async () => {
    const body = { ...form, creditLimit: Number(form.creditLimit), commissionPct: Number(form.commissionPct), paymentTermsDays: Number(form.paymentTermsDays) };
    const ok = await run(() => (editing === 'new' ? createAgent(body) : updateAgent((editing as Agent)._id, body)), 'Saved');
    if (ok) setEditing(null);
  };

  const savePayment = async () => {
    if (!agent) return;
    const ok = await run(() => recordAgentPayment(agent._id, { ...payment, amount: Number(payment.amount) }), 'Payment recorded');
    if (ok) { setPaying(false); setPayment({ amount: '', date: istToday(), mode: 'NEFT', reference: '' }); }
  };

  const downloadCsv = async () => {
    if (!agent) return;
    const r = await exportAgentStatement(agent._id, range);
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement-${agent.agentCode || agent.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // The table as a CSV for Excel, built from what is already loaded.
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Code', 'Agency', 'Contact', 'City', 'Email', 'Phone', 'GSTIN', 'Credit limit', 'Used', 'Used %', 'Commission %', 'Terms (days)', 'Apps (30d)', 'Status'],
      ...agents.map((a) => [a.agentCode, a.name, a.contactPerson, a.city, a.email, a.phone, a.gstNumber, a.creditLimit, a.used, a.pct, a.commissionPct, a.paymentTermsDays, a.apps30, STATUS[a.status].label]),
    ];
    const url = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `b2b-agents-${istToday()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const lastMonth = (() => { const d = new Date(Date.now() + 5.5 * 3600000); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const field = (key: keyof typeof emptyForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label htmlFor={`agent-${key}`}>{label}</Label>
      <Input id={`agent-${key}`} className="mt-1" value={String(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">
      <PageHeader
        title="B2B Agents"
        description="Travel agents with a credit line: what they owe, their commission and statements. Agents can bill orders to credit when they apply."
        action={
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => run(() => postAgentCommission(lastMonth), 'Commission posted')}>Post {lastMonth} commission</Button>
            <Button variant="outline" disabled={!agents.length} onClick={exportCsv}><Download className="w-4 h-4 mr-1.5" />Export</Button>
            <Button onClick={() => openForm('new')}><Plus className="w-4 h-4 mr-1.5" />Add agent</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          ['Active agents', kpis ? String(kpis.active) : '', kpis ? `${kpis.addedThisMonth} added this month` : ''],
          ['Total credit extended', kpis ? formatCurrency(kpis.creditExtended) : '', ''],
          ['Outstanding', kpis ? formatCurrency(kpis.outstanding) : '', ''],
          ['Commission this month', kpis ? formatCurrency(kpis.commissionThisMonth) : '', kpis ? `Avg ${kpis.avgCommission}%` : ''],
        ].map(([label, value, sub]) => (
          <Card key={label} className="p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            {loading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>}
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </Card>
        ))}
      </div>

      {!loading && agents.length === 0 ? (
        <EmptyState icon={Briefcase} title="No B2B agents yet" description="Add an agency to give it a credit line and commission." action={<Button onClick={() => openForm('new')}>Add agent</Button>} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>{['Agent', 'Credit limit', 'Used', 'Commission', 'Apps (30d)', 'Status', ''].map((h) => <th key={h} className="text-left font-semibold px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
                )) : agents.map((a) => (
                  <tr key={a._id} onClick={() => setSelected(a._id)} className={cn('border-b border-border last:border-0 cursor-pointer hover:bg-accent/50', selected === a._id && 'bg-accent')}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{[a.agentCode, a.city].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatCurrency(a.creditLimit)}</td>
                    <td className="px-4 py-3 min-w-[150px]">
                      <div className="flex justify-between text-xs"><span className="font-semibold tabular-nums">{formatCurrency(a.used)}</span><span className="text-muted-foreground">{a.pct}%</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full', a.pct >= 90 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${Math.min(100, a.pct)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{a.commissionPct}%</td>
                    <td className="px-4 py-3 tabular-nums">{a.apps30}</td>
                    <td className="px-4 py-3"><span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS[a.status].tone)}>{STATUS[a.status].label}</span></td>
                    <td className="px-4 py-3">
                      <button type="button" aria-label={`Edit ${a.name}`} onClick={(e) => { e.stopPropagation(); openForm(a); }} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><Pencil className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {agent && (
            <Card className="p-4">
              <h2 className="font-semibold text-foreground">Statement · {agent.name}</h2>
              <div className="mt-2 flex gap-2">
                <Input type="date" aria-label="From" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-8 text-xs" />
                <Input type="date" aria-label="To" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-8 text-xs" />
              </div>
              {!statement ? <Skeleton className="h-40 w-full mt-3" /> : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-warning/10 p-3"><p className="text-xs text-muted-foreground">Balance due</p><p className="text-lg font-bold tabular-nums">{formatCurrency(statement.closing)}</p>{statement.dueBy && <p className="text-[11px] text-muted-foreground">Due by {formatDate(statement.dueBy)}</p>}</div>
                    <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Available</p><p className="text-lg font-bold tabular-nums">{formatCurrency(Math.max(0, agent.creditLimit - agent.used))}</p></div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Opening {formatCurrency(statement.opening)} · Invoiced {formatCurrency(statement.invoiced)} · Received {formatCurrency(statement.received)}</p>
                  <ul className="mt-2 divide-y divide-border max-h-80 overflow-y-auto">
                    {statement.lines.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No entries in this period</li>}
                    {statement.lines.map((l) => (
                      <li key={l._id} className="py-2 flex justify-between gap-2 text-sm">
                        <span className="min-w-0"><span className="block font-medium truncate">{l.description}</span><span className="text-xs text-muted-foreground">{formatDate(l.date)} · balance {formatCurrency(l.balance)}</span></span>
                        <span className={cn('font-semibold tabular-nums shrink-0', l.debit ? 'text-destructive' : 'text-success')}>{l.debit ? `+${formatCurrency(l.debit)}` : `-${formatCurrency(l.credit)}`}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={downloadCsv}><Download className="w-3.5 h-3.5 mr-1" />Excel</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => emailAgentStatement(agent._id, range), 'Statement emailed')}><Mail className="w-3.5 h-3.5 mr-1" />Email</Button>
                <Button size="sm" onClick={() => setPaying(true)}>Record payment</Button>
              </div>
            </Card>
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Add B2B agent' : 'Edit agent'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field('name', 'Agency name')}
            {field('contactPerson', 'Contact person')}
            {field('phone', 'Mobile', { placeholder: '+91 98XXX XXXXX' })}
            {field('email', 'Email', { type: 'email', disabled: editing !== 'new' })}
            {field('gstNumber', 'GSTIN (optional)', { maxLength: 15 })}
            {field('city', 'City')}
            {field('creditLimit', 'Credit limit (₹)', { type: 'number', min: 0 })}
            {field('commissionPct', 'Commission %', { type: 'number', min: 0, max: 30, step: 0.5 })}
            <div>
              <Label htmlFor="agent-terms">Payment terms</Label>
              <NativeSelect id="agent-terms" className="mt-1" value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}>
                {['0', '7', '15', '30', '45'].map((d) => <option key={d} value={d}>{d === '0' ? 'Due immediately' : `${d} days`}</option>)}
              </NativeSelect>
            </div>
            <label className="flex items-center gap-2 text-sm self-end pb-2 cursor-pointer">
              <input type="checkbox" className="rounded" checked={form.agentPaused} onChange={(e) => setForm({ ...form, agentPaused: e.target.checked })} />Pause credit
            </label>
          </div>
          {editing === 'new' && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" checked={form.sendLogin} onChange={(e) => setForm({ ...form, sendLogin: e.target.checked })} />Email the agent how to sign in
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveAgent} disabled={busy || !form.name.trim()}>{busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{editing === 'new' ? 'Create agent' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paying} onOpenChange={setPaying}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record payment · {agent?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="pay-amount">Amount (₹)</Label><Input id="pay-amount" className="mt-1" type="number" min={1} value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} /></div>
            <div><Label htmlFor="pay-date">Received on</Label><Input id="pay-date" className="mt-1" type="date" max={istToday()} value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} /></div>
            <div>
              <Label htmlFor="pay-mode">Mode</Label>
              <NativeSelect id="pay-mode" className="mt-1" value={payment.mode} onChange={(e) => setPayment({ ...payment, mode: e.target.value })}>
                {['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash'].map((m) => <option key={m}>{m}</option>)}
              </NativeSelect>
            </div>
            <div><Label htmlFor="pay-ref">UTR / reference</Label><Input id="pay-ref" className="mt-1" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPaying(false)}>Cancel</Button>
            <Button onClick={savePayment} disabled={busy || !(Number(payment.amount) > 0)}>Record payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
