'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Loader2, Upload, ExternalLink, Download, Trash2,
  Circle, Receipt, FileText, PencilLine, AlertTriangle, Package, Mail, Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import {
  getApplication, reviewDocument, approveAllDocuments, updateStatus, uploadVisaFile,
  manualPaymentOverride, downloadApplicationDocumentsZip, deleteApplication, downloadApplicationReceipt,
  requestCourier, markCourierReceived,
} from '@/lib/api';
import { EmbassyMailDialog } from '@/components/shared/embassy-mail-dialog';
import { PaymentReviewActions } from '@/components/shared/payment-review-actions';
import { formatDate, formatCurrency } from '@/lib/utils';
import { buildReviewRows, generalAnswers, travelerOf, travelerTabs } from '@/lib/applicationReview';
import type { Application, Document, EmbassyMail, Payment, PaymentStatus, VisaFile } from '@/types';
import { STATUS_LABELS, SELECTABLE_STATUSES } from '@/types';

// ── 4-step simplified status ──
const SIMPLIFIED_STEPS = [
  { label: 'Application Submitted', statuses: ['submitted', 'documents_under_review', 'documents_approved', 'payment_pending'] },
  { label: 'Payment Completed', statuses: ['payment_completed'] },
  { label: 'Visa Processing', statuses: ['visa_processing', 'embassy_review'] },
  { label: 'Visa Approved', statuses: ['visa_approved', 'visa_delivered'] },
] as const;

function getStepState(status: string, stepIdx: number): 'done' | 'active' | 'pending' {
  for (let i = 0; i < SIMPLIFIED_STEPS.length; i++) {
    if ((SIMPLIFIED_STEPS[i].statuses as readonly string[]).includes(status)) {
      if (i > stepIdx) return 'done';
      if (i === stepIdx) return 'active';
      return 'pending';
    }
  }
  return 'pending';
}

const PAYMENT_BADGE: Record<PaymentStatus, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  completed: { label: 'Paid', variant: 'success' },
  awaiting_verification: { label: 'To verify', variant: 'warning' },
  pending: { label: 'Not submitted', variant: 'secondary' },
  failed: { label: 'Rejected', variant: 'destructive' },
  refunded: { label: 'Refunded', variant: 'secondary' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = { upi: 'UPI', cash: 'Cash', manual_override: 'Manual', online: 'Card (legacy)' };

// Common reasons, one click away — most rejections are one of these.
const QUICK_REJECT_REASONS = [
  'Image is blurred or unreadable',
  'Wrong document uploaded',
  'Document is expired',
  'Details do not match the application',
  'Page is cropped — full document required',
];

export default function AdminApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [visaFile, setVisaFile] = useState<VisaFile | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [embassyMails, setEmbassyMails] = useState<EmbassyMail[]>([]);
  const [mailOpen, setMailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processingRef, setProcessingRef] = useState('');
  const [embassyName, setEmbassyName] = useState('');
  const [submissionDate, setSubmissionDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [courierOpen, setCourierOpen] = useState(false);
  const [courierInstructions, setCourierInstructions] = useState('');
  const [courierAddress, setCourierAddress] = useState('');
  const [courierBusy, setCourierBusy] = useState(false);

  const fetchData = async () => {
    try {
      const r = await getApplication(id);
      const app = r.data.data.application;
      setApplication(app);
      setDocuments(r.data.data.documents);
      setVisaFile(r.data.data.visaFile);
      setPayments(r.data.data.payments || []);
      setEmbassyMails(r.data.data.embassyMails || []);
      setNewStatus(app.status);
      setProcessingRef(app.processingReferenceNumber || '');
      setEmbassyName(app.embassyName || '');
      setSubmissionDate(app.submissionDate || '');
      setExpectedDate(app.expectedDate || '');
      setCourierInstructions(app.courier?.instructions || '');
      setCourierAddress(app.courier?.address || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  // One tab per traveller. Applications submitted before traveller prefixes existed
  // have none — they get a single unlabelled tab holding everything.
  const tabs = useMemo(() => {
    const found = travelerTabs(application, documents);
    return found.length > 0 ? found : [''];
  }, [application, documents]);

  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab(tabs[0]);
  }, [tabs.join(',')]);

  // Uploads and answers replayed in the order the applicant filled the form.
  const reviewRows = useMemo(
    () => buildReviewRows(activeTab, application, documents),
    [activeTab, application, documents],
  );

  const generalRows = useMemo(() => generalAnswers(application), [application]);

  const docCountFor = (tab: string) => documents.filter((d) => travelerOf(d.requirementName) === tab).length;

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    try {
      const response = await downloadApplicationDocumentsZip(id);
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `docs-${application?.referenceId || id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', description: 'Could not create zip file.', variant: 'destructive' });
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadReceipt = async () => {
    setDownloadingReceipt(true);
    try {
      const response = await downloadApplicationReceipt(id);
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${application?.referenceId || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'No receipt', description: 'No completed payment found for this application.', variant: 'destructive' });
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const handleDocReview = async (documentId: string, status: 'approved' | 'rejected', reason?: string) => {
    setProcessing(true);
    try {
      await reviewDocument(id, { documentId, status, rejectionReason: reason });
      toast({
        title: status === 'approved' ? 'Document approved' : 'Document rejected',
        description: status === 'rejected' ? 'The applicant was notified and can upload a replacement.' : undefined,
        variant: status === 'approved' ? 'success' : 'destructive',
      });
      setRejectingId(null);
      setRejectReason('');
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const openReject = (documentId: string) => {
    setRejectingId(documentId);
    setRejectReason('');
  };

  const handleApproveAll = async () => {
    setProcessing(true);
    try {
      await approveAllDocuments(id);
      toast({ title: 'All documents approved!', variant: 'success' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleStatusUpdate = async () => {
    setProcessing(true);
    try {
      await updateStatus(id, {
        status: newStatus,
        rejectionReason,
        adminNotes,
        processingReferenceNumber: processingRef,
        embassyName,
        submissionDate,
        expectedDate,
      });
      toast({ title: 'Status updated', variant: 'success' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  // Save embassy submission details without changing the current status.
  const handleSaveVisaSubmission = async () => {
    if (!application) return;
    setProcessing(true);
    try {
      await updateStatus(id, {
        status: application.status,
        processingReferenceNumber: processingRef,
        embassyName,
        submissionDate,
        expectedDate,
      });
      toast({ title: 'Visa submission details saved', variant: 'success' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleVisaUpload = async (file: File) => {
    setProcessing(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      await uploadVisaFile(id, fd);
      toast({ title: 'Visa uploaded and delivered to user!', variant: 'success' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleCourier = async (action: 'request' | 'withdraw' | 'received') => {
    setCourierBusy(true);
    try {
      if (action === 'received') {
        await markCourierReceived(id);
        toast({ title: 'Marked as received', variant: 'success' });
      } else if (action === 'withdraw') {
        await requestCourier(id, { requested: false });
        toast({ title: 'Courier request withdrawn' });
      } else {
        await requestCourier(id, { requested: true, instructions: courierInstructions, address: courierAddress });
        toast({ title: 'Courier request sent', description: 'The applicant has been notified.', variant: 'success' });
      }
      setCourierOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setCourierBusy(false);
    }
  };

  const handleTrash = async () => {
    try {
      await deleteApplication(id);
      toast({ title: 'Moved to Trash', description: 'Restore it anytime from the Trash page.', variant: 'success' });
      router.push('/applications');
    } catch (err: any) {
      toast({ title: 'Failed to move to trash', description: err.response?.data?.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-5 w-5 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  if (!application) return <div className="p-6 text-center text-muted-foreground">Application not found.</div>;

  const pendingDocs = documents.filter((d) => d.status === 'pending');
  const rejectedDocs = documents.filter((d) => d.status === 'rejected');

  // The applicant's estimate has come and gone with nothing logged as received — worth
  // flagging so a lost consignment gets chased instead of quietly sitting there. Both
  // sides are YYYY-MM-DD, so compare as text: parsing them as dates would put the stored
  // value at UTC midnight and the local day boundary elsewhere, flagging a day early.
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const courierOverdue = !!application.courier?.expectedDate
    && !application.courier.receivedAt
    && application.courier.expectedDate < todayStr;

  // Manual dropdown mirrors the 4-step progress (+ Rejected). Keep the current status
  // visible even if it's an internal sub-status set automatically by the workflow.
  const statusOptions = SELECTABLE_STATUSES.includes(application.status)
    ? SELECTABLE_STATUSES
    : [application.status, ...SELECTABLE_STATUSES];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/applications" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Application Review</h1>
          <p className="text-xs text-muted-foreground">Application No. <span className="font-mono text-muted-foreground/80">{application.referenceId}</span></p>
        </div>
        <Button variant="outline" onClick={() => setConfirmTrash(true)}
          className="ml-auto text-destructive border-destructive/20 hover:bg-destructive/10">
          <Trash2 className="w-4 h-4 mr-2" /> Move to Trash
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Application Info */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img src={`https://flagcdn.com/w40/${application.country?.flag}.png`} alt={application.country?.name} className="w-10 h-7 object-cover rounded" />
                  <div>
                    <h2 className="font-bold text-foreground">{application.visaType?.name}</h2>
                    <p className="text-sm text-muted-foreground">{application.country?.name}</p>
                  </div>
                </div>
                <Badge variant={application.status === 'visa_approved' || application.status === 'visa_delivered' ? 'success' : application.status === 'visa_rejected' ? 'destructive' : 'info'}>
                  {STATUS_LABELS[application.status]}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Applicant</p>
                  <p className="font-medium text-foreground">{application.user?.name}</p>
                  <p className="text-xs text-muted-foreground">{application.user?.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <p className="font-medium text-foreground">{application.user?.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fee</p>
                  <p className="font-bold text-primary tabular-nums">{formatCurrency(application.paymentAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Submitted</p>
                  <p className="font-medium text-foreground">{formatDate(application.createdAt)}</p>
                </div>
              </div>

              {/* Answers that belong to the trip rather than any one traveller (travel dates, …) */}
              {generalRows.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  {generalRows.map(([k, v]) => (
                    <div key={k}>
                      <p className="text-muted-foreground text-xs">{k}</p>
                      <p className="font-medium text-foreground">{String(v)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submitted Form — uploads and answers replayed in the order they were filled */}
          {(documents.length > 0 || Object.keys(application.formResponses).length > 0) && (
            <Card>
              <div className="p-5 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">Submitted Form</h3>
                  <p className="text-xs text-muted-foreground">
                    {documents.length} document(s) &middot; reviewed in the order the applicant filled them
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {documents.length > 0 && (
                    <Button size="sm" variant="outline" onClick={handleDownloadZip} disabled={downloadingZip}>
                      {downloadingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Download className="w-3.5 h-3.5 mr-1.5" />Download All</>}
                    </Button>
                  )}
                  {pendingDocs.length > 0 && (
                    <Button size="sm" onClick={handleApproveAll} disabled={processing}>
                      {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Approve All (${pendingDocs.length})`}
                    </Button>
                  )}
                </div>
              </div>

              {rejectedDocs.length > 0 && (
                <div className="px-5 py-3 bg-destructive/10 border-b border-destructive/20 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    <span className="font-semibold">{rejectedDocs.length} document(s) rejected.</span>{' '}
                    The applicant has been notified and can upload a replacement for each one.
                  </p>
                </div>
              )}

              {/* Traveller tabs */}
              {tabs.length > 1 && (
                <div className="flex gap-1 px-5 pt-3 border-b border-border pb-0 overflow-x-auto">
                  {tabs.map((tab) => {
                    const isChild = tab.toLowerCase().startsWith('child');
                    return (
                      <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setRejectingId(null); }}
                        className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                          activeTab === tab
                            ? (isChild ? 'border-success text-success bg-success/10' : 'border-primary text-primary bg-accent')
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {tab || 'Applicant'}
                        <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                          {docCountFor(tab)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <CardContent className="p-5 space-y-2.5">
                {reviewRows.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nothing submitted for this traveller yet.</p>
                )}

                {reviewRows.map((row, idx) => {
                  const step = (
                    <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[11px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                  );

                  if (row.kind === 'answer') {
                    return (
                      <div key={row.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/30">
                        {step}
                        <PencilLine className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs text-muted-foreground flex-1 min-w-0 truncate">{row.label}</p>
                        <p className="text-sm font-medium text-foreground text-right break-words">{row.value}</p>
                      </div>
                    );
                  }

                  if (row.kind === 'missing') {
                    return (
                      <div key={row.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-warning/40 bg-warning/5">
                        {step}
                        <FileText className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                        <p className="text-sm font-medium text-foreground flex-1 min-w-0">{row.label}</p>
                        <Badge variant="warning">Not uploaded</Badge>
                      </div>
                    );
                  }

                  const doc = row.doc;
                  const isRejecting = rejectingId === doc._id;
                  return (
                    <div
                      key={row.id}
                      className={`rounded-xl border overflow-hidden ${
                        doc.status === 'approved' ? 'border-success/30 bg-success/5'
                          : doc.status === 'rejected' ? 'border-destructive/30 bg-destructive/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="p-3 flex items-center gap-3 flex-wrap">
                        {step}
                        {doc.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          : doc.status === 'rejected' ? <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                          : <Clock className="w-4 h-4 text-warning flex-shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm">{row.label}</p>
                          {doc.status === 'rejected' && doc.rejectionReason && (
                            <p className="text-xs text-destructive">Reason: {doc.rejectionReason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
                            <ExternalLink className="w-3.5 h-3.5" /> View
                          </a>
                          {doc.status !== 'approved' && (
                            <Button size="sm" variant="outline" className="text-success border-success/20 hover:bg-success/10"
                              onClick={() => handleDocReview(doc._id, 'approved')} disabled={processing}>
                              Approve
                            </Button>
                          )}
                          {doc.status !== 'rejected' && (
                            <Button size="sm" variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10"
                              onClick={() => (isRejecting ? setRejectingId(null) : openReject(doc._id))} disabled={processing}>
                              Reject
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* OCR values are shown here, at the scan they came from — the applicant's
                          answers list never repeats them. */}
                      {doc.extractedData && Object.keys(doc.extractedData).length > 0 && (
                        <div className="mx-3 mb-3 p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Read from this document</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                            {Object.entries(doc.extractedData).map(([k, v]) => (
                              <div key={k} className="text-xs">
                                <span className="text-muted-foreground">{k}: </span>
                                <span className="font-medium text-foreground">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isRejecting && (
                        <div className="mx-3 mb-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
                          <p className="text-xs font-semibold text-destructive">
                            Why is this rejected? The applicant sees this and can re-upload just this document.
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_REJECT_REASONS.map((r) => (
                              <button
                                key={r}
                                onClick={() => setRejectReason(r)}
                                className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                                  rejectReason === r
                                    ? 'bg-destructive text-destructive-foreground border-destructive'
                                    : 'border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive'
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={2}
                            placeholder="Add or edit the reason…"
                            className="w-full px-2 py-1.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="destructive" disabled={!rejectReason.trim() || processing}
                              onClick={() => handleDocReview(doc._id, 'rejected', rejectReason.trim())}>
                              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Reject & notify applicant'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)} disabled={processing}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-5">
          {/* 4-Step Status + Update */}
          <Card>
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Application Progress</h3>
            </div>
            <CardContent className="p-4 space-y-4">
              {/* 4-step visual */}
              {application.status === 'visa_rejected' ? (
                <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-xl border border-destructive/20">
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  <p className="text-sm font-semibold text-destructive">Visa Rejected</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {SIMPLIFIED_STEPS.map((step, idx) => {
                    const state = getStepState(application.status, idx);
                    const isLast = idx === SIMPLIFIED_STEPS.length - 1;
                    return (
                      <div key={step.label} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                            state === 'done' ? 'bg-success border-success' :
                            state === 'active' ? 'bg-primary border-primary' :
                            'bg-card border-border'
                          }`}>
                            {state === 'done' ? <CheckCircle2 className="w-4 h-4 text-success-foreground" /> :
                             state === 'active' ? <Clock className="w-3.5 h-3.5 text-primary-foreground animate-pulse" /> :
                             <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                          {!isLast && <div className={`w-0.5 h-8 my-0.5 ${state === 'done' ? 'bg-success/50' : 'bg-border'}`} />}
                        </div>
                        <div className="pt-1.5">
                          <p className={`text-sm font-medium ${
                            state === 'done' ? 'text-success' :
                            state === 'active' ? 'text-primary' :
                            'text-muted-foreground'
                          }`}>{step.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Visa Submission — embassy details entered during processing, shared with the applicant */}
              {application.status === 'visa_processing' && (
                <div className="p-3 bg-accent rounded-xl border border-primary/20 space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wide">Visa Submission</h4>
                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">Reference Number</label>
                    <input
                      type="text"
                      value={processingRef}
                      onChange={(e) => setProcessingRef(e.target.value)}
                      placeholder="Reference shared by the embassy"
                      className="w-full h-9 px-3 rounded-lg border border-primary/30 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">Embassy Name</label>
                    <input
                      type="text"
                      value={embassyName}
                      onChange={(e) => setEmbassyName(e.target.value)}
                      placeholder="e.g. Embassy of Japan, New Delhi"
                      className="w-full h-9 px-3 rounded-lg border border-primary/30 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">Submission Date</label>
                    <input
                      type="date"
                      value={submissionDate}
                      onChange={(e) => setSubmissionDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-primary/30 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">Expected Date</label>
                    <input
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-primary/30 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground"
                    />
                  </div>
                  <Button size="sm" className="w-full" onClick={handleSaveVisaSubmission} disabled={processing}>
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Visa Submission'}
                  </Button>
                </div>
              )}

              {/* Visa upload for visa_approved */}
              {application.status === 'visa_approved' && (
                <div className="p-3 bg-success/10 rounded-xl border border-success/20 space-y-2">
                  <p className="text-xs font-semibold text-success">Upload Approved Visa Document</p>
                  <p className="text-xs text-success/80">Upload the PDF to deliver it to the applicant.</p>
                  <input type="file" id="visaUpload" accept=".pdf" className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handleVisaUpload(file); }} />
                  <Button className="w-full bg-success text-success-foreground hover:bg-success/90" size="sm"
                    onClick={() => document.getElementById('visaUpload')?.click()} disabled={processing}>
                    <Upload className="w-3.5 h-3.5 mr-2" />
                    {processing ? 'Uploading...' : 'Upload Visa PDF'}
                  </Button>
                  {visaFile && (
                    <a href={visaFile.url} target="_blank" rel="noopener noreferrer"
                      className="text-success text-xs hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View current visa file
                    </a>
                  )}
                </div>
              )}

              {/* Visa delivered info */}
              {visaFile && application.status === 'visa_delivered' && (
                <div className="p-3 bg-success/10 rounded-xl border border-success/20">
                  <p className="font-semibold text-success text-sm mb-1">Visa Delivered</p>
                  <a href={visaFile.url} target="_blank" rel="noopener noreferrer"
                    className="text-success text-xs hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> View delivered visa
                  </a>
                </div>
              )}

              {/* Download Receipt */}
              <Button variant="outline" className="w-full" onClick={handleDownloadReceipt} disabled={downloadingReceipt}>
                {downloadingReceipt
                  ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  : <Receipt className="w-4 h-4 mr-2" />}
                Download Payment Receipt
              </Button>

              <div className="border-t border-border pt-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Update Status</p>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                {newStatus === 'visa_rejected' && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Rejection Reason</label>
                    <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2}
                      className="w-full px-2 py-1.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                  </div>
                )}
                {newStatus === 'visa_processing' && application.status !== 'visa_processing' && (
                  <p className="text-xs text-primary bg-accent rounded-lg px-2 py-1.5">
                    After saving, enter the embassy reference, name and submission date in the Visa Submission box above.
                  </p>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Admin Notes (internal)</label>
                  <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2}
                    className="w-full px-2 py-1.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>
                <Button className="w-full" onClick={handleStatusUpdate} disabled={processing}>
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Status'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Forward the application to the embassy / agency handling it */}
          <Card>
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Embassy Mail</h3>
              {embassyMails.length > 0 && (
                <Badge variant="info" className="ml-auto">{embassyMails.length} sent</Badge>
              )}
            </div>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Mail this application&apos;s details and documents to the embassy or agency. The draft is
                written from your saved format and stays editable before sending.
              </p>
              <Button className="w-full" onClick={() => setMailOpen(true)}>
                <Mail className="w-4 h-4 mr-2" />
                {embassyMails.length > 0 ? 'Send Another Mail' : 'Compose Mail'}
              </Button>

              {embassyMails.length > 0 && (
                <div className="pt-1 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Already sent</p>
                  {embassyMails.map((mail) => (
                    <div key={mail._id} className="p-2.5 rounded-lg border border-border bg-muted/30">
                      <p className="text-xs font-semibold text-foreground break-all">{mail.to}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mail.subject}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                        <span>{formatDate(mail.createdAt)}</span>
                        <span>&middot;</span>
                        <span>{mail.sentByName}</span>
                        {mail.attachments.length > 0 && (
                          <>
                            <span>&middot;</span>
                            <span className="inline-flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />{mail.attachments.length}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cash Payment Override */}
          {['payment_pending', 'submitted'].includes(application.status) && (
            <Card className="border-warning/30">
              <div className="p-4 border-b border-warning/20 bg-warning/10">
                <h3 className="font-semibold text-warning">Cash Payment Override</h3>
                <p className="text-xs text-warning/80 mt-0.5">Mark as paid if user paid in cash</p>
              </div>
              <CardContent className="p-4 space-y-3">
                <textarea id="cashNote" rows={2} placeholder="Note (e.g. 'Cash received at office')"
                  className="w-full px-2 py-1.5 rounded-lg border border-input bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-warning resize-none" />
                <Button className="w-full bg-warning text-warning-foreground hover:bg-warning/90"
                  onClick={async () => {
                    const note = (document.getElementById('cashNote') as HTMLTextAreaElement)?.value;
                    setProcessing(true);
                    try {
                      await manualPaymentOverride(application._id, note);
                      toast({ title: 'Payment marked as paid (cash)', variant: 'success' });
                      fetchData();
                    } catch (err: any) {
                      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
                    } finally { setProcessing(false); }
                  }}
                  disabled={processing}>
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark as Paid (Cash)'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Payment attempts — a declined checkout is why an application stalls at payment */}
          {payments.length > 0 && (
            <Card>
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Payments</h3>
              </div>
              <div className="divide-y divide-border">
                {payments.map((p) => (
                  <div key={p._id} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-foreground tabular-nums">{formatCurrency(p.amount)}</p>
                      <Badge variant={PAYMENT_BADGE[p.status].variant}>{PAYMENT_BADGE[p.status].label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {PAYMENT_METHOD_LABELS[p.method] || 'Online'} &middot; {formatDate(p.paidAt || p.failedAt || p.submittedAt || p.createdAt)}
                      {p.verifiedByName && <> &middot; {p.status === 'failed' ? 'rejected' : 'verified'} by {p.verifiedByName}</>}
                    </p>
                    {p.status === 'failed' && p.failureReason && (
                      <p className="text-xs text-destructive mt-1.5">{p.failureReason}</p>
                    )}
                    {(p.utr || p.rejectedUtr || p.transactionId) && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-1 break-all">
                        {p.method === 'upi' ? 'UTR ' : ''}{p.utr || p.rejectedUtr || p.transactionId}
                      </p>
                    )}
                    {p.status === 'awaiting_verification' && (
                      <div className="mt-3">
                        <PaymentReviewActions paymentId={p._id} amount={p.amount} utr={p.utr} onDone={fetchData} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Original documents by courier */}
          <Card>
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Courier Documents</h3>
            </div>
            <CardContent className="p-4 space-y-3">
              {!application.courier?.requested && !courierOpen && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Ask the applicant to send the original documents to your office.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => setCourierOpen(true)}>
                    Request Documents by Courier
                  </Button>
                </>
              )}

              {courierOpen && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">What to send</label>
                    <textarea
                      value={courierInstructions}
                      onChange={(e) => setCourierInstructions(e.target.value)}
                      rows={2}
                      placeholder="e.g. Original passport and two photographs"
                      className="w-full px-2 py-1.5 rounded-lg border border-input bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Send to</label>
                    <textarea
                      value={courierAddress}
                      onChange={(e) => setCourierAddress(e.target.value)}
                      rows={3}
                      placeholder="Office address the documents should reach"
                      className="w-full px-2 py-1.5 rounded-lg border border-input bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button className="flex-1" onClick={() => handleCourier('request')} disabled={courierBusy}>
                      {courierBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : application.courier?.requested ? 'Update Request' : 'Send Request'}
                    </Button>
                    <Button variant="ghost" onClick={() => setCourierOpen(false)} disabled={courierBusy}>Cancel</Button>
                  </div>
                </div>
              )}

              {application.courier?.requested && !courierOpen && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Requested {application.courier.requestedAt ? formatDate(application.courier.requestedAt) : ''}
                    </p>
                    <Badge variant={application.courier.receivedAt ? 'success' : application.courier.submittedAt ? 'info' : 'warning'}>
                      {application.courier.receivedAt ? 'Received' : application.courier.submittedAt ? 'In transit' : 'Awaiting shipment'}
                    </Badge>
                  </div>

                  {application.courier.instructions && (
                    <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">What to send</p>
                      <p className="text-xs text-foreground whitespace-pre-line">{application.courier.instructions}</p>
                    </div>
                  )}

                  {application.courier.submittedAt ? (
                    <div className="p-2.5 rounded-lg bg-accent border border-primary/20 space-y-2">
                      {application.courier.trackingNumber && (
                        <div>
                          <p className="text-[10px] font-bold text-primary uppercase tracking-wide">Consignment number</p>
                          <p className="text-sm font-semibold text-foreground font-mono break-all">{application.courier.trackingNumber}</p>
                        </div>
                      )}
                      {application.courier.phone && (
                        <div>
                          <p className="text-[10px] font-bold text-primary uppercase tracking-wide">Contact number</p>
                          <p className="text-sm font-semibold text-foreground">{application.courier.phone}</p>
                        </div>
                      )}
                      {application.courier.expectedDate && (
                        <div>
                          <p className="text-[10px] font-bold text-primary uppercase tracking-wide">Expected arrival</p>
                          <p className="text-sm font-semibold text-foreground">{formatDate(application.courier.expectedDate)}</p>
                          {courierOverdue && (
                            <p className="text-[11px] text-warning font-medium mt-0.5">Past the expected date — not marked received yet.</p>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Shared {formatDate(application.courier.submittedAt)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Waiting for the applicant to share the consignment details.
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    {!application.courier.receivedAt && (
                      <Button size="sm" className="flex-1" onClick={() => handleCourier('received')} disabled={courierBusy}>
                        {courierBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Mark as Received'}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setCourierOpen(true)} disabled={courierBusy}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleCourier('withdraw')} disabled={courierBusy}>
                      Withdraw
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EmbassyMailDialog
        applicationId={id}
        applicationRef={application.referenceId}
        open={mailOpen}
        onOpenChange={setMailOpen}
        onSent={fetchData}
      />

      <ConfirmDialog
        open={confirmTrash}
        onOpenChange={setConfirmTrash}
        title="Move this application to Trash?"
        description="You can restore it later from the Trash page."
        confirmLabel="Move to Trash"
        onConfirm={handleTrash}
      />
    </div>
  );
}
