'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, ChevronLeft, Loader2, Check, Upload, X, FileText, Search,
  Vault, CreditCard, BookOpen, Calendar, Globe, Clock, MapPin, Tag, Copy,
  Users, Minus, Plus, Shield, ArrowRight, Download, Info, PencilLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import {
  getActiveCountries, getPublicVisaTypes, createApplication, uploadDocument,
  addDocumentFromVault, getVaultDocuments,
  validatePromoCode, downloadVisaSummaryPdf,
} from '@/lib/api';
import PassportScanCard, { PASSPORT_FRONT_FIELDS, PASSPORT_BACK_FIELDS } from '@/components/passport/PassportScanCard';
import { formatCurrency } from '@/lib/utils';
import { useVisaConfigLabels } from '@/lib/useVisaConfigLabels';
import { useAuthStore } from '@/store/auth.store';
import { mergeFormItems, shownSubFields } from '@/types';
import type { Country, VisaType, FormField, FormItem, DocumentRequirement, VaultDocument, SubField } from '@/types';

type Step = 1 | 2 | 3 | 4;
type DocSource =
  | { type: 'vault'; vaultDocId: string; label: string; url: string }
  | { type: 'file'; file: File };
type Traveler = { key: string; label: string; type: 'adult' | 'child' };

const STEPS = ['Country', 'Visa Type', 'Applicant Details', 'Review & Pay'];
const DRAFT_KEY = 'visa_app_draft';
const ACCEPTED = '.jpg,.jpeg,.png,.pdf';
// Fixed 18% GST applied to the service fee only (visa + VFS are untaxed), mirrors backend.
const GST_RATE = 0.18;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


const isPassportReq = (name: string) => name.toLowerCase().includes('passport');
// Only the explicit 'passport' docType renders the 2-slot front+back uploader, a
// document merely named "passport ..." (e.g. an extra/external page) should not be
// swept into the pair card, it just needs a single simple upload.
const isPassportPair = (req: DocumentRequirement) => req.docType === 'passport';
// order -1 keeps the implicit passport ahead of every authored row, matching the
// prepend it used to get before fields and documents shared one ordering.
const PASSPORT_DEFAULT_REQ: DocumentRequirement = {
  _id: '__passport_default__', name: 'Passport', description: '', required: true, applicantType: 'both', docType: 'passport', ocrEnabled: true, order: -1,
};
const withDefaultPassport = (docs: DocumentRequirement[]): DocumentRequirement[] => {
  const hasPassport = docs.some((d) => (!!d.docType && d.docType.startsWith('passport')) || isPassportReq(d.name));
  return hasPassport ? docs : [PASSPORT_DEFAULT_REQ, ...docs];
};

function getVaultType(reqName: string): string | null {
  const lower = reqName.toLowerCase();
  if (lower.includes('passport')) return 'passport';
  if (lower.includes('aadhaar') || lower.includes('aadhar') || lower.includes('adhar')) return 'aadhar';
  if (lower.includes('pan')) return 'pan';
  if (lower.includes('photograph') || lower.includes('photo')) return 'photograph';
  if (lower.includes('bank')) return 'bank_statement';
  if (lower.includes('degree') || lower.includes('diploma')) return 'degree';
  return null;
}

const JURISDICTION_LABELS: Record<string, string> = {
  'pan-india': 'Pan India', mumbai: 'Mumbai', delhi: 'Delhi',
};

const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDisplay = (s: string) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const buildTravelers = (adults: number, children: number): Traveler[] => {
  const list: Traveler[] = [];
  for (let i = 0; i < adults; i++) list.push({ key: `a${i}`, label: `Adult ${i + 1}`, type: 'adult' });
  for (let i = 0; i < children; i++) list.push({ key: `c${i}`, label: `Child ${i + 1}`, type: 'child' });
  return list;
};

const appliesToTraveler = (applicantType: string | undefined, trType: 'adult' | 'child'): boolean => {
  const t = applicantType || 'adult';
  return t === 'both' || t === trType;
};

const fieldsForTraveler = (fields: FormField[], tr: Traveler) =>
  fields.filter((f) => appliesToTraveler(f.applicantType, tr.type));

// Each question plus the follow-ups its current answer reveals.
const questionsForTraveler = (fields: FormField[], tr: Traveler, formData: Record<string, string>) =>
  fieldsForTraveler(fields, tr).flatMap((f): (FormField | SubField)[] => [f, ...shownSubFields(f, formData[`${tr.key}__${f.fieldName}`])]);

const docsForTraveler = (docs: DocumentRequirement[], tr: Traveler) =>
  docs.filter((d) => appliesToTraveler(d.applicantType, tr.type));

// Questions and document uploads are one list for the applicant, the admin authors
// them in a single sequence, so they render interleaved in exactly that order.
const itemsForTraveler = (fields: FormField[], docs: DocumentRequirement[], tr: Traveler): FormItem[] =>
  mergeFormItems(fieldsForTraveler(fields, tr), docsForTraveler(docs, tr));

function Counter({ value, onChange, min }: { value: number; onChange: (v: number) => void; min: number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-5 text-center text-base font-bold text-slate-900 tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── Travel Plan Modal with date RANGE ── */
function TravelPlanModal({
  country,
  initial,
  onConfirm,
  onClose,
}: {
  country: Country;
  initial: { startDate: string; endDate: string; adults: number; children: number };
  onConfirm: (data: { startDate: string; endDate: string; adults: number; children: number }) => void;
  onClose: () => void;
}) {
  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }, []);
  const [adults, setAdults] = useState(initial.adults || 1);
  const [children, setChildren] = useState(initial.children || 0);
  const [startDate, setStartDate] = useState<Date | null>(initial.startDate ? new Date(initial.startDate) : null);
  const [endDate, setEndDate] = useState<Date | null>(initial.endDate ? new Date(initial.endDate) : null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = initial.startDate ? new Date(initial.startDate) : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const first = new Date(monthStart);
    first.setDate(1 - monthStart.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      return d;
    });
  }, [viewMonth]);

  const canGoPrev = viewMonth > new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonth = () => canGoPrev && setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  const isInRange = (d: Date) => {
    const rangeEnd = endDate || hoverDate;
    if (!startDate || !rangeEnd) return false;
    const s = startDate < rangeEnd ? startDate : rangeEnd;
    const e = startDate < rangeEnd ? rangeEnd : startDate;
    return d > s && d < e;
  };

  const handleDayClick = (d: Date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(new Date(d));
      setEndDate(null);
    } else {
      if (d < startDate) {
        setEndDate(startDate);
        setStartDate(new Date(d));
      } else {
        setEndDate(new Date(d));
      }
    }
  };

  const canConfirm = startDate && endDate && adults >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden my-6">
        <div className="px-6 pt-5 pb-4 flex items-start justify-between" style={{ background: 'linear-gradient(135deg,#0B2E3D 0%,#207497 60%,#3095C0 100%)' }}>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">Plan Your Travel</h2>
            <p className="text-brand-200 text-xs mt-0.5 flex items-center gap-1"><Globe className="w-3 h-3" /> {country.name}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Traveler counts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Adults</p>
                <p className="text-[11px] text-slate-400 leading-tight">Age 18 and above</p>
              </div>
              <Counter value={adults} onChange={setAdults} min={1} />
            </div>
            <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Children</p>
                <p className="text-[11px] text-slate-400 leading-tight">Below the age of 18</p>
              </div>
              <Counter value={children} onChange={setChildren} min={0} />
            </div>
          </div>

          {/* Selected range display */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl border px-3 py-2 ${startDate ? 'border-brand-300 bg-brand-50' : 'border-dashed border-slate-200 bg-slate-50'}`}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Departure</p>
              <p className={`text-sm font-bold mt-0.5 ${startDate ? 'text-brand-800' : 'text-slate-300'}`}>
                {startDate ? fmtDisplay(fmtDate(startDate)) : 'Select date'}
              </p>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${endDate ? 'border-emerald-300 bg-emerald-50' : 'border-dashed border-slate-200 bg-slate-50'}`}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Return</p>
              <p className={`text-sm font-bold mt-0.5 ${endDate ? 'text-emerald-800' : 'text-slate-300'}`}>
                {endDate ? fmtDisplay(fmtDate(endDate)) : 'Select date'}
              </p>
            </div>
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg text-center">
            Click to select departure, click again for return date. Dates reflect on your visa.
          </p>

          {/* Calendar */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} disabled={!canGoPrev} className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="font-semibold text-slate-800">{MONTH_NAMES[viewMonth.getMonth()]} <span className="text-slate-400">{viewMonth.getFullYear()}</span></p>
              <button onClick={nextMonth} className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAYS.map((d) => <div key={d} className="text-center text-xs font-semibold text-violet-600 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((d, i) => {
                const inMonth = d.getMonth() === viewMonth.getMonth();
                const past = d < today;
                const disabled = !inMonth || past;
                const isStart = startDate && sameDay(d, startDate);
                const isEnd = endDate && sameDay(d, endDate);
                const inRange = !disabled && isInRange(d);
                return (
                  <div key={i} className={`relative flex items-center justify-center ${inRange ? 'bg-brand-100' : ''} ${isStart ? 'rounded-l-full' : ''} ${isEnd ? 'rounded-r-full' : ''}`}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleDayClick(d)}
                      onMouseEnter={() => startDate && !endDate && setHoverDate(d)}
                      onMouseLeave={() => setHoverDate(null)}
                      className={`w-9 h-9 rounded-full text-sm flex items-center justify-center transition-colors z-10 relative ${
                        isStart || isEnd ? 'bg-brand-600 text-white font-bold shadow' :
                        disabled ? 'text-slate-300 cursor-not-allowed' :
                        'text-slate-700 hover:bg-brand-50'
                      }`}>
                      {d.getDate()}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => canConfirm && onConfirm({ startDate: fmtDate(startDate!), endDate: fmtDate(endDate!), adults, children })}
            disabled={!canConfirm}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={canConfirm ? { background: 'linear-gradient(135deg,#0B2E3D,#207497)', color: 'white', boxShadow: '0 4px 15px rgba(32,116,151,0.35)' } : { background: '#f1f5f9', color: '#94a3b8' }}>
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── New Visa Overview Modal ── */
function VisaOverviewModal({
  country, visa, isCorporate, adultRate, childRate, onClose, onContinue,
}: {
  country: Country;
  visa: VisaType;
  isCorporate: boolean;
  adultRate: number;
  childRate: number;
  onClose: () => void;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const { labelFor } = useVisaConfigLabels();

  const overviewItems = mergeFormItems(visa.formFields || [], visa.documentRequirements);

  const fullText = (() => {
    const lines: string[] = [];
    lines.push(`${visa.name}, ${country.name}`);
    if (visa.description) lines.push(visa.description);
    lines.push('');
    lines.push('VISA DETAILS');
    lines.push(`- Adult Price: ${formatCurrency(adultRate)} (incl. 18% GST)`);
    if (childRate > 0) lines.push(`- Child Price: ${formatCurrency(childRate)} (incl. 18% GST)`);
    if (visa.processingTime) lines.push(`- Processing Time: ${visa.processingTime}`);
    if (visa.validity) lines.push(`- Validity: ${visa.validity}`);
    const items = mergeFormItems(visa.formFields || [], visa.documentRequirements || []);
    if (items.length) {
      lines.push('');
      lines.push('INFORMATION REQUIRED');
      items.forEach((item) => {
        const isDoc = item.kind === 'document';
        const name = isDoc ? item.doc.name : (item.field.label || item.field.fieldName);
        const required = isDoc ? item.doc.required : item.field.required;
        const applicantType = isDoc ? item.doc.applicantType : item.field.applicantType;
        const applies = applicantType === 'child' ? ' [children only]' : applicantType === 'both' ? ' [all travellers]' : '';
        lines.push(`- ${name} (${isDoc ? 'upload' : 'answer'}, ${required ? 'required' : 'optional'})${applies}`);
      });
    }
    if (visa.additionalNotes?.trim()) {
      lines.push('');
      lines.push('ADDITIONAL NOTES');
      lines.push(visa.additionalNotes.trim());
    }
    return lines.join('\n');
  })();

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };
  const handleContinue = () => { setVisible(false); setTimeout(onContinue, 300); };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Full visa details copied to clipboard.', variant: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy to clipboard.', variant: 'destructive' });
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const response = await downloadVisaSummaryPdf(visa._id);
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visa-details-${visa.name.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error', description: 'Failed to generate the PDF.', variant: 'destructive' });
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div onClick={handleClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }} />

      <div
        className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[88vh] transition-all duration-300 ease-out"
        style={{ transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.97)', opacity: visible ? 1 : 0 }}>

        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 px-5 sm:px-6 py-4 sm:py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={`https://flagcdn.com/w40/${country.flag}.png`}
                  alt={country.name}
                  className="w-12 h-8 object-cover rounded-lg shadow-lg"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium">{country.name}</p>
                <h2 className="text-white font-bold text-lg sm:text-xl leading-tight">{visa.name}</h2>
                {visa.description && <p className="text-slate-300/70 text-xs mt-0.5 line-clamp-1">{visa.description}</p>}
              </div>
            </div>
            <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 -mr-1 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Price + quick chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white text-brand-800 px-3 py-1.5 rounded-full shadow-sm">
              <CreditCard className="w-3.5 h-3.5" />
              {formatCurrency(adultRate)} / adult{isCorporate ? ' (Corp)' : ''}
            </span>
            {childRate > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 text-white px-3 py-1.5 rounded-full">
                {formatCurrency(childRate)} / child
              </span>
            )}
            {visa.processingTime && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/10 text-brand-100 px-3 py-1.5 rounded-full">
                <Clock className="w-3.5 h-3.5" />{visa.processingTime}
              </span>
            )}
            {visa.validity && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/10 text-brand-100 px-3 py-1.5 rounded-full">
                <Shield className="w-3.5 h-3.5" />Valid: {visa.validity}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-4">

          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {visa.visaSubType && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5">
                <p className="text-xs text-indigo-500 font-semibold mb-1">Visa Type</p>
                <p className="text-sm font-bold text-indigo-900">{labelFor('visaSubType', visa.visaSubType)}</p>
              </div>
            )}
            {visa.visaCategory && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                <div className="flex items-center gap-1 mb-1"><Tag className="w-3 h-3 text-slate-400" /><p className="text-xs text-slate-500 font-semibold">Category</p></div>
                <p className="text-sm font-bold text-slate-800">{labelFor('visaCategory', visa.visaCategory)}</p>
              </div>
            )}
            {visa.processingTime && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                <div className="flex items-center gap-1 mb-1"><Clock className="w-3 h-3 text-slate-400" /><p className="text-xs text-slate-500 font-semibold">Processing</p></div>
                <p className="text-sm font-bold text-slate-800">{visa.processingTime}</p>
              </div>
            )}
            {visa.stayDuration && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                <div className="flex items-center gap-1 mb-1"><Calendar className="w-3 h-3 text-slate-400" /><p className="text-xs text-slate-500 font-semibold">Stay Duration</p></div>
                <p className="text-sm font-bold text-slate-800">{visa.stayDuration}</p>
              </div>
            )}
            {visa.jurisdiction && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                <div className="flex items-center gap-1 mb-1"><MapPin className="w-3 h-3 text-slate-400" /><p className="text-xs text-slate-500 font-semibold">Jurisdiction</p></div>
                <p className="text-sm font-bold text-slate-800">{JURISDICTION_LABELS[visa.jurisdiction] || visa.jurisdiction}</p>
              </div>
            )}
          </div>

          {/* Entry */}
          {visa.entry && visa.entry.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Entry Type</p>
              <div className="flex flex-wrap gap-2">
                {visa.entry.map((e) => (
                  <span key={e} className="text-xs font-bold px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">{labelFor('entryType', e)}</span>
                ))}
              </div>
            </div>
          )}

          {/* About */}
          {visa.description && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">About</p>
              <p className="text-sm text-slate-600 leading-relaxed">{visa.description}</p>
            </div>
          )}

          {/* Information Required, fields and documents, in authored order */}
          {overviewItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-800">
                  Information Required
                  <span className="ml-1.5 text-xs font-normal text-slate-400">({overviewItems.length} total)</span>
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 active:scale-95 px-2.5 py-1.5 rounded-lg transition-all duration-150">
                    {copied ? (<><Check className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">Copied!</span></>) : (<><Copy className="w-3.5 h-3.5" />Copy All</>)}
                  </button>
                  <button onClick={handleDownloadPdf} disabled={downloadingPdf}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-all duration-150">
                    {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    PDF
                  </button>
                </div>
              </div>

              {/* Listed in the order the admin authored them, so this preview matches
                  the form the applicant is about to fill and the downloadable PDF. */}
              <div className="space-y-2">
                {overviewItems.map((item) => {
                  const isDoc = item.kind === 'document';
                  const name = isDoc ? item.doc.name : (item.field.label || item.field.fieldName);
                  const description = isDoc ? item.doc.description : item.field.placeholder;
                  const required = isDoc ? item.doc.required : item.field.required;
                  const applicantType = isDoc ? item.doc.applicantType : item.field.applicantType;
                  return (
                    <div key={`${item.kind}:${(isDoc ? item.doc._id : item.field._id) || name}`}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border ${required ? 'bg-red-50/60 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${required ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
                        {isDoc ? <FileText className="w-3.5 h-3.5" /> : <PencilLine className="w-3.5 h-3.5" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-snug ${required ? 'text-slate-800' : 'text-slate-700'}`}>{name}</p>
                        {description && <p className={`text-xs mt-0.5 ${required ? 'text-slate-500' : 'text-slate-400'}`}>{description}</p>}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{isDoc ? 'Upload' : 'Answer'}</span>
                          {applicantType === 'child' && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Children only</span>}
                          {applicantType === 'both' && <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">All travellers</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${required ? 'font-bold text-red-500 bg-red-100' : 'font-medium text-slate-400 bg-slate-200'}`}>
                        {required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Additional Notes, kept at the bottom of the modal */}
          {visa.additionalNotes?.trim() && (
            <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3.5">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1.5">Additional Notes</p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{visa.additionalNotes}</p>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-white flex-shrink-0">
          <button onClick={handleContinue}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-md">
            Continue with {visa.name}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={handleClose} className="w-full mt-2 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">Choose a different visa</button>
        </div>
      </div>
    </div>
  );
}

/* ── New Modern Visa Card ── */
function VisaCard({ visa, selected, adultPrice, childPrice, onClick }: {
  visa: VisaType;
  selected: boolean;
  adultPrice: number;
  childPrice: number;
  onClick: () => void;
}) {
  const { labelFor } = useVisaConfigLabels();

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl overflow-hidden border-2 text-left transition-all duration-200 group ${
        selected ? 'border-brand-500 ring-2 ring-brand-100 shadow-lg' : 'border-slate-200 hover:border-brand-300 hover:shadow-lg'
      }`}
    >
      {/* Card header */}
      <div className="relative overflow-hidden px-5 py-5 bg-gradient-to-br from-slate-800 via-brand-900 to-indigo-900">
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
              visa.visaSubType === 'e-visa' ? 'bg-brand-400/30 text-brand-100' : 'bg-amber-400/30 text-amber-100'
            }`}>
              {labelFor('visaSubType', visa.visaSubType)}
            </span>
            {visa.entry?.[0] && (
              <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full">{labelFor('entryType', visa.entry[0])}</span>
            )}
          </div>
          <h3 className="text-white font-bold text-base leading-tight">{visa.name}</h3>
          {visa.visaCategory && (
            <p className="text-white/60 text-xs mt-1">{labelFor('visaCategory', visa.visaCategory)}</p>
          )}
        </div>
      </div>

      {/* Details rows */}
      <div className="bg-white divide-y divide-slate-100">
        {visa.processingTime && (
          <div className="flex items-center justify-between px-5 py-2.5">
            <span className="flex items-center gap-2 text-sm text-slate-500"><Clock className="w-3.5 h-3.5 text-slate-400" />Processing</span>
            <span className="text-sm font-bold text-slate-800">{visa.processingTime}</span>
          </div>
        )}
        {visa.stayDuration && (
          <div className="flex items-center justify-between px-5 py-2.5">
            <span className="flex items-center gap-2 text-sm text-slate-500"><Calendar className="w-3.5 h-3.5 text-slate-400" />Stay</span>
            <span className="text-sm font-bold text-slate-800">{visa.stayDuration}</span>
          </div>
        )}
        {visa.validity && (
          <div className="flex items-center justify-between px-5 py-2.5">
            <span className="flex items-center gap-2 text-sm text-slate-500"><Shield className="w-3.5 h-3.5 text-slate-400" />Valid</span>
            <span className="text-sm font-bold text-slate-800">{visa.validity}</span>
          </div>
        )}

        {/* Price footer */}
        <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-brand-50/50 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">From</p>
            <p className="text-lg font-bold text-brand-700">{formatCurrency(adultPrice)}</p>
            <p className="text-[10px] text-slate-400">per adult</p>
          </div>
          {childPrice > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400">Child</p>
              <p className="text-sm font-bold text-slate-600">{formatCurrency(childPrice)}</p>
            </div>
          )}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            selected ? 'bg-brand-600' : 'bg-slate-100 group-hover:bg-brand-100'
          }`}>
            <ArrowRight className={`w-4 h-4 ${selected ? 'text-white' : 'text-slate-400 group-hover:text-brand-600'}`} />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ApplyPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isCorporate = user?.accountType === 'corporate';

  // Per-traveler pricing components: visa fee (base) + VFS fee + service fee. 18% GST is
  // charged on the service fee only. Mirrors backend utils/pricing.ts exactly.
  // Visa and VFS fees are pass-through charges, identical for every account type.
  // Only the service fee has a corporate override.
  const rateParts = (v: VisaType) => {
    const corpAdultFee = isCorporate && v.corporateAdultServiceFee != null;
    const corpChildFee = isCorporate && v.corporateChildServiceFee != null;
    return {
      adultBase: v.adultPrice || v.price,
      adultVfs: v.adultVfsFee || 0,
      adultFee: (corpAdultFee ? v.corporateAdultServiceFee : v.adultServiceFee) || 0,
      childBase: v.childPrice || 0,
      childVfs: v.childVfsFee || 0,
      childFee: (corpChildFee ? v.corporateChildServiceFee : v.childServiceFee) || 0,
      corp: corpAdultFee || corpChildFee,
    };
  };
  // Pre-GST per-traveler rates (used in the checkout line items alongside an explicit GST line).
  const adultNetRate = (v: VisaType) => { const r = rateParts(v); return r.adultBase + r.adultVfs + r.adultFee; };
  const childNetRate = (v: VisaType) => { const r = rateParts(v); return r.childBase + r.childVfs + r.childFee; };
  // GST-inclusive per-traveler display rates (cards, overview modal, summary PDF).
  // GST is added on the service fee only, not on the visa/VFS portion.
  const adultRate = (v: VisaType) => { const r = rateParts(v); return adultNetRate(v) + Math.round(r.adultFee * GST_RATE); };
  const childRate = (v: VisaType) => { const r = rateParts(v); return childNetRate(v) + Math.round(r.childFee * GST_RATE); };

  const [step, setStep] = useState<Step>(1);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedVisa, setSelectedVisa] = useState<VisaType | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [docSources, setDocSources] = useState<Record<string, DocSource>>({});
  const [vaultDocs, setVaultDocs] = useState<VaultDocument[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [travelStartDate, setTravelStartDate] = useState('');
  const [travelEndDate, setTravelEndDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [activeTraveler, setActiveTraveler] = useState(0);

  const [showTravelModal, setShowTravelModal] = useState(false);
  const [pendingCountry, setPendingCountry] = useState<Country | null>(null);
  const [showVisaOverview, setShowVisaOverview] = useState(false);

  const [passportValues, setPassportValues] = useState<Record<string, Record<string, string>>>({});

  const [promoInput, setPromoInput] = useState('');
  const [promoResult, setPromoResult] = useState<{ code: string; discount: number; finalAmount: number; discountType: string; discountValue: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  // Consent checkboxes configured per visa type, shown at the bottom of Review & Pay.
  // Keyed by index into selectedVisa.terms; reset whenever a different visa is picked.
  const [termsAccepted, setTermsAccepted] = useState<Record<number, boolean>>({});
  const visaTerms = useMemo(() => selectedVisa?.terms || [], [selectedVisa]);
  useEffect(() => {
    setTermsAccepted(Object.fromEntries(visaTerms.map((t, i) => [i, !!t.defaultChecked])));
  }, [selectedVisa?._id, visaTerms]);
  const allRequiredTermsAccepted = visaTerms.every((t, i) => !t.required || termsAccepted[i]);

  const travelers = useMemo(() => buildTravelers(adults, children), [adults, children]);
  // Must match backend computePaymentAmount exactly: GST is 18% of the order's total
  // service fee (visa + VFS untaxed), rounded once at the order level.
  const orderSubtotal = (v: VisaType) => adults * adultNetRate(v) + children * childNetRate(v);
  const orderServiceFee = (v: VisaType) => { const r = rateParts(v); return adults * r.adultFee + children * r.childFee; };
  const orderGst = (v: VisaType) => Math.round(orderServiceFee(v) * GST_RATE);
  const orderTotal = (v: VisaType) => orderSubtotal(v) + orderGst(v);

  useEffect(() => {
    getActiveCountries()
      .then((r) => setCountries(r.data.data))
      .finally(() => setCountriesLoading(false));
    getVaultDocuments().then((r) => setVaultDocs(r.data.data || [])).catch(() => {});

    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.selectedCountry) setSelectedCountry(d.selectedCountry);
        if (d.formData) setFormData(d.formData);
        if (d.passportValues) setPassportValues(d.passportValues);
        if (d.step) setStep(d.step as Step);
        if (d.travelStartDate) setTravelStartDate(d.travelStartDate);
        if (d.travelEndDate) setTravelEndDate(d.travelEndDate);
        if (d.adults) setAdults(d.adults);
        if (typeof d.children === 'number') setChildren(d.children);

        // Visa type data (pricing, labels, sub-type, active status) is admin-controlled
        // and can change after a draft was saved, never restore it from the cached
        // snapshot, always re-fetch fresh and re-match the previously selected visa by id.
        if (d.selectedCountry?._id) {
          getPublicVisaTypes(d.selectedCountry._id).then((r) => {
            const fresh: VisaType[] = r.data.data;
            setVisaTypes(fresh);
            if (d.selectedVisa?._id) {
              setSelectedVisa(fresh.find((v) => v._id === d.selectedVisa._id) ?? null);
            }
          }).catch(() => {});
        }
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
    setDraftRestored(true);
  }, []);

  useEffect(() => {
    if (!draftRestored || !selectedCountry) return;
    // visaTypes is intentionally excluded, it's always re-fetched fresh on restore (see above),
    // never trusted from this cache, since pricing/labels are admin-controlled and can change.
    const draft = { step, selectedCountry, selectedVisa, formData, passportValues, travelStartDate, travelEndDate, adults, children };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draftRestored, step, selectedCountry, selectedVisa, formData, passportValues, travelStartDate, travelEndDate, adults, children]);

  useEffect(() => {
    if (activeTraveler > travelers.length - 1) setActiveTraveler(0);
  }, [travelers.length, activeTraveler]);

  const startOver = () => {
    localStorage.removeItem(DRAFT_KEY);
    setStep(1);
    setSelectedCountry(null);
    setSelectedVisa(null);
    setFormData({});
    setDocSources({});
    setPassportValues({});
    setVisaTypes([]);
    setCountrySearch('');
    setTravelStartDate('');
    setTravelEndDate('');
    setAdults(1);
    setChildren(0);
    setActiveTraveler(0);
  };

  const handleCountrySelect = (country: Country) => {
    setPendingCountry(country);
    setShowTravelModal(true);
  };

  const confirmTravelPlan = async (data: { startDate: string; endDate: string; adults: number; children: number }) => {
    setTravelStartDate(data.startDate);
    setTravelEndDate(data.endDate);
    setAdults(data.adults);
    setChildren(data.children);
    setActiveTraveler(0);
    setShowTravelModal(false);
    if (!pendingCountry) return;
    const country = pendingCountry;
    setPendingCountry(null);
    setSelectedCountry(country);
    setSelectedVisa(null);
    setDocSources({});
    setPassportValues({});
    setLoading(true);
    try {
      const r = await getPublicVisaTypes(country._id);
      setVisaTypes(r.data.data);
    } finally {
      setLoading(false);
    }
    setStep(2);
  };

  const docKey = (tr: Traveler, reqName: string, suffix = '') => `${tr.key}::${reqName}${suffix}`;

  const pickFileFor = (storeKey: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED;
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) setDocSources((prev) => ({ ...prev, [storeKey]: { type: 'file', file } }));
    };
    input.click();
  };

  const clearDocSource = (storeKey: string) => {
    setDocSources((prev) => { const next = { ...prev }; delete next[storeKey]; return next; });
  };

  const selectVaultDoc = (storeKey: string, vaultDoc: VaultDocument) => {
    setDocSources((prev) => ({ ...prev, [storeKey]: { type: 'vault', vaultDocId: vaultDoc._id, label: vaultDoc.label, url: vaultDoc.url } }));
  };

  const handleSubmit = async () => {
    if (!selectedVisa) return;
    if (!allRequiredTermsAccepted) {
      toast({ title: 'Please accept the required terms', description: 'Tick every mandatory term before submitting.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      setSubmitStatus('Creating application…');
      const responses: Record<string, string> = {};
      const sortedFields = [...selectedVisa.formFields].sort((a, b) => a.order - b.order);
      for (const tr of travelers) {
        for (const f of questionsForTraveler(sortedFields, tr, formData)) {
          const val = formData[`${tr.key}__${f.fieldName}`];
          const key = `${tr.label} - ${f.label || f.fieldName}`.replace(/\./g, ' ');
          if (val && String(val).trim()) responses[key] = String(val);
        }
      }
      // OCR-reviewed passport details become part of the application responses. Dots
      // stripped because Mongo Map keys cannot contain them.
      for (const tr of travelers) {
        const pv = passportValues[tr.key];
        if (!pv) continue;
        for (const [k, v] of Object.entries(pv)) {
          if (v && v.trim()) responses[`${tr.label} - ${k}`.replace(/\./g, ' ').replace(/\s+/g, ' ').trim()] = v.trim();
        }
      }
      if (travelStartDate) responses['Travel Start Date'] = travelStartDate;
      if (travelEndDate) responses['Travel End Date'] = travelEndDate;

      const r = await createApplication({
        visaTypeId: selectedVisa._id,
        formResponses: responses,
        adults,
        children,
        travelDate: travelStartDate,
        acceptedTerms: visaTerms.filter((_, i) => termsAccepted[i]).map((t) => t.text),
      });
      const appId = r.data.data._id;

      const reqs = withDefaultPassport(selectedVisa.documentRequirements);
      let uploadIdx = 0;

      const doUpload = async (file: File, requirementName: string, docType = '', extractedData?: Record<string, string>) => {
        uploadIdx++;
        setSubmitStatus(`Uploading documents (${uploadIdx})…`);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('requirementName', requirementName);
        if (docType) fd.append('docType', docType);
        if (extractedData && Object.keys(extractedData).length > 0) fd.append('extractedData', JSON.stringify(extractedData));
        await uploadDocument(appId, fd);
      };

      const pickFields = (pv: Record<string, string>, keys: string[]) =>
        Object.fromEntries(keys.filter((k) => pv[k]?.trim()).map((k) => [k, pv[k].trim()]));

      for (const tr of travelers) {
        for (const req of docsForTraveler(reqs, tr)) {
          const label = `${tr.label} - ${req.name}`;
          if (isPassportPair(req) && req.ocrEnabled !== false) {
            const frontSrc = docSources[docKey(tr, req.name, '__front')];
            const backSrc = docSources[docKey(tr, req.name, '__back')];
            const pv = passportValues[tr.key] || {};
            if (frontSrc?.type === 'file') await doUpload(frontSrc.file, `${label} (Front)`, 'passport_front', pickFields(pv, PASSPORT_FRONT_FIELDS));
            if (backSrc?.type === 'file') await doUpload(backSrc.file, `${label} (Back)`, 'passport_back', pickFields(pv, PASSPORT_BACK_FIELDS));
          } else {
            const source = docSources[docKey(tr, req.name)];
            if (!source) continue;
            if (source.type === 'vault') {
              uploadIdx++;
              setSubmitStatus(`Uploading documents (${uploadIdx})…`);
              await addDocumentFromVault(appId, { vaultDocId: source.vaultDocId, requirementName: label });
            } else {
              const pv = passportValues[tr.key] || {};
              const ocrData = req.ocrEnabled !== false
                ? (req.docType === 'passport_front' ? pickFields(pv, PASSPORT_FRONT_FIELDS)
                  : req.docType === 'passport_back' ? pickFields(pv, PASSPORT_BACK_FIELDS)
                  : undefined)
                : undefined;
              await doUpload(source.file, label, req.docType || '', ocrData);
            }
          }
        }
      }

      localStorage.removeItem(DRAFT_KEY);
      toast({ title: 'Application saved', description: 'Complete your UPI payment to start processing.', variant: 'success' });
      // The application page owns the payment flow; ?pay=1 opens it straight away.
      const promo = promoResult?.code ? `&promo=${encodeURIComponent(promoResult.code)}` : '';
      router.push(`/applications/${appId}?pay=1${promo}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to submit', variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setSubmitStatus('');
    }
  };

  const goNext = () => setStep((s) => Math.min(s + 1, 4) as Step);
  const goBack = () => setStep((s) => Math.max(s - 1, 1) as Step);

  const handleApplyPromo = async () => {
    if (!promoInput.trim() || !selectedVisa) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoResult(null);
    try {
      const total = orderTotal(selectedVisa);
      const r = await validatePromoCode({ code: promoInput.trim().toUpperCase(), orderAmount: total });
      setPromoResult(r.data.data);
    } catch (err: any) {
      setPromoError(err.response?.data?.message || 'Invalid promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setPromoResult(null);
    setPromoInput('');
    setPromoError('');
  };

  const sortedFields = selectedVisa ? [...selectedVisa.formFields].sort((a, b) => a.order - b.order) : [];
  const requirements: DocumentRequirement[] = withDefaultPassport(selectedVisa?.documentRequirements || []);

  const travelerComplete = (tr: Traveler) => {
    const fieldsOk = questionsForTraveler(sortedFields, tr, formData).filter((f) => f.required).every((f) => !!formData[`${tr.key}__${f.fieldName}`]?.trim());
    const docsOk = docsForTraveler(requirements, tr).filter((r) => r.required).every((r) => {
      if (isPassportPair(r) && r.ocrEnabled !== false) return !!docSources[docKey(tr, r.name, '__front')] && !!docSources[docKey(tr, r.name, '__back')];
      return !!docSources[docKey(tr, r.name)];
    });
    return fieldsOk && docsOk;
  };

  const canProceed = () => {
    if (step === 1) return !!selectedCountry;
    if (step === 2) return !!selectedVisa && !loading;
    if (step === 3) return travelers.every(travelerComplete);
    return true;
  };

  const renderField = (field: FormField | SubField, prefix: string) => {
    const key = `${prefix}__${field.fieldName}`;
    const common = {
      id: key,
      value: formData[key] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, [key]: e.target.value }),
    };

    if (field.type === 'select') {
      return (
        <Select value={formData[key] || ''} onValueChange={(v) => setFormData({ ...formData, [key]: v })}>
          <SelectTrigger><SelectValue placeholder={field.placeholder || 'Select an option'} /></SelectTrigger>
          <SelectContent>
            {field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (field.type === 'textarea') {
      return <textarea {...common} rows={3} placeholder={field.placeholder} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />;
    }
    if (field.type === 'radio' && field.options.length > 0) {
      return (
        <div className="flex flex-wrap gap-4 mt-1">
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={key} value={o} checked={formData[key] === o} onChange={() => setFormData({ ...formData, [key]: o })} className="text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-slate-700">{o}</span>
            </label>
          ))}
        </div>
      );
    }
    return <Input {...common} type={field.type} placeholder={field.placeholder} />;
  };

  const renderDocCard = (tr: Traveler, req: DocumentRequirement) => {
    if (isPassportPair(req) && req.ocrEnabled !== false) {
      const frontSrc = docSources[docKey(tr, req.name, '__front')];
      const backSrc = docSources[docKey(tr, req.name, '__back')];
      return (
        <PassportScanCard
          key={`${tr.key}::${req._id || req.name}`}
          requirementName={req.name}
          frontFile={frontSrc?.type === 'file' ? frontSrc.file : null}
          backFile={backSrc?.type === 'file' ? backSrc.file : null}
          values={passportValues[tr.key] || {}}
          onValuesChange={(vals) => setPassportValues((p) => ({ ...p, [tr.key]: vals }))}
          onFrontChange={(file) => {
            if (file) setDocSources((p) => ({ ...p, [docKey(tr, req.name, '__front')]: { type: 'file', file } }));
            else clearDocSource(docKey(tr, req.name, '__front'));
          }}
          onBackChange={(file) => {
            if (file) setDocSources((p) => ({ ...p, [docKey(tr, req.name, '__back')]: { type: 'file', file } }));
            else clearDocSource(docKey(tr, req.name, '__back'));
          }}
        />
      );
    }

    if ((req.docType === 'passport_front' || req.docType === 'passport_back') && req.ocrEnabled !== false) {
      const side = req.docType === 'passport_back' ? 'back' : 'front';
      const sk = docKey(tr, req.name);
      const src = docSources[sk];
      const file = src?.type === 'file' ? src.file : null;
      const onFile = (f: File | null) => {
        if (f) setDocSources((p) => ({ ...p, [sk]: { type: 'file', file: f } }));
        else clearDocSource(sk);
      };
      return (
        <PassportScanCard
          key={`${tr.key}::${req._id || req.name}`}
          mode={side}
          requirementName={req.name}
          frontFile={side === 'front' ? file : null}
          backFile={side === 'back' ? file : null}
          values={passportValues[tr.key] || {}}
          onValuesChange={(vals) => setPassportValues((p) => ({ ...p, [tr.key]: vals }))}
          onFrontChange={side === 'front' ? onFile : () => {}}
          onBackChange={side === 'back' ? onFile : () => {}}
        />
      );
    }

    const sk = docKey(tr, req.name);
    const source = docSources[sk];
    const vaultType = getVaultType(req.name);
    const vaultMatches = vaultType ? vaultDocs.filter((v) => v.type === vaultType) : [];
    const applicantType = req.applicantType || 'adult';

    return (
      <div key={req._id || req.name} className={`rounded-xl border-2 p-4 transition-all ${source ? 'border-green-200 bg-green-50' : req.required ? 'border-slate-200 bg-white hover:border-brand-200' : 'border-dashed border-slate-200 bg-slate-50/50'}`}>
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${source ? 'bg-green-100' : 'bg-slate-100'}`}>
            {source ? <Check className="w-4 h-4 text-green-600" /> : <FileText className="w-4 h-4 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 flex items-center flex-wrap gap-1">
              {req.name}
              {req.required && <span className="text-red-500">*</span>}
              {!req.required && <span className="text-slate-400 text-xs font-normal">(optional)</span>}
              {applicantType === 'child' && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Children only</span>}
              {applicantType === 'both' && <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">All travellers</span>}
            </p>
            {req.description && <p className="text-xs text-slate-400 mt-0.5">{req.description}</p>}
          </div>
        </div>

        {source && (
          <div className="flex items-center gap-2 mb-3 ml-11">
            {source.type === 'vault' ? (
              <span className="text-xs text-green-700 font-medium flex items-center gap-1"><Vault className="w-3 h-3" /> From vault: {source.label}</span>
            ) : (
              <span className="text-xs text-green-700 font-medium truncate max-w-[200px]">{source.file.name}<span className="text-slate-400 ml-1">· {formatBytes(source.file.size)}</span></span>
            )}
            <button onClick={() => clearDocSource(sk)} className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {vaultMatches.length > 0 && (
          <div className="flex flex-wrap gap-2 ml-11 mb-2">
            {vaultMatches.map((vd) => {
              const isSelected = source?.type === 'vault' && source.vaultDocId === vd._id;
              return (
                <button key={vd._id} onClick={() => isSelected ? clearDocSource(sk) : selectVaultDoc(sk, vd)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${isSelected ? 'bg-green-100 border-green-300 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50'}`}>
                  <Vault className="w-3 h-3" />
                  {isSelected ? `Selected: ${vd.label} ✓` : `Use from vault: ${vd.label}`}
                </button>
              );
            })}
          </div>
        )}

        <div className="ml-11">
          <button onClick={() => pickFileFor(sk)} className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg border border-brand-100 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            {source?.type === 'file' ? 'Replace file' : 'Upload file'}
          </button>
        </div>
      </div>
    );
  };

  const activeTr = travelers[Math.min(activeTraveler, travelers.length - 1)] || travelers[0];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {showTravelModal && pendingCountry && (
        <TravelPlanModal
          country={pendingCountry}
          initial={{ startDate: travelStartDate, endDate: travelEndDate, adults, children }}
          onConfirm={confirmTravelPlan}
          onClose={() => { setShowTravelModal(false); setPendingCountry(null); }}
        />
      )}

      {showVisaOverview && selectedVisa && selectedCountry && (
        <VisaOverviewModal
          country={selectedCountry}
          visa={selectedVisa}
          isCorporate={isCorporate}
          adultRate={adultRate(selectedVisa)}
          childRate={childRate(selectedVisa)}
          onClose={() => setShowVisaOverview(false)}
          onContinue={() => { setShowVisaOverview(false); goNext(); }}
        />
      )}

      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900">Apply for Visa</h1>
        {(step > 1 || !!selectedCountry) && (
          <button onClick={startOver} className="text-xs text-slate-400 hover:text-red-500 transition-colors mt-1.5 flex-shrink-0">Start over</button>
        )}
      </div>
      <p className="text-slate-500 text-sm mb-8">
        {step > 1 || selectedCountry ? 'Your progress has been saved. Continue where you left off.' : 'Complete the steps below to submit your application.'}
      </p>

      {/* Step Indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = step > n;
          const active = step === n;
          return (
            <div key={label} className="flex items-center flex-1 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? 'bg-green-500 text-white' : active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : n}
              </div>
              <span className={`text-xs font-medium hidden sm:block ml-1.5 mr-1 ${active ? 'text-brand-700' : done ? 'text-green-700' : 'text-slate-400'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${step > n ? 'bg-green-300' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">

        {/* ── Step 1: Country ── */}
        {step === 1 && (
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Select Destination Country</h2>
              <p className="text-sm text-slate-400 mt-0.5">All active countries available for visa processing.</p>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search countries..." value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} />
            </div>

            {countriesLoading ? (
              <CardGridSkeleton count={6} className="gap-3" cardClassName="h-40" />
            ) : (() => {
              const filtered = countries.filter((c) => c.name.toLowerCase().includes(countrySearch.toLowerCase()));
              if (filtered.length === 0) return (
                <div className="text-center py-12 text-slate-400">
                  <Globe className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                  <p className="text-sm">No countries match "{countrySearch}".</p>
                </div>
              );
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((c) => {
                    const isSelected = selectedCountry?._id === c._id;
                    const coverImg = c.images?.[0];
                    return (
                      <button
                        key={c._id}
                        onClick={() => handleCountrySelect(c)}
                        className={`group rounded-2xl border-2 text-left transition-all duration-200 overflow-hidden ${
                          isSelected
                            ? 'border-brand-500 ring-2 ring-brand-100 shadow-md'
                            : 'border-slate-200 hover:border-brand-300 hover:shadow-md'
                        }`}
                      >
                        {/* Cover photo or flag */}
                        <div className="relative aspect-video bg-gradient-to-br from-brand-50 to-slate-100 overflow-hidden">
                          {coverImg ? (
                            <img
                              src={coverImg}
                              alt={c.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <img
                                src={`https://flagcdn.com/w160/${c.flag}.png`}
                                alt={c.name}
                                className="w-20 h-auto object-contain opacity-50 group-hover:scale-105 transition-transform duration-500"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            </div>
                          )}

                          {/* Flag badge when photo exists */}
                          {coverImg && (
                            <div className="absolute bottom-2 left-2 rounded-md overflow-hidden w-8 h-5 shadow border border-white/60">
                              <img src={`https://flagcdn.com/w40/${c.flag}.png`} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}

                          {/* Selected checkmark */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center shadow">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-3 bg-white">
                          <p className={`text-sm font-bold leading-tight ${isSelected ? 'text-brand-700' : 'text-slate-800'}`}>
                            {c.name}
                          </p>
                          {c.description && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 leading-snug">{c.description}</p>
                          )}
                          <p className="text-[10px] font-semibold text-brand-500 mt-1.5 flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" /> Visa available
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {!countriesLoading && countries.length === 0 && !countrySearch && (
              <div className="text-center py-12 text-slate-400">
                <Globe className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                <p className="text-sm">No countries available for visa processing right now.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Visa Type ── */}
        {step === 2 && (
          <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Select Visa Type</h2>
                {selectedCountry && (
                  <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <img src={`https://flagcdn.com/w20/${selectedCountry.flag}.png`} alt="" className="w-5 h-3 object-cover rounded" />
                    <span className="font-medium text-slate-700">{selectedCountry.name}</span>
                    {!loading && visaTypes.length > 0 && (
                      <span className="text-slate-400">· {visaTypes.length} active visa type{visaTypes.length !== 1 ? 's' : ''}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {travelStartDate && (
                  <span className="flex items-center gap-1 text-xs text-brand-600 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-full font-medium">
                    <Calendar className="w-3 h-3" />
                    {new Date(travelStartDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {travelEndDate && <> → {new Date(travelEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full font-medium">
                  <Users className="w-3 h-3" /> {adults} Adult{adults > 1 ? 's' : ''}{children > 0 ? `, ${children} Child${children > 1 ? 'ren' : ''}` : ''}
                </span>
                <button onClick={() => { setPendingCountry(selectedCountry); setShowTravelModal(true); }} className="text-xs text-brand-600 hover:text-brand-800 font-medium underline underline-offset-2">Edit</button>
              </div>
            </div>

            {loading ? (
              <CardGridSkeleton count={4} className="sm:grid-cols-2 lg:grid-cols-2" cardClassName="h-52" />
            ) : visaTypes.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                <Globe className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">No active visa types for {selectedCountry?.name}</p>
                <p className="text-xs mt-1">Contact us for assistance.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {visaTypes.map((v) => (
                  <VisaCard
                    key={v._id}
                    visa={v}
                    selected={selectedVisa?._id === v._id}
                    adultPrice={adultRate(v)}
                    childPrice={childRate(v)}
                    onClick={() => { setSelectedVisa(v); setDocSources({}); setShowVisaOverview(true); }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Applicant Details ── */}
        {step === 3 && selectedVisa && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Applicant Details</h2>
              <span className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                <Users className="w-3 h-3" /> {travelers.length} traveller{travelers.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-5 border-b border-slate-100 pb-3">
              {travelers.map((tr, idx) => {
                const isActive = idx === Math.min(activeTraveler, travelers.length - 1);
                const complete = travelerComplete(tr);
                return (
                  <button key={tr.key} onClick={() => setActiveTraveler(idx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                      isActive ? (tr.type === 'adult' ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-emerald-500 bg-emerald-50 text-emerald-800')
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    {complete ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Users className="w-3.5 h-3.5" />}
                    {tr.label}
                  </button>
                );
              })}
            </div>

            {activeTr && (() => {
              const items = itemsForTraveler(sortedFields, requirements, activeTr);
              const hasDocs = items.some((it) => it.kind === 'document');
              return (
              <div className="space-y-6">
                {items.length > 0 && (
                  <div className="space-y-4">
                    {items.map((item) =>
                      item.kind === 'field' ? (
                        <div key={`f:${item.field._id || item.field.fieldName}`}>
                          <Label htmlFor={`${activeTr.key}__${item.field.fieldName}`}>
                            {item.field.label}
                            {item.field.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          <div className="mt-1">{renderField(item.field, activeTr.key)}</div>
                          {shownSubFields(item.field, formData[`${activeTr.key}__${item.field.fieldName}`]).map((sub) => (
                            <div key={sub.fieldName} className="mt-3 ml-1 pl-4 border-l-2 border-brand-200 animate-fade-in">
                              <Label htmlFor={`${activeTr.key}__${sub.fieldName}`}>
                                {sub.label}
                                {sub.required && <span className="text-red-500 ml-1">*</span>}
                              </Label>
                              <div className="mt-1">{renderField(sub, activeTr.key)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div key={`d:${item.doc._id || item.doc.name}`}>{renderDocCard(activeTr, item.doc)}</div>
                      ),
                    )}
                  </div>
                )}

                {hasDocs && (
                  <p className="text-xs text-slate-400">Accepted formats: PDF, JPG, PNG, DOC, DOCX · Max 10 MB per file</p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button disabled={activeTraveler === 0} onClick={() => setActiveTraveler((i) => Math.max(0, i - 1))}
                    className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4" /> Previous traveller
                  </button>
                  {activeTraveler < travelers.length - 1 ? (
                    <button onClick={() => setActiveTraveler((i) => Math.min(travelers.length - 1, i + 1))}
                      className="text-sm font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1">
                      Next traveller <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : <span className="text-xs text-slate-400">All travellers</span>}
                </div>
              </div>
              );
            })()}
          </div>
        )}

        {/* ── Step 4: Review & Pay ── */}
        {step === 4 && selectedVisa && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Review &amp; Pay</h2>
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 font-semibold mb-3 uppercase tracking-wide">Visa Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Country</p>
                    <p className="font-medium flex items-center gap-1.5 mt-0.5">
                      {selectedCountry && <img src={`https://flagcdn.com/w20/${selectedCountry.flag}.png`} alt="" className="w-5 h-3 object-cover rounded" />}
                      {selectedCountry?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Visa Type</p>
                    <p className="font-medium mt-0.5">{selectedVisa.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Travellers</p>
                    <p className="font-medium mt-0.5">{adults} Adult{adults > 1 ? 's' : ''}{children > 0 ? `, ${children} Child${children > 1 ? 'ren' : ''}` : ''}</p>
                  </div>
                  {travelStartDate && (
                    <div>
                      <p className="text-xs text-slate-400">Departure Date</p>
                      <p className="font-medium mt-0.5">{new Date(travelStartDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  )}
                  {travelEndDate && (
                    <div>
                      <p className="text-xs text-slate-400">Return Date</p>
                      <p className="font-medium mt-0.5">{new Date(travelEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-400">Processing Time</p>
                    <p className="font-medium mt-0.5">{selectedVisa.processingTime}</p>
                  </div>
                  {selectedVisa.validity && (
                    <div>
                      <p className="text-xs text-slate-400">Validity</p>
                      <p className="font-medium mt-0.5">{selectedVisa.validity}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Per-traveller details + documents */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 font-semibold mb-3 uppercase tracking-wide">Traveller Details</p>
                <div className="space-y-4">
                  {travelers.map((tr) => {
                    const entries = questionsForTraveler(sortedFields, tr, formData)
                      .map((f) => [f.label || f.fieldName, formData[`${tr.key}__${f.fieldName}`]] as const)
                      .filter(([, v]) => v && String(v).trim());
                    return (
                      <div key={tr.key} className="border-t border-slate-100 first:border-t-0 pt-3 first:pt-0">
                        <p className={`text-xs font-bold mb-1.5 ${tr.type === 'adult' ? 'text-brand-700' : 'text-emerald-700'}`}>{tr.label}</p>
                        {entries.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No details provided</p>
                        ) : (
                          <div className="space-y-1 text-sm">
                            {entries.map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-4">
                                <span className="text-slate-500 shrink-0">{k}</span>
                                <span className="font-medium text-slate-900 text-right truncate">{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {docsForTraveler(requirements, tr).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {docsForTraveler(requirements, tr).map((req) => {
                              if (isPassportPair(req) && req.ocrEnabled !== false) {
                                const f = docSources[docKey(tr, req.name, '__front')];
                                const b = docSources[docKey(tr, req.name, '__back')];
                                const ok = f && b;
                                return (
                                  <div key={req._id || req.name} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-600 flex items-center gap-1"><BookOpen className="w-3 h-3 text-slate-400" /> {req.name} (Front & Back)</span>
                                    {ok ? <span className="text-green-700 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Provided</span> : <span className="text-slate-400 italic">Not provided</span>}
                                  </div>
                                );
                              }
                              const src = docSources[docKey(tr, req.name)];
                              return (
                                <div key={req._id || req.name} className="flex items-center justify-between text-xs">
                                  <span className="text-slate-600">{req.name}{req.required && <span className="text-red-400 ml-1">*</span>}</span>
                                  {src ? <span className="text-green-700 font-medium flex items-center gap-1">{src.type === 'vault' ? <Vault className="w-3 h-3" /> : <Check className="w-3 h-3" />} {src.type === 'vault' ? src.label : src.file.name}</span> : <span className="text-slate-400 italic">Not provided</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Promo Code, only for promoApplicable users */}
              {user?.promoApplicable !== false && (
                <div className="border border-violet-200 bg-violet-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Promo Code
                  </p>
                  {promoResult ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-green-700 flex items-center gap-1.5">
                          <Check className="w-4 h-4" />
                          <span className="font-mono tracking-widest">{promoResult.code}</span> applied!
                        </p>
                        <p className="text-xs text-green-600 mt-0.5">
                          You save {promoResult.discountType === 'percentage' ? `${promoResult.discountValue}%` : formatCurrency(promoResult.discountValue)} ({formatCurrency(promoResult.discount)} off)
                        </p>
                      </div>
                      <button onClick={removePromo} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                        <X className="w-3 h-3" />Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <input
                          value={promoInput}
                          onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                          onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                          placeholder="Enter promo code"
                          className="flex-1 h-9 px-3 text-sm font-mono font-semibold tracking-widest uppercase rounded-lg border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        <button
                          onClick={handleApplyPromo}
                          disabled={promoLoading || !promoInput.trim()}
                          className="px-4 h-9 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          {promoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          Apply
                        </button>
                      </div>
                      {promoError && <p className="text-xs text-red-500 mt-1">{promoError}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Pricing breakdown */}
              {(() => {
                const r = rateParts(selectedVisa);
                const subtotal = orderSubtotal(selectedVisa);
                const gst = orderGst(selectedVisa);
                const base = subtotal + gst;
                const discount = promoResult?.discount || 0;
                const finalTotal = promoResult ? promoResult.finalAmount : base;
                const feeRows = (label: string, parts: { base: number; vfs: number; fee: number }, count: number) => [
                  { name: `Visa Fee (${label})`, amount: parts.base, count },
                  { name: `VFS Fee / pax (${label})`, amount: parts.vfs, count },
                  ...(parts.fee > 0 ? [{ name: `Service Fee / pax (${label})`, amount: parts.fee, count }] : []),
                ];
                const breakdownRows = [
                  ...feeRows('Adult', { base: r.adultBase, vfs: r.adultVfs, fee: r.adultFee }, adults),
                  ...(children > 0 ? feeRows('Child', { base: r.childBase, vfs: r.childVfs, fee: r.childFee }, children) : []),
                ];
                return (
                  <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <p className="text-xs text-brand-600 font-semibold uppercase tracking-wide">Payment Summary</p>
                      {/* Hover (i), full fee breakdown */}
                      <span className="relative group inline-flex">
                        <Info className="w-3.5 h-3.5 text-brand-500 cursor-help" />
                        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
                          <span className="block bg-slate-900 text-white rounded-xl p-3 shadow-xl">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Full Price Breakdown</span>
                            {breakdownRows.map((row) => (
                              <span key={row.name} className="flex items-center justify-between text-xs py-0.5">
                                <span className="text-slate-300">{row.name}{row.count > 1 ? ` × ${row.count}` : ''}</span>
                                <span className="font-semibold">{formatCurrency(row.amount * row.count)}</span>
                              </span>
                            ))}
                            <span className="flex items-center justify-between text-xs py-0.5 border-t border-slate-700 mt-1 pt-1.5">
                              <span className="text-slate-300">GST (18%)</span>
                              <span className="font-semibold">{formatCurrency(gst)}</span>
                            </span>
                            <span className="flex items-center justify-between text-xs pt-1 font-bold">
                              <span>Total</span>
                              <span>{formatCurrency(base)}</span>
                            </span>
                          </span>
                          <span className="block w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
                        </span>
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">{adults} × Adult @ {formatCurrency(adultNetRate(selectedVisa))}</span>
                        <span className="font-medium text-slate-800">{formatCurrency(adults * adultNetRate(selectedVisa))}</span>
                      </div>
                      {children > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">{children} × Child @ {formatCurrency(childNetRate(selectedVisa))}</span>
                          <span className="font-medium text-slate-800">{formatCurrency(children * childNetRate(selectedVisa))}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">GST (18%)</span>
                        <span className="font-medium text-slate-800">+{formatCurrency(gst)}</span>
                      </div>
                      {discount > 0 && (
                        <>
                          <div className="flex items-center justify-between text-xs text-green-700">
                            <span>Promo discount ({promoResult?.code})</span>
                            <span className="font-semibold">-{formatCurrency(discount)}</span>
                          </div>
                        </>
                      )}
                      <div className="border-t border-brand-200 pt-2" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-brand-800">Total</p>
                          {r.corp && <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Corporate</span>}
                        </div>
                        <div className="text-right">
                          {discount > 0 && <p className="text-xs text-slate-400 line-through">{formatCurrency(base)}</p>}
                          <p className="text-2xl font-bold text-brand-900">{formatCurrency(finalTotal)}</p>
                          <p className="text-[10px] text-slate-400">Inclusive of 18% GST</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end mt-3"><CreditCard className="w-6 h-6 text-brand-400" /></div>
                  </div>
                );
              })()}

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <p className="text-sm text-emerald-700">
                  <strong>Pay by UPI.</strong> After you submit, you&apos;ll see a QR code and UPI ID to pay from any UPI app. Our team verifies the payment, and visa processing starts once it is verified.
                </p>
              </div>

              {/* Terms configured by the admin for this visa type, mandatory ones gate submission. */}
              {visaTerms.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Terms &amp; Conditions</p>
                  <div className="space-y-2.5">
                    {visaTerms.map((term, i) => (
                      <label key={term._id || i} className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={!!termsAccepted[i]}
                          onChange={(e) => setTermsAccepted((prev) => ({ ...prev, [i]: e.target.checked }))}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0"
                        />
                        <span className="text-sm text-slate-700 group-hover:text-slate-900">
                          {term.text}
                          {term.required && <span className="text-red-500 ml-1">*</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                  {!allRequiredTermsAccepted && (
                    <p className="text-xs text-red-500 mt-3">Please accept all required terms to continue.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={goBack} disabled={step === 1 || submitting}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        {step < 4 ? (
          <Button onClick={goNext} disabled={!canProceed()}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting || !allRequiredTermsAccepted} className="min-w-[200px]">
            {submitting ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">{submitStatus || 'Submitting…'}</span></span>
            ) : (
              <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" />Submit &amp; Pay by UPI</span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
