'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock, Download, ExternalLink, FileText, Link2, Loader2, Plus, Send, Truck, Unlink, X, Fingerprint, PackageCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/components/ui/use-toast';
import {
  downloadCarryChecklist, markAdditionalDocsSubmitted, requestAdditionalDocs, updateDispatch,
  updateParentLink, updateTravellerSubmission, updateVfsAppointment,
} from '@/lib/api';
import { STATUS_LABELS } from '@/types';
import type { Application, Document, LinkedChild, LinkedParent, Submission, Traveller, VisaFile } from '@/types';

const RELATION_LABELS = { father: 'Father', mother: 'Mother', guardian: 'Guardian' } as const;

const errorOf = (err: unknown) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Please try again.';

/** Runs an admin action with a busy flag, a toast either way, and a refresh on success. */
function useAction(onChanged: () => void) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast({ title: success, variant: 'success' });
      onChanged();
      return true;
    } catch (err) {
      toast({ title: 'Could not save', description: errorOf(err), variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

const travellersOf = (app: Application): Traveller[] =>
  app.travellers?.length
    ? app.travellers
    : [
      ...Array.from({ length: app.adults }, (_, i) => ({ ref: app.referenceId, key: `a${i}`, kind: 'adult' as const, label: `Adult ${i + 1}`, parents: [] })),
      ...Array.from({ length: app.children }, (_, i) => ({ ref: app.referenceId, key: `c${i}`, kind: 'child' as const, label: `Child ${i + 1}`, parents: [] })),
    ];

const nameOf = (app: Application, label: string) => {
  const r = app.formResponses || {};
  return [r[`${label} - Given Name(s)`], r[`${label} - Surname`]].filter(Boolean).join(' ') || label;
};

/* ── Parent / child links across applications ───────────────────────────── */

export function ParentLinkCard({ application, linkedParent, linkedChildren, onChanged }: {
  application: Application;
  linkedParent: LinkedParent | null;
  linkedChildren: LinkedChild[];
  onChanged: () => void;
}) {
  const link = application.parentLink;
  const { busy, run } = useAction(onChanged);
  const [changing, setChanging] = useState(false);
  const [parentRef, setParentRef] = useState('');
  const [relation, setRelation] = useState<'father' | 'mother' | 'guardian'>('guardian');
  if (!link && !linkedChildren.length) return null;

  return (
    <Card className={link?.status === 'broken' ? 'border-destructive/40' : undefined}>
      <div className="p-5 border-b border-border flex items-center gap-2">
        <Link2 className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Linked applications</h3>
      </div>
      <CardContent className="p-5 space-y-4 text-sm">
        {link && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Child-only order, travels with</span>
              <Link href={`/applications/${link.application}`} className="font-mono font-semibold text-primary hover:underline">{link.ref}</Link>
              {link.status === 'broken'
                ? <Badge variant="destructive">Parent link broken</Badge>
                : <Badge variant="success">Linked</Badge>}
              {linkedParent && <span className="text-xs text-muted-foreground">({STATUS_LABELS[linkedParent.status]})</span>}
            </div>
            {link.status === 'broken' && (
              <p className="text-xs text-destructive">The parent application {link.reason}. Keep this application on hold until it is linked again.</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {link.parents.map((p) => (
                <span key={p.key} className="text-[11px] font-medium text-primary bg-primary/10 rounded-md px-1.5 py-0.5">
                  {RELATION_LABELS[p.relation]}: {linkedParent?.adults.find((a) => a.key === p.key)?.name || p.key}
                </span>
              ))}
            </div>
            {linkedParent && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Parent passport copy (auto-attached from {linkedParent.referenceId})</p>
                {linkedParent.passports.length === 0
                  ? <p className="text-xs text-warning">The parent has not uploaded a passport yet.</p>
                  : linkedParent.passports.map((d) => (
                    <a key={d._id} href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline py-0.5">
                      <FileText className="w-3.5 h-3.5" />{d.requirementName}<ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setChanging((v) => !v)}>Change parent</Button>
              {link.status === 'ok' && (
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" disabled={busy}
                  onClick={() => run(() => updateParentLink(application._id, { action: 'unlink' }), 'Unlinked from parent')}>
                  <Unlink className="w-3.5 h-3.5 mr-1" />Unlink
                </Button>
              )}
            </div>
            {changing && (
              <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-3">
                <div>
                  <Label className="text-xs">Parent application ID</Label>
                  <Input className="mt-1 h-8 w-48 font-mono text-xs" placeholder="PRS-ARE-4821" value={parentRef} onChange={(e) => setParentRef(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Relation</Label>
                  <NativeSelect className="mt-1 h-8 text-xs" value={relation} onChange={(e) => setRelation(e.target.value as typeof relation)}>
                    {Object.entries(RELATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </NativeSelect>
                </div>
                <Button size="sm" disabled={busy || !parentRef.trim()}
                  onClick={async () => { if (await run(() => updateParentLink(application._id, { parentRef, relation }), 'Parent changed')) setChanging(false); }}>
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Link'}
                </Button>
              </div>
            )}
          </div>
        )}

        {linkedChildren.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Child-only applications travelling with this one</p>
            <div className="flex flex-wrap gap-2">
              {linkedChildren.map((c) => (
                <Link key={c._id} href={`/applications/${c._id}`}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${c.parentLink.status === 'broken' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                  <Link2 className="w-3 h-3" /><span className="font-mono">{c.referenceId}</span>
                  {c.parentLink.status === 'broken' ? ' · link broken' : ` · ${c.children} child${c.children === 1 ? '' : 'ren'}`}
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── VFS appointment + how each traveller submits ───────────────────────── */

export function VfsPanel({ application, letterUrl, onChanged }: { application: Application; letterUrl: string; onChanged: () => void }) {
  const appt = application.vfsAppointment;
  const { busy, run } = useAction(onChanged);
  const [centre, setCentre] = useState(appt?.centre || '');
  const [date, setDate] = useState(appt?.date || '');
  const [time, setTime] = useState(appt?.time || '');
  const [reference, setReference] = useState(appt?.reference || '');
  const [letter, setLetter] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setCentre(appt?.centre || ''); setDate(appt?.date || ''); setTime(appt?.time || ''); setReference(appt?.reference || '');
  }, [appt?.centre, appt?.date, appt?.time, appt?.reference]);

  const save = (notify: boolean) => {
    const fd = new FormData();
    Object.entries({ centre, date, time, reference, notify: String(notify) }).forEach(([k, v]) => fd.append(k, v));
    if (letter) fd.append('letter', letter);
    return run(() => updateVfsAppointment(application._id, fd), notify ? 'Appointment sent to the customer' : 'Appointment saved')
      .then((ok) => { if (ok) setLetter(null); });
  };

  const downloadChecklist = async () => {
    setDownloading(true);
    try {
      const r = await downloadCarryChecklist(application._id);
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checklist-${application.referenceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Could not create the checklist', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <div className="p-5 border-b border-border flex items-center gap-2 flex-wrap">
        <CalendarClock className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">VFS appointment &amp; submission</h3>
        {appt?.sentAt && <Badge variant="success" className="ml-auto">Sent to customer</Badge>}
      </div>
      <CardContent className="p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs">VFS centre *</Label>
            <Input className="mt-1" placeholder="VFS France, Ahmedabad" value={centre} onChange={(e) => setCentre(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Date *</Label>
            <Input className="mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Time *</Label>
            <Input className="mt-1" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Appointment reference</Label>
            <Input className="mt-1" placeholder="FRAM/AMD/2026/10457" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Appointment letter (PDF)</Label>
            <Input className="mt-1" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setLetter(e.target.files?.[0] || null)} />
            {letterUrl && !letter && (
              <a href={letterUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <FileText className="w-3 h-3" />{appt?.letterName || 'Current letter'}
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => save(false)}>Save</Button>
          <Button size="sm" disabled={busy} onClick={() => save(true)}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" />Save &amp; send to customer</>}
          </Button>
          <Button size="sm" variant="ghost" disabled={downloading} onClick={downloadChecklist}>
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Download className="w-3.5 h-3.5 mr-1" />Documents-to-carry PDF</>}
          </Button>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Fingerprint className="w-4 h-4 text-primary" />Submission type per traveller</p>
          <p className="text-xs text-muted-foreground mb-3">
            Schengen fingerprints can be reused if taken within 59 months. Pravasa policy: we submit on the traveller&apos;s behalf only if they were taken within the last 2 years.
          </p>
          <div className="space-y-3">
            {travellersOf(application).map((t) => (
              <SubmissionRow key={t.key} application={application} traveller={t} onChanged={onChanged} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SubmissionRow({ application, traveller, onChanged }: { application: Application; traveller: Traveller; onChanged: () => void }) {
  const s = traveller.submission;
  const { busy, run } = useAction(onChanged);
  const [biometrics, setBiometrics] = useState<Submission['biometricsWithin2Years']>(s?.biometricsWithin2Years || '');
  const [mode, setMode] = useState<Submission['mode']>(s?.mode || '');
  const [verified, setVerified] = useState(!!s?.previousVisaVerified);
  const [centre, setCentre] = useState(s?.centre || application.vfsAppointment?.centre || '');
  const [reference, setReference] = useState(s?.reference || '');
  const [date, setDate] = useState(s?.date || '');
  const answer = Object.entries(application.formResponses || {})
    .find(([k]) => k.startsWith(`${traveller.label} -`) && /biometric|fingerprint/i.test(k))?.[1];

  const save = (notify: boolean) =>
    run(() => updateTravellerSubmission(application._id, traveller.key, {
      mode, biometricsWithin2Years: biometrics, previousVisaVerified: verified, centre, reference, date, notify,
    }), notify ? 'Saved and customer told' : 'Submission saved');

  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="font-mono text-xs font-semibold">{traveller.ref}</span>
        <span className="text-muted-foreground">{nameOf(application, traveller.label)} · {traveller.label}</span>
        {answer && <span className="text-[11px] text-muted-foreground">Customer said: <b className="text-foreground">{answer}</b></span>}
        {s?.notifiedAt && <Badge variant="secondary" className="ml-auto">Customer told</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted-foreground">Biometrics in last 2 years
          <NativeSelect className="ml-1.5 h-7 text-xs w-auto inline-block" value={biometrics} onChange={(e) => setBiometrics(e.target.value as typeof biometrics)}>
            <option value="">Not checked</option>
            <option value="yes">Yes</option>
            <option value="no">No, first time</option>
          </NativeSelect>
        </label>
        {biometrics === 'yes' && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="rounded" />
            Previous visa copy checked
          </label>
        )}
        <div className="flex gap-1.5" role="radiogroup" aria-label="Submission type">
          {([['visit_vfs', 'A · Visit VFS'], ['pravasa', 'B · Pravasa submits']] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v}
              disabled={v === 'pravasa' && biometrics !== 'yes'}
              onClick={() => setMode(v)}
              className={`px-2 py-1 rounded-md border text-xs font-medium disabled:opacity-40 ${mode === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {mode === 'pravasa' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <Input className="h-8 text-xs" placeholder="Submitted at (centre)" value={centre} onChange={(e) => setCentre(e.target.value)} />
          <Input className="h-8 text-xs" placeholder="Submission reference *" value={reference} onChange={(e) => setReference(e.target.value)} />
          <Input className="h-8 text-xs" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => save(false)}>Save</Button>
        <Button size="sm" className="h-7 text-xs" disabled={busy || !mode} onClick={() => save(true)}>
          {mode === 'pravasa' ? 'Mark submitted & tell customer' : 'Send VFS visit message'}
        </Button>
      </div>
    </div>
  );
}

/* ── Documents the embassy asks for after biometrics ────────────────────── */

export function AdditionalDocsPanel({ application, documents, onChanged }: { application: Application; documents: Document[]; onChanged: () => void }) {
  const ad = application.additionalDocs;
  const { busy, run } = useAction(onChanged);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([{ name: '', appliesTo: 'All' }]);
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [method, setMethod] = useState(ad?.submittedMethod || '');
  const [subRef, setSubRef] = useState(ad?.submittedRef || '');
  const [subDate, setSubDate] = useState(ad?.submittedDate || '');
  const labels = travellersOf(application).map((t) => t.label);

  const send = async () => {
    const ok = await run(() => requestAdditionalDocs(application._id, { items: items.filter((i) => i.name.trim()), note, dueDate }), 'Request sent to the customer');
    if (ok) { setOpen(false); setItems([{ name: '', appliesTo: 'All' }]); setNote(''); setDueDate(''); }
  };

  return (
    <Card>
      <div className="p-5 border-b border-border flex items-center gap-2 flex-wrap">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Additional documents</h3>
        {ad?.items.length ? (
          <Badge variant={ad.items.every((i) => i.status === 'uploaded') ? 'success' : 'warning'} className="ml-1">
            {ad.items.filter((i) => i.status === 'uploaded').length} of {ad.items.length} received
          </Badge>
        ) : null}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen((v) => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1" />Request documents
        </Button>
      </div>
      <CardContent className="p-5 space-y-4 text-sm">
        {open && (
          <div className="rounded-lg bg-muted/40 p-3 space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <Input className="h-8 text-xs" placeholder="e.g. Updated bank statement (last 1 month)" value={it.name}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <NativeSelect className="h-8 text-xs w-36" value={it.appliesTo}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, appliesTo: e.target.value } : x)))}>
                  <option value="All">Whole family</option>
                  {labels.map((l) => <option key={l} value={l}>{l}</option>)}
                </NativeSelect>
                <button type="button" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))} disabled={items.length === 1}
                  className="p-1 text-destructive/70 hover:text-destructive disabled:opacity-30"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setItems([...items, { name: '', appliesTo: 'All' }])} className="text-xs font-medium text-primary hover:underline">+ Another document</button>
            <Textarea rows={2} placeholder="Note to customer * (e.g. The embassy asked for an updated bank statement and hotel confirmation.)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">Due date</Label>
                <Input className="mt-1 h-8 text-xs" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <Button size="sm" disabled={busy || !note.trim() || !items.some((i) => i.name.trim())} onClick={send}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" />Send request</>}
              </Button>
            </div>
          </div>
        )}

        {!ad?.items.length && !open && <p className="text-muted-foreground text-xs">Nothing requested after submission.</p>}

        {ad?.items.length ? (
          <>
            <p className="text-xs text-muted-foreground">
              {ad.note}{ad.dueDate && <> · due {new Date(ad.dueDate).toLocaleDateString('en-IN')}</>}
            </p>
            <div className="space-y-1.5">
              {ad.items.map((i) => {
                const doc = documents.find((d) => d.requirementName === i.requirementName);
                return (
                  <div key={i.requirementName} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{i.name}</span>
                      <span className="text-xs text-muted-foreground"> · {i.appliesTo === 'All' ? 'Whole family' : i.appliesTo}</span>
                    </span>
                    {doc && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />View
                      </a>
                    )}
                    <Badge variant={i.status === 'uploaded' ? 'success' : 'warning'}>{i.status === 'uploaded' ? 'Received' : 'Requested'}</Badge>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Submitted to VFS / embassy</p>
              <div className="flex flex-wrap items-end gap-2">
                <Input className="h-8 text-xs w-44" placeholder="Method (e.g. VFS drop-off)" value={method} onChange={(e) => setMethod(e.target.value)} />
                <Input className="h-8 text-xs w-40" placeholder="Reference" value={subRef} onChange={(e) => setSubRef(e.target.value)} />
                <Input className="h-8 text-xs w-36" type="date" value={subDate} onChange={(e) => setSubDate(e.target.value)} />
                <Button size="sm" variant="outline" className="h-8" disabled={busy || !method.trim() || !subDate}
                  onClick={() => run(() => markAdditionalDocsSubmitted(application._id, { method, reference: subRef, date: subDate }), 'Marked as submitted')}>
                  Mark submitted
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ── Getting the passports back to the customer ─────────────────────────── */

export function DispatchPanel({ application, visaFile, onChanged }: { application: Application; visaFile: VisaFile | null; onChanged: () => void }) {
  const d = application.dispatch;
  const { busy, run } = useAction(onChanged);
  const [method, setMethod] = useState<string>(d?.method || 'courier');
  const [courier, setCourier] = useState(d?.courier || '');
  const [tracking, setTracking] = useState(d?.trackingNumber || '');
  const save = (notify: boolean) =>
    run(() => updateDispatch(application._id, { method, courier, trackingNumber: tracking, notify }), notify ? 'Visa ready message sent' : 'Dispatch saved');

  return (
    <Card>
      <div className="p-5 border-b border-border flex items-center gap-2 flex-wrap">
        <Truck className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Dispatch</h3>
        {d?.notifiedAt && <Badge variant="success" className="ml-auto">Customer told</Badge>}
      </div>
      <CardContent className="p-5 space-y-3 text-sm">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <PackageCheck className="w-3.5 h-3.5" />
          {visaFile ? 'Visa copy uploaded; the customer can download it.' : 'Upload the visa copy from the status panel when it arrives.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <NativeSelect className="h-9 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="courier">Courier</option>
            <option value="pickup">Collect from office</option>
            <option value="digital">Digital only (e-visa)</option>
          </NativeSelect>
          {method === 'courier' && (
            <>
              <Input placeholder="Courier (e.g. Blue Dart)" value={courier} onChange={(e) => setCourier(e.target.value)} />
              <Input placeholder="AWB / tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => save(false)}>Save</Button>
          <Button size="sm" disabled={busy} onClick={() => save(true)}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" />Send &quot;visa ready&quot; message</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
