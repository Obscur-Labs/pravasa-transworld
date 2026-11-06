'use client';
import { useState } from 'react';
import { formatDate } from '@/lib/utils';
import { AlertTriangle, CalendarClock, Check, Download, FileText, Fingerprint, Link2, Loader2, Truck, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { downloadCarryChecklist, uploadDocument } from '@/lib/api';
import type { Application, Document as AppDocument } from '@/types';

const fmt = (s: string) => (s ? formatDate(s) : '');
const MAX_BYTES = 10 * 1024 * 1024;

const nameOf = (app: Application, label: string) => {
  const r = app.formResponses || {};
  return [r[`${label} - Given Name(s)`], r[`${label} - Surname`]].filter(Boolean).join(' ') || label;
};

/** Where a child-only order stands with the parent application it travels on. */
export function ParentLinkNotice({ application }: { application: Application }) {
  const link = application.parentLink;
  if (!link) return null;
  const broken = link.status === 'broken';
  return (
    <Card className={broken ? 'border-red-200 bg-red-50' : 'border-gold-200 bg-gold-50/50'}>
      <CardContent className="p-5 flex items-start gap-3">
        {broken ? <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" /> : <Link2 className="w-5 h-5 text-gold-600 flex-shrink-0 mt-0.5" />}
        <div className="text-sm">
          <p className={`font-semibold ${broken ? 'text-red-800' : 'text-slate-900'}`}>
            {broken ? 'Parent link broken' : `Travelling with parent application ${link.ref}`}
          </p>
          <p className={broken ? 'text-red-700' : 'text-slate-600'}>
            {broken
              ? `The parent application ${link.ref} ${link.reason}. This application is on hold; our team will contact you to link it again.`
              : "The parent's passport copy is taken from that application."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Appointment details, the printable checklist, and whether each traveller has to visit VFS. */
export function VfsCard({ application, letterUrl }: { application: Application; letterUrl: string }) {
  const appt = application.vfsAppointment;
  const [downloading, setDownloading] = useState(false);
  const decided = (application.travellers || []).filter((t) => t.submission?.mode && t.submission.notifiedAt);
  if (!appt?.sentAt && !decided.length) return null;

  const download = async () => {
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
      toast({ title: 'Could not download the checklist', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4 text-sm">
        {appt?.sentAt && (
          <div>
            <p className="font-semibold text-slate-900 flex items-center gap-1.5 mb-2"><CalendarClock className="w-4 h-4 text-gold-600" />VFS appointment</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['Centre', appt.centre], ['Date', fmt(appt.date)], ['Time', appt.time], ['Reference', appt.reference]].map(([k, v]) => (
                <div key={k}><p className="text-xs text-slate-400">{k}</p><p className="font-medium text-slate-900 break-words">{v || '-'}</p></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" onClick={download} disabled={downloading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900 hover:bg-brand-800 text-white text-xs font-semibold px-3 py-2 disabled:opacity-60">
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}Documents to carry (PDF)
              </button>
              {letterUrl && (
                <a href={letterUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 hover:bg-slate-50">
                  <FileText className="w-3.5 h-3.5" />Appointment letter
                </a>
              )}
            </div>
          </div>
        )}
        {decided.length > 0 && (
          <div className={appt?.sentAt ? 'border-t border-slate-100 pt-4' : ''}>
            <p className="font-semibold text-slate-900 flex items-center gap-1.5 mb-2"><Fingerprint className="w-4 h-4 text-gold-600" />Biometrics</p>
            <ul className="space-y-1.5">
              {decided.map((t) => (
                <li key={t.key} className="flex items-start gap-2">
                  <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${t.submission!.mode === 'pravasa' ? 'text-green-600' : 'text-gold-600'}`} />
                  <span>
                    <b>{nameOf(application, t.label)}</b>{' '}
                    {t.submission!.mode === 'pravasa'
                      ? `does not need to visit VFS. Pravasa submitted the documents${t.submission!.date ? ` on ${fmt(t.submission!.date)}` : ''}${t.submission!.reference ? ` (ref ${t.submission!.reference})` : ''}.`
                      : 'needs to visit the VFS centre in person for fingerprints and a photo.'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Documents the embassy asked for after biometrics, each with its own upload. */
export function AdditionalDocsCard({ application, documents, onUploaded }: {
  application: Application; documents: AppDocument[]; onUploaded: () => void;
}) {
  const ad = application.additionalDocs;
  const [busy, setBusy] = useState<string | null>(null);
  if (!ad?.items.length) return null;
  const open = ad.items.filter((i) => i.status === 'requested').length;

  const pick = (requirementName: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jpg,.jpeg,.png,.pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_BYTES) { toast({ title: 'File too large', description: 'Maximum 10 MB.', variant: 'destructive' }); return; }
      setBusy(requirementName);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('requirementName', requirementName);
        await uploadDocument(application._id, fd);
        toast({ title: 'Uploaded', variant: 'success' });
        onUploaded();
      } catch (err: any) {
        toast({ title: 'Upload failed', description: err.response?.data?.message || 'Please try again.', variant: 'destructive' });
      } finally {
        setBusy(null);
      }
    };
    input.click();
  };

  return (
    <Card className={open ? 'border-gold-300' : undefined}>
      <CardContent className="p-5 text-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">Submit additional documents</p>
            <p className="text-xs text-slate-500">Embassy request{ad.dueDate && <> · due {fmt(ad.dueDate)}</>}</p>
          </div>
          {open > 0 && <span className="text-[11px] font-semibold text-gold-700 bg-gold-50 border border-gold-200 rounded-full px-2 py-0.5">Action needed</span>}
        </div>
        {ad.note && <p className="text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{ad.note}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ad.items.map((i) => {
            const doc = documents.find((d) => d.requirementName === i.requirementName);
            const done = i.status === 'uploaded' && doc?.status !== 'rejected';
            return (
              <div key={i.requirementName} className={`rounded-xl border-2 p-3 ${done ? 'border-green-200 bg-green-50' : 'border-dashed border-slate-200'}`}>
                <p className="font-semibold text-slate-900">{i.name}</p>
                <p className="text-xs text-slate-400">{i.appliesTo === 'All' ? 'For the whole family' : i.appliesTo}</p>
                {doc?.status === 'rejected' && <p className="text-xs text-red-600 mt-1">Rejected: {doc.rejectionReason}</p>}
                <button type="button" onClick={() => pick(i.requirementName)} disabled={busy === i.requirementName}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60">
                  {busy === i.requirementName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Upload className="w-3.5 h-3.5" />}
                  {done ? 'Uploaded · Replace' : 'Upload'}
                </button>
              </div>
            );
          })}
        </div>
        {ad.submittedDate && (
          <p className="text-xs text-green-700">Handed to {ad.submittedMethod} on {fmt(ad.submittedDate)}{ad.submittedRef && <> (ref {ad.submittedRef})</>}.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** How the passports and visa come back. */
export function DispatchCard({ application }: { application: Application }) {
  const d = application.dispatch;
  if (!d?.notifiedAt) return null;
  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="p-5 flex items-start gap-3 text-sm">
        <Truck className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-green-900">Your visa is ready</p>
          <p className="text-green-800">
            {d.method === 'courier' ? <>Passports sent by {d.courier}. Tracking number <b className="font-mono">{d.trackingNumber}</b>.</>
              : d.method === 'pickup' ? 'Passports are ready to collect from our Surat office.'
              : 'Your visa copies are available below.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
