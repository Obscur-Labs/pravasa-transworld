'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Upload, Download, CreditCard, Loader2, CheckCircle2, XCircle,
  Clock, FileText, PlusCircle, Archive, ChevronDown, X, PencilLine, AlertTriangle, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import {
  getApplication, uploadDocument, getVaultDocuments, addDocumentFromVault, getUserPayments, downloadReceipt, submitCourierDetails,
} from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { buildReviewRows, travelerOf, travelerTabs } from '@/lib/applicationReview';
import StatusTimeline from '@/components/dashboard/StatusTimeline';
import PaymentDialog from '@/components/payment/PaymentDialog';
import type { Application, ApplicationPayment, Document as AppDocument, VisaFile, DocumentRequirement, VaultDocument } from '@/types';
import { STATUS_LABELS } from '@/types';

// Stages where the application can still be paid for (mirrors the backend).
const PRE_PAYMENT_STAGES = ['submitted', 'documents_under_review', 'documents_approved', 'payment_pending'];

const VAULT_TYPE_LABELS: Record<string, string> = {
  passport: 'Passport',
  aadhar: 'Aadhaar',
  pan: 'PAN Card',
  photograph: 'Photograph',
  bank_statement: 'Bank Statement',
  degree: 'Degree / Diploma',
  other: 'Other',
};

function getVaultType(reqName: string): string | null {
  const n = reqName.toLowerCase();
  if (n.includes('passport')) return 'passport';
  if (n.includes('aadhaar') || n.includes('aadhar') || n.includes('adhar')) return 'aadhar';
  if (n.includes('pan')) return 'pan';
  if (n.includes('photograph') || n.includes('photo')) return 'photograph';
  if (n.includes('bank')) return 'bank_statement';
  if (n.includes('degree') || n.includes('diploma')) return 'degree';
  return null;
}

const docStatusIcon = (status: string) => {
  if (status === 'approved') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-500" />;
  return <Clock className="w-4 h-4 text-yellow-500" />;
};

function triggerFileUpload(onFile: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.jpg,.jpeg,.png,.pdf';
  input.onchange = (e: any) => {
    const file = e.target?.files?.[0];
    if (file) onFile(file);
  };
  input.click();
}

function ExtractedDetails({ data }: { data?: Record<string, string> }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="mx-3.5 mb-3.5 p-3 bg-brand-50/60 rounded-lg border border-brand-100">
      <p className="text-[10px] font-bold text-brand-500 uppercase tracking-wide mb-2">We read these details from your document</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="text-xs">
            <span className="text-slate-400">{k}: </span>
            <span className="font-medium text-slate-800">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [visaFile, setVisaFile] = useState<VisaFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [payment, setPayment] = useState<ApplicationPayment | null>(null);
  const [verificationHours, setVerificationHours] = useState(24);
  const [payOpen, setPayOpen] = useState(false);
  const [payPromo, setPayPromo] = useState<string | undefined>();

  const [courierTracking, setCourierTracking] = useState('');
  const [courierPhone, setCourierPhone] = useState('');
  const [courierExpected, setCourierExpected] = useState('');
  const [editingCourier, setEditingCourier] = useState(false);
  const [savingCourier, setSavingCourier] = useState(false);

  const [vaultDocs, setVaultDocs] = useState<VaultDocument[]>([]);
  const [vaultPickerFor, setVaultPickerFor] = useState<string | null>(null);

  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  const [extraDocName, setExtraDocName] = useState('');
  const [showExtraUpload, setShowExtraUpload] = useState(false);
  const [extraVaultOpen, setExtraVaultOpen] = useState(false);

  const [activeTravelerTab, setActiveTravelerTab] = useState('');

  const fetchData = async () => {
    try {
      const r = await getApplication(id);
      const app = r.data.data.application as Application;
      setApplication(app);
      setDocuments(r.data.data.documents);
      setVisaFile(r.data.data.visaFile);
      setPayment(r.data.data.payment || null);
      setVerificationHours(r.data.data.verificationHours || 24);
      setCourierTracking(app.courier?.trackingNumber || '');
      setCourierPhone(app.courier?.phone || '');
      setCourierExpected(app.courier?.expectedDate || '');
    } finally {
      setLoading(false);
    }
  };

  // The latest completed payment for this application powers the "Download Receipt" button.
  const loadReceiptPayment = () => {
    getUserPayments()
      .then((r) => {
        const payments = (r.data.data || []) as { _id: string; application?: { _id: string } | string }[];
        const match = payments.find((p) => (typeof p.application === 'string' ? p.application : p.application?._id) === id);
        setReceiptPaymentId(match?._id || null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
    loadReceiptPayment();
    getVaultDocuments().then((r) => setVaultDocs(r.data.data || [])).catch(() => {});
  }, [id]);

  // The apply flow lands here with ?pay=1 (and any promo code) to open the payment straight away.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pay') !== '1') return;
    setPayPromo(params.get('promo') || undefined);
    setPayOpen(true);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const handleDownloadReceipt = async () => {
    if (!receiptPaymentId) return;
    setDownloadingReceipt(true);
    try {
      const response = await downloadReceipt(receiptPaymentId);
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${application?.referenceId || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', description: 'Could not generate the receipt. Please try again.', variant: 'destructive' });
    } finally {
      setDownloadingReceipt(false);
    }
  };

  // Sorted traveller tabs derived from uploaded docs + form response keys
  const tabs = useMemo(() => travelerTabs(application, documents), [documents, application]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.includes(activeTravelerTab)) {
      setActiveTravelerTab(tabs[0]);
    }
  }, [tabs.join(',')]);

  // Uploads and answers in the order they were filled, passport details read by OCR
  // appear under their scan only, never again as a separate answer.
  const reviewRows = useMemo(
    () => buildReviewRows(activeTravelerTab, application, documents),
    [activeTravelerTab, application, documents],
  );

  const docCountFor = (tab: string) => documents.filter((d) => travelerOf(d.requirementName) === tab).length;

  const nonTravelerDocs = documents.filter((d) => !travelerOf(d.requirementName));
  const rejectedDocs = documents.filter((d) => d.status === 'rejected');

  const generalResponses = useMemo(() => {
    if (!application) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(application.formResponses)) {
      if (!travelerOf(k)) out[k] = v;
    }
    return out;
  }, [application]);

  const handleUpload = async (file: File, requirementName: string) => {
    setUploading(requirementName);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('requirementName', requirementName.trim());
    try {
      await uploadDocument(id, fd);
      toast({ title: 'Uploaded', description: `${requirementName} uploaded successfully.`, variant: 'success' });
      setExtraDocName('');
      setShowExtraUpload(false);
      setExtraVaultOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.response?.data?.message || 'Try again', variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const handleVaultImport = async (vaultDoc: VaultDocument, requirementName: string) => {
    setUploading(requirementName);
    setVaultPickerFor(null);
    setExtraVaultOpen(false);
    try {
      await addDocumentFromVault(id, { vaultDocId: vaultDoc._id, requirementName });
      toast({ title: 'Imported from vault', description: `${requirementName} linked from vault.`, variant: 'success' });
      setExtraDocName('');
      setShowExtraUpload(false);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.response?.data?.message || 'Try again', variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const handleCourierSubmit = async () => {
    setSavingCourier(true);
    try {
      await submitCourierDetails(id, {
        trackingNumber: courierTracking.trim(),
        phone: courierPhone.trim(),
        expectedDate: courierExpected,
      });
      toast({ title: 'Thanks, we have the details', description: 'We will confirm as soon as your documents arrive.', variant: 'success' });
      setEditingCourier(false);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.response?.data?.message || 'Try again', variant: 'destructive' });
    } finally {
      setSavingCourier(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-4 w-36" />
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-8 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }
  if (!application) return <div className="p-6 text-center text-slate-400">Application not found.</div>;

  const canUploadDocs = ['payment_completed', 'documents_under_review'].includes(application.status);
  const needsPayment = PRE_PAYMENT_STAGES.includes(application.status)
    && !receiptPaymentId
    && payment?.status !== 'completed'
    && payment?.status !== 'awaiting_verification';
  const requirements: DocumentRequirement[] = application.visaType?.documentRequirements || [];

  // A rejection is a request for a replacement, so a rejected document stays replaceable
  // even once the application has moved past the normal upload stages.
  const canReplace = (doc: AppDocument) => canUploadDocs || doc.status === 'rejected';

  // Documents shown nowhere else. Without traveller tabs the flat requirements list
  // below already covers every document that matches a requirement, so only genuinely
  // extra uploads belong here.
  const extraDocs = tabs.length > 0
    ? nonTravelerDocs
    : nonTravelerDocs.filter((d) => !requirements.some((r) => r.name === d.requirementName));

  // Use traveller tabs when docs/responses have traveller prefixes; otherwise fall back to requirements
  const hasTravelerData = tabs.length > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/applications" className="text-slate-400 hover:text-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Application Details</h1>
          <p className="text-xs text-slate-400">Application No. <span className="font-mono text-slate-500">{application.referenceId}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* Application Info */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img src={`https://flagcdn.com/w40/${application.country?.flag}.png`} alt={application.country?.name} className="w-10 h-7 object-cover rounded" />
                  <div>
                    <h2 className="font-bold text-slate-900">{application.visaType?.name}</h2>
                    <p className="text-sm text-slate-500">{application.country?.name}</p>
                  </div>
                </div>
                <Badge variant={
                  application.status === 'visa_approved' || application.status === 'visa_delivered' ? 'success'
                    : application.status === 'visa_rejected' ? 'destructive' : 'info'
                }>
                  {STATUS_LABELS[application.status]}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Submitted</p>
                  <p className="font-medium">{formatDate(application.createdAt)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Visa Fee</p>
                  <p className="font-bold text-brand-700">{formatCurrency(application.paymentAmount)}</p>
                </div>
              </div>
              {application.rejectionReason && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
                  <p className="text-xs font-semibold text-red-700 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-600">{application.rejectionReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action needed, one or more documents came back rejected */}
          {rejectedDocs.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-red-900 mb-1">
                      {rejectedDocs.length === 1 ? 'One document needs to be sent again' : `${rejectedDocs.length} documents need to be sent again`}
                    </h3>
                    <p className="text-red-700 text-sm mb-3">
                      Only these need re-uploading. Everything else you submitted stays as it is.
                    </p>
                    <div className="space-y-2">
                      {rejectedDocs.map((doc) => (
                        <div key={doc._id} className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-white px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{doc.requirementName}</p>
                            {doc.rejectionReason && <p className="text-xs text-red-500 mt-0.5">{doc.rejectionReason}</p>}
                          </div>
                          {uploading === doc.requirementName ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                            </div>
                          ) : (
                            <button
                              onClick={() => triggerFileUpload((file) => handleUpload(file, doc.requirementName))}
                              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex-shrink-0"
                            >
                              <Upload className="w-3.5 h-3.5" /> Upload again
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Courier the original documents */}
          {application.courier?.requested && (
            <Card className="border-violet-200 bg-violet-50">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-violet-900 mb-1">
                      {application.courier.receivedAt ? 'Documents Received' : 'Send Your Original Documents'}
                    </h3>
                    {application.courier.receivedAt ? (
                      <p className="text-violet-700 text-sm">
                        We received your documents on {formatDate(application.courier.receivedAt)}. Nothing more is needed here.
                      </p>
                    ) : (
                      <p className="text-violet-700 text-sm">
                        Please courier the original documents to the address below, then share the consignment details so we can track them.
                      </p>
                    )}

                    {application.courier.instructions && (
                      <div className="mt-3 rounded-xl bg-white border border-violet-200 p-3">
                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mb-1">What to send</p>
                        <p className="text-sm text-slate-700 whitespace-pre-line">{application.courier.instructions}</p>
                      </div>
                    )}
                    {application.courier.address && (
                      <div className="mt-2 rounded-xl bg-white border border-violet-200 p-3">
                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mb-1">Send to</p>
                        <p className="text-sm text-slate-700 whitespace-pre-line">{application.courier.address}</p>
                      </div>
                    )}

                    {application.courier.submittedAt && !editingCourier ? (
                      <div className="mt-3 rounded-xl bg-white border border-violet-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1.5">
                            {application.courier.trackingNumber && (
                              <div>
                                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide">Consignment number</p>
                                <p className="text-sm font-semibold text-slate-900 font-mono">{application.courier.trackingNumber}</p>
                              </div>
                            )}
                            {application.courier.phone && (
                              <div>
                                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide">Contact number</p>
                                <p className="text-sm font-semibold text-slate-900">{application.courier.phone}</p>
                              </div>
                            )}
                            {application.courier.expectedDate && (
                              <div>
                                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide">Expected Date</p>
                                <p className="text-sm font-semibold text-slate-900">{formatDate(application.courier.expectedDate)}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <Badge variant={application.courier.receivedAt ? 'success' : 'secondary'}>
                              {application.courier.receivedAt ? 'Received' : 'In transit'}
                            </Badge>
                            {!application.courier.receivedAt && (
                              <button onClick={() => setEditingCourier(true)}
                                className="text-xs font-semibold text-violet-700 hover:text-violet-900">
                                Update details
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : !application.courier.receivedAt ? (
                      <div className="mt-3 rounded-xl bg-white border border-violet-200 p-3 space-y-2.5">
                        <div>
                          <label className="text-xs font-semibold text-violet-800 block mb-1">Consignment number</label>
                          <input
                            type="text"
                            value={courierTracking}
                            onChange={(e) => setCourierTracking(e.target.value)}
                            placeholder="Tracking number from your courier receipt"
                            className="w-full h-9 px-3 rounded-lg border border-violet-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-violet-800 block mb-1">Contact number</label>
                          <input
                            type="tel"
                            value={courierPhone}
                            onChange={(e) => setCourierPhone(e.target.value)}
                            placeholder="Number we can reach you on about this shipment"
                            className="w-full h-9 px-3 rounded-lg border border-violet-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-violet-800 block mb-1">Expected Date</label>
                          <input
                            type="date"
                            value={courierExpected}
                            onChange={(e) => setCourierExpected(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            className="w-full h-9 px-3 rounded-lg border border-violet-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                          <p className="text-[11px] text-violet-500 mt-1">The delivery date your courier estimated.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={handleCourierSubmit}
                            disabled={savingCourier || (!courierTracking.trim() && !courierPhone.trim() && !courierExpected)}
                            className="bg-violet-600 hover:bg-violet-700">
                            {savingCourier ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share details'}
                          </Button>
                          {editingCourier && (
                            <button onClick={() => setEditingCourier(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2">
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Awaiting payment */}
          {needsPayment && (
            <Card className="border-brand-200 bg-brand-50">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-brand-900 mb-1">Payment Required</h3>
                    <p className="text-brand-700 text-sm">Pay by UPI or bank transfer to start processing your application. Processing begins once our team verifies the payment.</p>
                    <p className="text-2xl font-bold text-brand-900 mt-2">{formatCurrency(application.paymentAmount)}</p>
                  </div>
                  <Button onClick={() => setPayOpen(true)} className="sm:ml-4 shrink-0">
                    <CreditCard className="w-4 h-4 mr-2" />{payment?.status === 'failed' ? 'Pay Again' : 'Pay Now'}
                  </Button>
                </div>

                {payment?.status === 'failed' && payment.failureReason && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-white p-3">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Your last payment could not be verified</p>
                      <p className="text-sm text-red-600 mt-0.5">{payment.failureReason}</p>
                      {payment.rejectedUtr && (
                        <p className="text-xs text-slate-500 mt-1.5">Reference submitted: <span className="font-mono">{payment.rejectedUtr}</span></p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Submitted, waiting for an admin to match it against the bank statement */}
          {payment?.status === 'awaiting_verification' && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-amber-900 mb-0.5">Payment Submitted, Being Verified</h3>
                    <p className="text-amber-800 text-sm">
                      We verify payments within {verificationHours} hours. Visa processing starts once your payment of {formatCurrency(payment.amount)} is verified.
                    </p>
                    <p className="text-xs text-amber-700 mt-2">
                      {payment.method === 'bank_transfer' ? 'Bank transfer' : 'UPI'} &middot; UTR <span className="font-mono font-semibold">{payment.utr}</span>
                      {payment.submittedAt && <> &middot; submitted {formatDate(payment.submittedAt)}</>}
                      {payment.proofUrl && <> &middot; screenshot attached</>}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment confirmed */}
          {application.status === 'payment_completed' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-green-900 mb-0.5">Payment Confirmed!</h3>
                      <p className="text-green-700 text-sm">Our team will review your documents shortly.</p>
                    </div>
                  </div>
                  {receiptPaymentId && (
                    <Button variant="outline" className="border-green-300 text-green-800 hover:bg-green-100 flex-shrink-0" onClick={handleDownloadReceipt} disabled={downloadingReceipt}>
                      {downloadingReceipt ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                      Download Receipt
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment receipt, stays available after the application moves past payment */}
          {receiptPaymentId && !['submitted', 'payment_pending', 'payment_completed'].includes(application.status) && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-slate-800 text-sm">Payment Receipt</h3>
                      <p className="text-xs text-slate-400">Download the receipt for your payment of {formatCurrency(application.paymentAmount)}.</p>
                    </div>
                  </div>
                  <Button variant="outline" className="flex-shrink-0" onClick={handleDownloadReceipt} disabled={downloadingReceipt}>
                    {downloadingReceipt ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                    Download Receipt
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Visa Download */}
          {visaFile && application.status === 'visa_delivered' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-green-900 mb-1">Your Visa is Ready!</h3>
                    <p className="text-green-700 text-sm">Download your approved visa document.</p>
                  </div>
                  <Button className="bg-green-700 hover:bg-green-800 ml-4" onClick={() => window.open(visaFile.url, '_blank')}>
                    <Download className="w-4 h-4 mr-2" />Download Visa
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Visa Submission, embassy details */}
          {['visa_processing', 'embassy_review'].includes(application.status) &&
            (application.processingReferenceNumber || application.embassyName || application.submissionDate) && (
            <Card className="border-brand-200 bg-brand-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-brand-600 flex-shrink-0" />
                  <h3 className="font-bold text-brand-900">Visa Submission</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  {application.processingReferenceNumber && (
                    <div>
                      <p className="text-xs text-brand-600">Reference Number</p>
                      <p className="font-semibold text-brand-900 font-mono">{application.processingReferenceNumber}</p>
                    </div>
                  )}
                  {application.embassyName && (
                    <div>
                      <p className="text-xs text-brand-600">Embassy</p>
                      <p className="font-semibold text-brand-900">{application.embassyName}</p>
                    </div>
                  )}
                  {application.submissionDate && (
                    <div>
                      <p className="text-xs text-brand-600">Submission Date</p>
                      <p className="font-semibold text-brand-900">{formatDate(application.submissionDate)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Traveller-tabbed submission: uploads and answers in the order they were filled ── */}
          {hasTravelerData && (
            <Card>
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">What You Submitted</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {canUploadDocs ? 'Your answers and uploads, in the order you filled them.' : 'Your answers and uploads for this application.'}
                  </p>
                </div>
                <Badge variant="secondary">{documents.length} uploaded</Badge>
              </div>

              {/* Traveller tabs */}
              <div className="flex gap-1 px-5 pt-3 border-b border-slate-100 overflow-x-auto">
                {tabs.map((tab) => {
                  const isChild = tab.toLowerCase().startsWith('child');
                  const tabDocCount = docCountFor(tab);
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTravelerTab(tab)}
                      className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        activeTravelerTab === tab
                          ? isChild
                            ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                            : 'border-brand-500 text-brand-700 bg-brand-50'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab}
                      {tabDocCount > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          activeTravelerTab === tab
                            ? isChild ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-100 text-brand-600'
                            : 'bg-slate-200 text-slate-500'
                        }`}>{tabDocCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <CardContent className="p-5 space-y-5">
                {reviewRows.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Nothing submitted for {activeTravelerTab} yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {reviewRows.map((row, idx) => {
                      const step = (
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums">
                          {idx + 1}
                        </span>
                      );

                      if (row.kind === 'answer') {
                        return (
                          <div key={row.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50/60">
                            {step}
                            <PencilLine className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <p className="text-xs text-slate-400 flex-1 min-w-0 truncate">{row.label}</p>
                            <p className="text-sm font-medium text-slate-900 text-right break-words">{row.value}</p>
                          </div>
                        );
                      }

                      if (row.kind === 'missing') {
                        return (
                          <div key={row.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-amber-200 bg-amber-50/50">
                            {step}
                            <FileText className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <p className="text-sm font-medium text-slate-900 flex-1 min-w-0">{row.label}</p>
                            {canUploadDocs ? (
                              uploading === row.requirementName ? (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                                </div>
                              ) : (
                                <button
                                  onClick={() => triggerFileUpload((file) => handleUpload(file, row.requirementName))}
                                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-brand-600 border-brand-600 text-white hover:bg-brand-700 transition-colors flex-shrink-0"
                                >
                                  <Upload className="w-3.5 h-3.5" /> Upload
                                </button>
                              )
                            ) : (
                              <Badge variant="secondary">Not uploaded</Badge>
                            )}
                          </div>
                        );
                      }

                      const doc = row.doc;
                      return (
                        <div key={row.id} className={`rounded-xl border overflow-hidden ${
                          doc.status === 'approved' ? 'border-green-200 bg-green-50/30' :
                          doc.status === 'rejected' ? 'border-red-200 bg-red-50/30' : 'border-slate-200'
                        }`}>
                          <div className="p-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              {step}
                              {docStatusIcon(doc.status)}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{row.label}</p>
                                {doc.status === 'rejected' && doc.rejectionReason && (
                                  <p className="text-xs text-red-500 mt-0.5">Reason: {doc.rejectionReason}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {doc.status === 'approved' ? (
                                <Badge variant="success">Approved</Badge>
                              ) : canReplace(doc) ? (
                                uploading === doc.requirementName ? (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => triggerFileUpload((file) => handleUpload(file, doc.requirementName))}
                                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                                      doc.status === 'rejected'
                                        ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700'
                                    }`}
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    {doc.status === 'rejected' ? 'Upload again' : 'Replace file'}
                                  </button>
                                )
                              ) : (
                                <Badge variant={doc.status === 'rejected' ? 'destructive' : 'secondary'}>
                                  {doc.status === 'rejected' ? 'Rejected' : 'Under Review'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <ExtractedDetails data={doc.extractedData} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add additional document */}
                {canUploadDocs && (
                  <div className="border-t border-slate-100 pt-4">
                    {!showExtraUpload ? (
                      <button
                        onClick={() => setShowExtraUpload(true)}
                        className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Add additional document
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Document name (e.g. Bank Statement)"
                            value={extraDocName}
                            onChange={(e) => setExtraDocName(e.target.value)}
                            className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <button
                            onClick={() => { setShowExtraUpload(false); setExtraDocName(''); setExtraVaultOpen(false); }}
                            className="text-xs text-slate-400 hover:text-slate-600 px-2"
                          >
                            Cancel
                          </button>
                        </div>
                        {extraDocName.trim() && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExtraVaultOpen(!extraVaultOpen)}
                              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                                extraVaultOpen
                                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700'
                              }`}
                            >
                              <Archive className="w-3.5 h-3.5" />
                              From Vault
                              <ChevronDown className={`w-3 h-3 transition-transform ${extraVaultOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <button
                              disabled={!extraDocName.trim() || uploading !== null}
                              onClick={() => triggerFileUpload((file) => handleUpload(file, extraDocName))}
                              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-brand-600 border-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                            >
                              {uploading === extraDocName
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <><Upload className="w-3.5 h-3.5" /> Upload New</>}
                            </button>
                          </div>
                        )}
                        {extraVaultOpen && extraDocName.trim() && (
                          <div className="rounded-xl border border-purple-200 bg-purple-50 overflow-hidden">
                            <div className="px-4 py-2 border-b border-purple-200 bg-purple-100/60">
                              <p className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
                                <Archive className="w-3.5 h-3.5" /> Select from Document Vault
                              </p>
                            </div>
                            {vaultDocs.length === 0 ? (
                              <p className="text-xs text-slate-500 text-center py-4">No documents in vault.</p>
                            ) : (
                              <div className="divide-y divide-purple-100 max-h-48 overflow-y-auto">
                                {vaultDocs.map((vd) => (
                                  <button
                                    key={vd._id}
                                    onClick={() => handleVaultImport(vd, extraDocName)}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-purple-100 transition-colors text-left"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-purple-200 flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-3.5 h-3.5 text-purple-700" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">{vd.label}</p>
                                        <p className="text-xs text-slate-500">{VAULT_TYPE_LABELS[vd.type] || vd.type}</p>
                                      </div>
                                    </div>
                                    <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                      Use this
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Fallback: flat requirements list (no traveller-prefixed data yet) ── */}
          {!hasTravelerData && (canUploadDocs || documents.length > 0) && (
            <Card>
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Documents</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {canUploadDocs ? 'Upload or import required documents.' : 'Documents submitted for this application.'}
                  </p>
                </div>
                <Badge variant="secondary">{documents.length} uploaded</Badge>
              </div>
              <CardContent className="p-0">
                {requirements.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {requirements.map((req) => {
                      const docMap = Object.fromEntries(documents.map((d) => [d.requirementName, d]));
                      const doc = docMap[req.name];
                      const isUploading = uploading === req.name;
                      const pickerOpen = vaultPickerFor === req.name;
                      const suggestedType = getVaultType(req.name);
                      const suggested = suggestedType ? vaultDocs.filter((v) => v.type === suggestedType) : [];
                      const others = vaultDocs.filter((v) => !suggested.includes(v));

                      return (
                        <div key={req._id || req.name}>
                          <div className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="mt-0.5 flex-shrink-0">
                                {doc ? docStatusIcon(doc.status) : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900">{req.name}{req.required && <span className="text-red-400 ml-1">*</span>}</p>
                                {req.description && <p className="text-xs text-slate-400">{req.description}</p>}
                                {doc?.status === 'rejected' && doc.rejectionReason && (
                                  <p className="text-xs text-red-500 mt-1">Reason: {doc.rejectionReason}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {doc?.status === 'approved' ? (
                                <Badge variant="success">Approved</Badge>
                              ) : canUploadDocs || doc?.status === 'rejected' ? (
                                isUploading ? (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => setVaultPickerFor(pickerOpen ? null : req.name)}
                                      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                                        pickerOpen ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700'
                                      }`}
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                      From Vault
                                      <ChevronDown className={`w-3 h-3 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    <button
                                      onClick={() => triggerFileUpload((file) => handleUpload(file, req.name))}
                                      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-brand-600 border-brand-600 text-white hover:bg-brand-700 transition-colors"
                                    >
                                      <Upload className="w-3.5 h-3.5" />
                                      {doc ? 'Replace' : 'Upload New'}
                                    </button>
                                  </div>
                                )
                              ) : doc ? (
                                // Approved and rejected are handled above, so only pending reaches here.
                                <Badge variant="secondary">Under Review</Badge>
                              ) : (
                                <Badge variant="secondary">Not Uploaded</Badge>
                              )}
                            </div>
                          </div>
                          {pickerOpen && (
                            <div className="mx-4 mb-4 rounded-xl border border-purple-200 bg-purple-50 overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 border-b border-purple-200 bg-purple-100/60">
                                <p className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
                                  <Archive className="w-3.5 h-3.5" /> Select from Document Vault
                                </p>
                                <button onClick={() => setVaultPickerFor(null)} className="text-purple-400 hover:text-purple-700">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {vaultDocs.length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-4">No documents in vault.</p>
                              ) : (
                                <div className="divide-y divide-purple-100 max-h-56 overflow-y-auto">
                                  {suggested.length > 0 && (
                                    <>
                                      <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide px-4 pt-2.5 pb-1">Suggested for &quot;{req.name}&quot;</p>
                                      {suggested.map((vd) => (
                                        <button key={vd._id} onClick={() => handleVaultImport(vd, req.name)}
                                          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-purple-100 transition-colors text-left">
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-purple-200 flex items-center justify-center flex-shrink-0">
                                              <FileText className="w-3.5 h-3.5 text-purple-700" />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-slate-900 truncate">{vd.label}</p>
                                              <p className="text-xs text-slate-500">{VAULT_TYPE_LABELS[vd.type] || vd.type}</p>
                                            </div>
                                          </div>
                                          <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full flex-shrink-0">Use this</span>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  {others.length > 0 && (
                                    <>
                                      {suggested.length > 0 && <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-4 pt-2.5 pb-1">Other Documents</p>}
                                      {others.map((vd) => (
                                        <button key={vd._id} onClick={() => handleVaultImport(vd, req.name)}
                                          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-purple-100 transition-colors text-left">
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-slate-900 truncate">{vd.label}</p>
                                              <p className="text-xs text-slate-500">{VAULT_TYPE_LABELS[vd.type] || vd.type}</p>
                                            </div>
                                          </div>
                                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">Use this</span>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-4 flex items-start gap-3 bg-slate-50 border-b border-slate-100">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-500">No specific document requirements for this visa type.</p>
                  </div>
                )}
                {canUploadDocs && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    {!showExtraUpload ? (
                      <button onClick={() => setShowExtraUpload(true)} className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors">
                        <PlusCircle className="w-4 h-4" />Add additional document
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="Document name" value={extraDocName} onChange={(e) => setExtraDocName(e.target.value)}
                            className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          <button onClick={() => { setShowExtraUpload(false); setExtraDocName(''); }} className="text-xs text-slate-400 hover:text-slate-600 px-2">Cancel</button>
                        </div>
                        {extraDocName.trim() && (
                          <button disabled={uploading !== null} onClick={() => triggerFileUpload((file) => handleUpload(file, extraDocName))}
                            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-brand-600 border-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                            {uploading === extraDocName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Upload className="w-3.5 h-3.5" /> Upload New</>}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Non-traveller docs (uploaded without prefix) */}
          {extraDocs.length > 0 && (
            <Card>
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Additional Documents</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {extraDocs.map((doc) => (
                  <div key={doc._id} className="p-4 flex items-center gap-3">
                    {docStatusIcon(doc.status)}
                    <p className="text-sm font-medium text-slate-900 flex-1">{doc.requirementName}</p>
                    <Badge variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'destructive' : 'secondary'}>
                      {doc.status === 'approved' ? 'Approved' : doc.status === 'rejected' ? 'Rejected' : 'Under Review'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* General (non-traveller) form responses, e.g. travel dates */}
          {Object.keys(generalResponses).length > 0 && (
            <Card>
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Travel Information</h3>
              </div>
              <CardContent className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(generalResponses).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-slate-400">{k}</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{String(v)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Timeline */}
        <div>
          <Card>
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Application Progress</h3>
            </div>
            <CardContent className="p-5">
              <StatusTimeline currentStatus={application.status} />
            </CardContent>
          </Card>
        </div>
      </div>

      <PaymentDialog
        applicationId={id}
        open={payOpen}
        onOpenChange={setPayOpen}
        promoCode={payPromo}
        onSubmitted={fetchData}
      />
    </div>
  );
}
