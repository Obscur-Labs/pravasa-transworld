'use client';
import { useState } from 'react';
import { AlertTriangle, ArrowRight, Info, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ALL_STATUSES, STATUS_LABELS } from '@/types';
import type { Application, ApplicationStatus } from '@/types';

export interface StageChange {
  app: Application;
  to: ApplicationStatus;
}

export interface StagePayload {
  status: ApplicationStatus;
  adminNotes?: string;
  rejectionReason?: string;
  embassyName?: string;
  processingReferenceNumber?: string;
  submissionDate?: string;
  expectedDate?: string;
}

const CONSEQUENCES: Partial<Record<ApplicationStatus, string[]>> = {
  payment_completed: [
    'The tracker moves back to Payment Completed.',
    'Embassy details already saved stay on the application.',
  ],
  visa_processing: [
    'The embassy name, reference and dates below show on the tracking page the applicant sees.',
    'You can edit these later from the application page.',
  ],
  embassy_review: [
    'The applicant sees the application is with the embassy for a decision.',
    'The expected decision date below is shown to them.',
  ],
  visa_approved: [
    'The applicant is told the visa is approved.',
    'Next step: upload the visa PDF on the application page. That delivers it and marks it Delivered.',
  ],
  visa_rejected: [
    'The applicant sees the rejection reason you enter below.',
    'The application stays under Visa Rejected until you move it again.',
  ],
};

const toDateInput = (value?: string) => (value ? value.slice(0, 10) : '');
const today = () => new Date().toLocaleDateString('en-CA');

/** Mount with a key per change so the form starts from that application's saved details. */
export function StageChangeDialog({ change, onCancel, onConfirm }: {
  change: StageChange;
  onCancel: () => void;
  onConfirm: (payload: StagePayload) => Promise<void>;
}) {
  const { app, to } = change;
  const [form, setForm] = useState({
    embassyName: app.embassyName || '',
    processingReferenceNumber: app.processingReferenceNumber || '',
    submissionDate: toDateInput(app.submissionDate) || (to === 'embassy_review' ? today() : ''),
    expectedDate: toDateInput(app.expectedDate),
    rejectionReason: '',
    adminNotes: '',
  });
  const [saving, setSaving] = useState(false);
  const from = app.status;
  const isReject = to === 'visa_rejected';
  const isBack = !isReject && from !== 'visa_rejected' && ALL_STATUSES.indexOf(to) < ALL_STATUSES.indexOf(from);
  const needsEmbassy = to === 'visa_processing' || to === 'embassy_review';
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const canConfirm = !isReject || !!form.rejectionReason.trim();

  const handleConfirm = async () => {
    const payload: StagePayload = { status: to, adminNotes: form.adminNotes.trim() || undefined };
    if (needsEmbassy) {
      payload.embassyName = form.embassyName;
      payload.processingReferenceNumber = form.processingReferenceNumber;
      payload.submissionDate = form.submissionDate;
      payload.expectedDate = form.expectedDate;
    }
    if (isReject) payload.rejectionReason = form.rejectionReason.trim();
    setSaving(true);
    try {
      await onConfirm(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Move to {STATUS_LABELS[to]}?</DialogTitle>
          <DialogDescription>
            {app.user?.name} &middot; {app.country?.name} {app.visaType?.name} &middot;{' '}
            <span className="font-mono">{app.referenceId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-medium">{STATUS_LABELS[from]}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className={`px-2.5 py-1 rounded-md font-semibold ${isReject ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
              {STATUS_LABELS[to]}
            </span>
          </div>

          {isBack && (
            <p className="flex items-start gap-2 text-sm rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-foreground">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
              This moves the application back a stage.
            </p>
          )}

          {needsEmbassy && (
            <div className="grid sm:grid-cols-2 gap-3">
              {to === 'visa_processing' && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="stage-embassy">Embassy name</Label>
                  <Input id="stage-embassy" value={form.embassyName} onChange={set('embassyName')} placeholder="e.g. Embassy of Japan, New Delhi" />
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="stage-ref">Embassy reference number</Label>
                <Input id="stage-ref" value={form.processingReferenceNumber} onChange={set('processingReferenceNumber')} placeholder="Shared by the embassy" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stage-submitted">Submission date</Label>
                <Input id="stage-submitted" type="date" value={form.submissionDate} onChange={set('submissionDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stage-expected">Expected decision</Label>
                <Input id="stage-expected" type="date" value={form.expectedDate} onChange={set('expectedDate')} />
              </div>
            </div>
          )}

          {isReject && (
            <div className="space-y-1.5">
              <Label htmlFor="stage-reason">Rejection reason <span className="text-destructive">*</span></Label>
              <textarea
                id="stage-reason"
                rows={3}
                value={form.rejectionReason}
                onChange={set('rejectionReason')}
                placeholder="Shown to the applicant"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="stage-notes">Internal note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="stage-notes" value={form.adminNotes} onChange={set('adminNotes')} placeholder="Only admins see this" />
          </div>

          <div className="rounded-lg bg-muted px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              <Info className="w-3.5 h-3.5" /> What happens
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
              <li>{app.user?.name || 'The applicant'} gets an in-app notification and an email with the new status.</li>
              {(CONSEQUENCES[to] || []).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button variant={isReject ? 'destructive' : 'default'} onClick={handleConfirm} disabled={!canConfirm || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Move to {STATUS_LABELS[to]}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
