'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, ChevronLeft, Loader2, Check, Upload, X, FileText, Search,
  Vault, CreditCard, Calendar, Globe, Clock, MapPin, Tag, Copy,
  Users, Minus, Plus, Shield, ArrowRight, Download, Info, PencilLine,
  AlertTriangle, Link2, Mail, Phone, Save, CircleCheck, Circle,
} from 'lucide-react';
import VisaDownloads from '@/components/visa/VisaDownloads';
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
  getDraft, createDraft, updateDraft, deleteDraft,
} from '@/lib/api';
import StartOverDialog from '@/components/apply/StartOverDialog';
import ParentApplicationPicker, { parentLinkValid } from '@/components/apply/ParentApplicationPicker';
import type { ParentLinkValue } from '@/components/apply/ParentApplicationPicker';
import PassportScanCard, { PASSPORT_FRONT_FIELDS, PASSPORT_BACK_FIELDS } from '@/components/passport/PassportScanCard';
import { formatCurrency } from '@/lib/utils';
import { useVisaConfigLabels } from '@/lib/useVisaConfigLabels';
import { useAuthStore } from '@/store/auth.store';
import { docRuleMet, mergeFormItems, shownSubFields } from '@/types';
import type { Country, VisaType, FormField, FormItem, DocumentRequirement, VaultDocument, SubField } from '@/types';

type Step = 1 | 2 | 3;
type DocSource =
  | { type: 'vault'; vaultDocId: string; label: string; url: string }
  | { type: 'file'; file: File }
  | { type: 'files'; files: File[] };
type Traveler = { key: string; label: string; type: 'adult' | 'child' };

const STEPS = ['Country', 'Visa Type', 'Application Form'];
const DRAFT_KEY = 'visa_app_draft';
const ACCEPTED = '.jpg,.jpeg,.png,.pdf,.doc,.docx';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
// The first file keeps the requirement's name, extras get "(2)", "(3)" so they share its slot.
const partName = (label: string, i: number) => (i === 0 ? label : `${label} (${i + 1})`);
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

// Conditional uploads appear only while the traveller's answer asks for them; a hidden
// one is never required and is left out of the submission.
const docsForTraveler = (docs: DocumentRequirement[], tr: Traveler, formData: Record<string, string>) =>
  docs.filter((d) => appliesToTraveler(d.applicantType, tr.type)
    && docRuleMet(d, (field) => formData[`${tr.key}__${field}`]));

// Questions and document uploads are one list for the applicant, the admin authors
// them in a single sequence, so they render interleaved in exactly that order.
const itemsForTraveler = (fields: FormField[], docs: DocumentRequirement[], tr: Traveler): FormItem[] =>
  mergeFormItems(fieldsForTraveler(fields, tr), docs);

// Rows the form adds itself for children: a NOC when only one parent (or a guardian) is
// linked, and a birth certificate for child-only orders when the visa doesn't ask for one.
const NOC_REQ: DocumentRequirement = {
  _id: '__noc__', name: 'NOC from other parent / guardianship document', required: true, applicantType: 'child', order: 9998,
  description: 'Needed when only one parent travels, or a guardian is linked',
};
const BIRTH_REQ: DocumentRequirement = {
  _id: '__birth__', name: 'Birth certificate', required: true, applicantType: 'child', order: 9999,
  description: "Shows the child's parents' names",
};
const PARENT_APP_KEY = '__parentapp__';

// Form-wide values ride along in formData under reserved keys, so local and server
// drafts keep them without a schema change. Real field keys always contain "__" after a traveller key.
const CONTACT_EMAIL_KEY = '__contact__email';
const CONTACT_MOBILE_KEY = '__contact__mobile';
const parentsKey = (childKey: string) => `__parents__${childKey}`;

type ParentRelation = 'father' | 'mother' | 'guardian';
type ParentLink = { key: string; relation: ParentRelation };
const RELATIONS: { value: ParentRelation; label: string }[] = [
  { value: 'father', label: 'Father' }, { value: 'mother', label: 'Mother' }, { value: 'guardian', label: 'Guardian' },
];
const MAX_TRAVELLERS = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Indian mobile: 10 digits starting 6-9, typed with or without +91.
const mobileDigits = (v: string) => v.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
const MOBILE_RE = /^[6-9]\d{9}$/;

/** Upper bound of a processing time like "3-4 working days", "24-48 hours" or "2 weeks", in working days. */
function processingWorkingDays(text: string | undefined): number {
  const t = (text || '').toLowerCase();
  const nums = (t.match(/\d+/g) || []).map(Number);
  if (!nums.length) return 0;
  const max = Math.max(...nums);
  if (/hour|hrs?\b/.test(t)) return Math.ceil(max / 24);
  if (/week/.test(t)) return max * 5;
  return max;
}

/** Allowed stay in days from a label like "30 days" or "Up to 90 Days"; 0 when not stated in days. */
function allowedStayDays(text: string | undefined): number {
  const t = (text || '').toLowerCase();
  const n = Number(t.match(/\d+/)?.[0] || 0);
  if (!n) return 0;
  if (/day/.test(t)) return n;
  if (/month/.test(t)) return n * 30;
  return 0;
}

const addWorkingDays = (from: Date, n: number) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let added = 0; added < n;) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
};

// Both the departure and the return day count, so 26 Oct to 1 Nov is a 7-day stay.
const stayLength = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;

function Counter({ value, onChange, min, max = 99 }: { value: number; onChange: (v: number) => void; min: number; max?: number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-5 text-center text-base font-bold text-slate-900 tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

/** One numbered card of the single-page form; the sidebar progress links to its id. */
function FormSection({ id, n, title, done, aside, children }: {
  id: string; n: number; title: string; done: boolean; aside?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? 'bg-green-600 text-white' : 'bg-brand-900 text-white'}`}>
          {done ? <Check className="w-3.5 h-3.5" /> : n}
        </span>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
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
              {WEEK_DAYS.map((d) => <div key={d} className="text-center text-xs font-semibold text-gold-600 py-1">{d}</div>)}
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
                        isStart || isEnd ? 'bg-brand-900 text-white font-bold shadow' :
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
              <div className="bg-gold-50 border border-gold-100 rounded-2xl p-3.5">
                <p className="text-xs text-brand-800 font-semibold mb-1">Visa Type</p>
                <p className="text-sm font-bold text-brand-950">{labelFor('visaSubType', visa.visaSubType)}</p>
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
                          {applicantType === 'both' && <span className="text-[10px] font-semibold text-gold-600 bg-gold-50 px-1.5 py-0.5 rounded-full">All travellers</span>}
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

          {visa.downloads && visa.downloads.length > 0 && <VisaDownloads downloads={visa.downloads} />}

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
            className="w-full py-3.5 bg-brand-900 hover:bg-brand-800 active:bg-brand-800 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-md">
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
      <div className="relative overflow-hidden px-5 py-5 bg-gradient-to-br from-slate-800 via-brand-900 to-brand-950">
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
            selected ? 'bg-brand-900' : 'bg-slate-100 group-hover:bg-brand-100'
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
  // Server-side draft this progress was resumed from (or last saved to), see StartOverDialog.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [showStartOver, setShowStartOver] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
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
    const vaultPromise: Promise<VaultDocument[]> = getVaultDocuments()
      .then((r) => { const docs = r.data.data || []; setVaultDocs(docs); return docs; })
      .catch(() => []);

    // Resuming from My Applications: the saved draft replaces whatever was in progress here.
    const params = new URLSearchParams(window.location.search);
    const savedDraftId = params.get('draft');
    // Arriving from a country page: start that country (and visa, when given) fresh.
    const linkCountry = params.get('country');
    if (linkCountry && !savedDraftId) {
      window.history.replaceState(null, '', '/apply');
      startFromLink(linkCountry, params.get('visa')).finally(() => setDraftRestored(true));
      return;
    }
    if (savedDraftId) {
      window.history.replaceState(null, '', '/apply');
      resumeSavedDraft(savedDraftId, vaultPromise).finally(() => setDraftRestored(true));
      return;
    }

    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.selectedCountry) setSelectedCountry(d.selectedCountry);
        if (d.formData) setFormData(d.formData);
        if (d.passportValues) setPassportValues(d.passportValues);
        if (d.step) setStep(Math.min(d.step, 3) as Step);
        if (d.travelStartDate) setTravelStartDate(d.travelStartDate);
        if (d.travelEndDate) setTravelEndDate(d.travelEndDate);
        if (d.adults) setAdults(d.adults);
        if (typeof d.children === 'number') setChildren(d.children);
        if (d.draftId) setDraftId(d.draftId);

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
    const draft = { step, selectedCountry, selectedVisa, formData, passportValues, travelStartDate, travelEndDate, adults, children, draftId };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draftRestored, step, selectedCountry, selectedVisa, formData, passportValues, travelStartDate, travelEndDate, adults, children, draftId]);

  useEffect(() => {
    if (activeTraveler > travelers.length - 1) setActiveTraveler(0);
  }, [travelers.length, activeTraveler]);

  const resumeSavedDraft = async (id: string, vaultPromise: Promise<VaultDocument[]>) => {
    setLoading(true);
    try {
      const [r, vault] = await Promise.all([getDraft(id), vaultPromise]);
      const d = r.data.data;
      const fresh: VisaType[] = (await getPublicVisaTypes(d.country._id)).data.data;
      const visa = fresh.find((v) => v._id === d.visaType) ?? null;
      setSelectedCountry(d.country);
      setVisaTypes(fresh);
      setSelectedVisa(visa);
      setFormData(d.formData || {});
      setPassportValues(d.passportValues || {});
      setTravelStartDate(d.travelStartDate || '');
      setTravelEndDate(d.travelEndDate || '');
      setAdults(d.adults ?? 1);
      setChildren(d.children || 0);
      setActiveTraveler(0);
      // Vault picks are kept by id; any document since removed from the vault is dropped.
      const picks: { key: string; vaultDocId: string }[] = d.vaultPicks || [];
      setDocSources(Object.fromEntries(picks.flatMap((p) => {
        const doc = vault.find((v) => v._id === p.vaultDocId);
        return doc ? [[p.key, { type: 'vault' as const, vaultDocId: doc._id, label: doc.label, url: doc.url }]] : [];
      })));
      // A visa that's since been withdrawn sends the user back to choosing one.
      setStep(Math.min(visa ? d.step : 2, 3) as Step);
      setDraftId(id);
    } catch {
      toast({ title: 'Could not open this draft', description: 'It may have been deleted. Starting a new application.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const startFromLink = async (countryId: string, visaId: string | null) => {
    setLoading(true);
    try {
      const list: Country[] = (await getActiveCountries()).data.data;
      const country = list.find((c) => c._id === countryId || c.slug === countryId);
      if (!country) return;
      const fresh: VisaType[] = (await getPublicVisaTypes(country._id)).data.data;
      localStorage.removeItem(DRAFT_KEY);
      setSelectedCountry(country);
      setVisaTypes(fresh);
      const visa = visaId ? fresh.find((v) => v._id === visaId) ?? null : null;
      setSelectedVisa(visa);
      setStep(visa ? 3 : 2);
    } catch {
      toast({ title: 'Could not open that visa', description: 'Pick your destination below.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const hasUploadedFiles = Object.values(docSources).some((s) => s.type !== 'vault');

  // Only ask when there's something to lose.
  const startOver = () => {
    if (selectedCountry) setShowStartOver(true);
    else resetWizard();
  };

  // Saves progress to My Applications. Uploaded files stay on this device; vault picks are kept.
  const saveDraftToServer = async (): Promise<boolean> => {
    if (!selectedCountry) return false;
    const payload = {
      country: selectedCountry._id,
      visaType: selectedVisa?._id ?? null,
      step, formData, passportValues, travelStartDate, travelEndDate, adults, children,
      vaultPicks: Object.entries(docSources).flatMap(([key, s]) => (s.type === 'vault' ? [{ key, vaultDocId: s.vaultDocId }] : [])),
    };
    // The draft may have been deleted from another tab; save it fresh then.
    const r = draftId
      ? await updateDraft(draftId, payload).catch((err) => {
        if (err.response?.status === 404) return createDraft(payload);
        throw err;
      })
      : await createDraft(payload);
    const savedId = r?.data?.data?._id;
    if (savedId) setDraftId(savedId);
    return true;
  };

  const saveAndStartOver = async () => {
    setSavingDraft(true);
    try {
      if (!(await saveDraftToServer())) return;
      toast({ title: 'Saved to My Applications', description: 'Pick it up anytime from My Applications.', variant: 'success' });
      setShowStartOver(false);
      resetWizard();
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.response?.data?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingDraft(false);
    }
  };

  const saveDraftNow = async () => {
    setSavingDraft(true);
    try {
      await saveDraftToServer();
      toast({ title: 'Draft saved', description: 'Find it in My Applications. Uploaded files stay on this device until you submit.', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.response?.data?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingDraft(false);
    }
  };

  const resetWizard = () => {
    setShowStartOver(false);
    setDraftId(null);
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

  // Adds files to a document slot; a slot holds several files or one vault pick.
  const pickFilesFor = (storeKey: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED;
    input.multiple = true;
    input.onchange = (e: any) => {
      const picked: File[] = Array.from(e.target?.files || []);
      const tooBig = picked.filter((f) => f.size > MAX_FILE_BYTES);
      if (tooBig.length) toast({ title: 'File too large', description: `${tooBig.map((f) => f.name).join(', ')} is over 10 MB.`, variant: 'destructive' });
      const ok = picked.filter((f) => f.size <= MAX_FILE_BYTES);
      if (!ok.length) return;
      setDocSources((prev) => {
        const cur = prev[storeKey];
        const existing = cur?.type === 'files' ? cur.files : [];
        return { ...prev, [storeKey]: { type: 'files', files: [...existing, ...ok] } };
      });
    };
    input.click();
  };

  const removeFileAt = (storeKey: string, index: number) => {
    setDocSources((prev) => {
      const cur = prev[storeKey];
      if (cur?.type !== 'files') return prev;
      const files = cur.files.filter((_, i) => i !== index);
      const next = { ...prev };
      if (files.length) next[storeKey] = { type: 'files', files }; else delete next[storeKey];
      return next;
    });
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
      responses['Contact Email'] = contactEmail.trim().toLowerCase();
      responses['Contact Mobile (WhatsApp)'] = `+91 ${mobileDigits(contactMobile)}`;

      const r = await createApplication({
        visaTypeId: selectedVisa._id,
        formResponses: responses,
        adults,
        children,
        travelDate: travelStartDate,
        travelEndDate,
        travellers: travelers.map((tr) => ({ key: tr.key, parents: tr.type === 'child' && !childOnly ? parentLinksOf(tr.key) : [] })),
        ...(childOnly && parentApp ? { parentLink: { applicationId: parentApp.applicationId, parents: parentApp.parents } } : {}),
        acceptedTerms: visaTerms.filter((_, i) => termsAccepted[i]).map((t) => t.text),
      });
      const appId = r.data.data._id;

      const reqs = withDefaultPassport(selectedVisa.documentRequirements);
      let uploadIdx = 0;

      const doUpload = async (file: File, requirementName: string, docType = '', extractedData?: Record<string, string>, triggeredBy = '') => {
        uploadIdx++;
        setSubmitStatus(`Uploading documents (${uploadIdx})…`);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('requirementName', requirementName);
        if (docType) fd.append('docType', docType);
        if (triggeredBy) fd.append('triggeredBy', triggeredBy);
        if (extractedData && Object.keys(extractedData).length > 0) fd.append('extractedData', JSON.stringify(extractedData));
        await uploadDocument(appId, fd);
      };

      const pickFields = (pv: Record<string, string>, keys: string[]) =>
        Object.fromEntries(keys.filter((k) => pv[k]?.trim()).map((k) => [k, pv[k].trim()]));

      for (const tr of travelers) {
        for (const req of [...docsForTraveler(reqs, tr, formData), ...extraReqsFor(tr)]) {
          const label = `${tr.label} - ${req.name}`;
          const because = triggerText(req, tr);
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
              await addDocumentFromVault(appId, { vaultDocId: source.vaultDocId, requirementName: label, triggeredBy: because });
            } else if (source.type === 'files') {
              for (const [i, file] of source.files.entries()) await doUpload(file, partName(label, i), req.docType || '', undefined, because);
            } else {
              const pv = passportValues[tr.key] || {};
              const ocrData = req.ocrEnabled !== false
                ? (req.docType === 'passport_front' ? pickFields(pv, PASSPORT_FRONT_FIELDS)
                  : req.docType === 'passport_back' ? pickFields(pv, PASSPORT_BACK_FIELDS)
                  : undefined)
                : undefined;
              await doUpload(source.file, label, req.docType || '', ocrData, because);
            }
          }
        }
      }

      localStorage.removeItem(DRAFT_KEY);
      if (draftId) deleteDraft(draftId).catch(() => {});
      toast({ title: 'Application saved', description: 'Complete your payment to start processing.', variant: 'success' });
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

  const goNext = () => setStep((s) => Math.min(s + 1, 3) as Step);
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

  // ── Single-page form state ──
  const contactEmail = formData[CONTACT_EMAIL_KEY] ?? '';
  const contactMobile = formData[CONTACT_MOBILE_KEY] ?? '';
  const setFormValue = (key: string, value: string) => setFormData((prev) => ({ ...prev, [key]: value }));

  // Contact details start from the account and stay editable.
  const contactUnset = formData[CONTACT_EMAIL_KEY] === undefined;
  useEffect(() => {
    if (!draftRestored || !user || !contactUnset) return;
    setFormData((prev) => ({
      ...prev,
      [CONTACT_EMAIL_KEY]: prev[CONTACT_EMAIL_KEY] ?? user.email ?? '',
      [CONTACT_MOBILE_KEY]: prev[CONTACT_MOBILE_KEY] ?? (user.phone ? mobileDigits(user.phone) : ''),
    }));
  }, [draftRestored, user, contactUnset]);

  // Parent links point at adults on this same order; links to an adult since removed drop out.
  const parentLinksOf = (childKey: string): ParentLink[] => {
    try {
      const raw: ParentLink[] = JSON.parse(formData[parentsKey(childKey)] || '[]');
      return raw.filter((l) => travelers.some((t) => t.type === 'adult' && t.key === l.key));
    } catch {
      return [];
    }
  };
  const setParentLinks = (childKey: string, links: ParentLink[]) => setFormValue(parentsKey(childKey), JSON.stringify(links));
  const toggleParent = (childKey: string, adultKey: string) => {
    const links = parentLinksOf(childKey);
    setParentLinks(childKey, links.some((l) => l.key === adultKey)
      ? links.filter((l) => l.key !== adultKey)
      : [...links, { key: adultKey, relation: (links.some((l) => l.relation === 'father') ? 'mother' : 'father') as ParentRelation }].slice(-2));
  };
  const setRelation = (childKey: string, adultKey: string, relation: ParentRelation) =>
    setParentLinks(childKey, parentLinksOf(childKey).map((l) => (l.key === adultKey ? { ...l, relation } : l)));
  const needsParentLink = (tr: Traveler) => tr.type === 'child' && adults > 0;

  // ── Child-only orders travel on a parent's earlier application ──
  const childOnly = adults === 0 && children > 0;
  const parentApp: ParentLinkValue | null = (() => {
    try { return formData[PARENT_APP_KEY] ? JSON.parse(formData[PARENT_APP_KEY]) : null; } catch { return null; }
  })();
  const setParentApp = (v: ParentLinkValue | null) =>
    setFormData((prev) => {
      const next = { ...prev };
      if (v) next[PARENT_APP_KEY] = JSON.stringify(v); else delete next[PARENT_APP_KEY];
      return next;
    });

  const extraReqsFor = (tr: Traveler): DocumentRequirement[] => {
    if (tr.type !== 'child') return [];
    const links = childOnly ? parentApp?.parents || [] : parentLinksOf(tr.key);
    const extras: DocumentRequirement[] = [];
    if (links.length === 1 || links.some((l) => l.relation === 'guardian')) extras.push(NOC_REQ);
    const asksBirth = requirements.some((r) => appliesToTraveler(r.applicantType, 'child') && /birth/i.test(r.name));
    if (childOnly && !asksBirth) extras.push(BIRTH_REQ);
    return extras;
  };
  const reqsFor = (tr: Traveler) => [...docsForTraveler(requirements, tr, formData), ...extraReqsFor(tr)];

  // The answer that made a conditional upload appear, e.g. "Marital Status = Married".
  const triggerText = (req: DocumentRequirement, tr: Traveler) => {
    if (!req.showWhen?.field || !selectedVisa) return '';
    const q = selectedVisa.formFields.find((f) => f.fieldName === req.showWhen!.field);
    const answer = formData[`${tr.key}__${req.showWhen.field}`];
    return q && answer ? `${q.label || q.fieldName} = ${answer}` : '';
  };

  const travelerComplete = (tr: Traveler) => {
    const fieldsOk = questionsForTraveler(sortedFields, tr, formData).filter((f) => f.required).every((f) => !!formData[`${tr.key}__${f.fieldName}`]?.trim());
    const docsOk = reqsFor(tr).filter((r) => r.required).every((r) => {
      if (isPassportPair(r) && r.ocrEnabled !== false) return !!docSources[docKey(tr, r.name, '__front')] && !!docSources[docKey(tr, r.name, '__back')];
      return !!docSources[docKey(tr, r.name)];
    });
    const parentOk = !needsParentLink(tr) || parentLinksOf(tr.key).length > 0;
    return fieldsOk && docsOk && parentOk;
  };

  // ── Travel date rules ──
  const today = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }, []);
  const procDays = processingWorkingDays(selectedVisa?.processingTime);
  const earliestDeparture = useMemo(() => addWorkingDays(today, Math.max(1, procDays)), [today, procDays]);
  const latestDeparture = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + 180); return d; }, [today]);
  const allowedStay = allowedStayDays(selectedVisa?.stayDuration);
  const singleEntry = (selectedVisa?.entry || []).some((e) => /single/i.test(e)) && !(selectedVisa?.entry || []).some((e) => /multi/i.test(e));
  const stayDays = travelStartDate && travelEndDate ? stayLength(travelStartDate, travelEndDate) : 0;
  const dateErrors = {
    departure: !travelStartDate ? 'Choose your departure date'
      : travelStartDate < fmtDate(earliestDeparture) ? `Earliest possible departure is ${fmtDisplay(fmtDate(earliestDeparture))}`
      : travelStartDate > fmtDate(latestDeparture) ? `Departure must be within 180 days (by ${fmtDisplay(fmtDate(latestDeparture))})`
      : '',
    return: !travelEndDate ? 'Choose your return date'
      : travelStartDate && travelEndDate <= travelStartDate ? 'Return date must be after the departure date'
      : '',
  };
  const stayTooLong = !!allowedStay && stayDays > allowedStay;
  const datesOk = !dateErrors.departure && !dateErrors.return && !(stayTooLong && singleEntry);

  const contactErrors = {
    email: !EMAIL_RE.test(contactEmail.trim()) ? 'Enter a valid email address' : '',
    mobile: !MOBILE_RE.test(mobileDigits(contactMobile)) ? 'Mobile must be 10 digits starting with 6, 7, 8 or 9' : '',
  };

  const sections = [
    { id: 'sec-visa', label: 'Visa & travellers', done: !!selectedVisa && adults + children >= 1 && adults + children <= MAX_TRAVELLERS },
    { id: 'sec-dates', label: 'Travel dates', done: datesOk },
    ...(childOnly ? [{ id: 'sec-parent', label: 'Parent / guardian link', done: parentLinkValid(parentApp) }] : []),
    { id: 'sec-travellers', label: 'Travellers & documents', done: travelers.every(travelerComplete) },
    { id: 'sec-contact', label: 'Contact details', done: !contactErrors.email && !contactErrors.mobile },
    { id: 'sec-review', label: 'Review & pay', done: allRequiredTermsAccepted },
  ];
  const doneCount = sections.filter((x) => x.done).length;
  const secNo = (id: string) => sections.findIndex((x) => x.id === id) + 1;
  const secDone = (id: string) => !!sections.find((x) => x.id === id)?.done;
  const allDone = doneCount === sections.length;
  const [showErrors, setShowErrors] = useState(false);

  const scrollToSection = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Submit jumps to the first unfinished section instead of failing silently.
  const trySubmit = () => {
    if (!allDone) {
      setShowErrors(true);
      const first = sections.find((x) => !x.done)!;
      if (first.id === 'sec-travellers') {
        const idx = travelers.findIndex((t) => !travelerComplete(t));
        if (idx >= 0) setActiveTraveler(idx);
      }
      scrollToSection(first.id);
      toast({ title: `Finish "${first.label}"`, description: 'Fields that still need attention are marked in red.', variant: 'destructive' });
      return;
    }
    handleSubmit();
  };

  // Autosave every 20 seconds once a draft exists in My Applications.
  useEffect(() => {
    if (step !== 3 || !draftId || submitting) return;
    const t = setTimeout(() => { saveDraftToServer().catch(() => {}); }, 20000);
    return () => clearTimeout(t);
  }, [step, draftId, submitting, formData, passportValues, travelStartDate, travelEndDate, adults, children]);

  const canProceed = () => {
    if (step === 1) return !!selectedCountry;
    if (step === 2) return !!selectedVisa && !loading;
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
              {applicantType === 'both' && <span className="text-[10px] font-semibold text-gold-600 bg-gold-50 px-1.5 py-0.5 rounded-full">All travellers</span>}
            </p>
            {req.description && <p className="text-xs text-slate-400 mt-0.5">{req.description}</p>}
          </div>
        </div>

        {source?.type === 'vault' && (
          <div className="flex items-center gap-2 mb-3 ml-11">
            <span className="text-xs text-green-700 font-medium flex items-center gap-1"><Vault className="w-3 h-3" /> From vault: {source.label}</span>
            <button onClick={() => clearDocSource(sk)} className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {source?.type === 'files' && (
          <ul className="ml-11 mb-3 space-y-1.5">
            {source.files.map((f, i) => (
              <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2 rounded-lg bg-white border border-green-200 px-2.5 py-1.5">
                <FileText className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <span className="text-xs text-green-800 font-medium truncate min-w-0 flex-1">{f.name}</span>
                <span className="text-[11px] text-slate-400 flex-shrink-0">{formatBytes(f.size)}</span>
                <button onClick={() => removeFileAt(sk, i)} title="Remove file" className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
              </li>
            ))}
          </ul>
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
          <button onClick={() => pickFilesFor(sk)} className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg border border-brand-100 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            {source?.type === 'files' ? 'Add more files' : 'Upload files'}
          </button>
        </div>
      </div>
    );
  };

  const activeTr = travelers[Math.min(activeTraveler, travelers.length - 1)] || travelers[0];

  const travellerName = (tr: Traveler) => {
    const pv = passportValues[tr.key] || {};
    return [pv['Given Name(s)'], pv['Surname']].filter(Boolean).join(' ');
  };

  const renderSinglePage = (visa: VisaType, country: Country) => {
    const r = rateParts(visa);
    const subtotal = orderSubtotal(visa);
    const gst = orderGst(visa);
    const base = subtotal + gst;
    const discount = promoResult?.discount || 0;
    const finalTotal = promoResult ? promoResult.finalAmount : base;
    const fieldError = (msg: string) => showErrors && msg ? <p className="text-xs text-red-600 mt-1" role="alert">{msg}</p> : null;

    const docTotals = travelers.reduce((acc, tr) => {
      for (const req of reqsFor(tr).filter((x) => x.required)) {
        acc.total++;
        const ok = isPassportPair(req) && req.ocrEnabled !== false
          ? !!docSources[docKey(tr, req.name, '__front')] && !!docSources[docKey(tr, req.name, '__back')]
          : !!docSources[docKey(tr, req.name)];
        if (ok) acc.done++;
      }
      return acc;
    }, { done: 0, total: 0 });

    const familyText = travelers.map((tr) => {
      const name = travellerName(tr) || tr.label;
      const links = parentLinksOf(tr.key)
        .map((l) => `${travelers.find((t) => t.key === l.key)?.label} (${RELATIONS.find((x) => x.value === l.relation)?.label})`);
      return links.length ? `${name}, linked to ${links.join(' & ')}` : name;
    }).join(' · ');

    const submitButton = (className = '') => (
      <Button onClick={trySubmit} disabled={submitting} className={`w-full ${allDone ? '' : 'opacity-60'} ${className}`}>
        {submitting
          ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">{submitStatus || 'Submitting…'}</span></span>
          : <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" />Submit &amp; Pay {formatCurrency(finalTotal)}</span>}
      </Button>
    );

    const reviewRow = (label: string, value: React.ReactNode, target: string) => (
      <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0 text-sm">
        <span className="w-24 flex-shrink-0 text-slate-500">{label}</span>
        <span className="flex-1 min-w-0 text-slate-900 font-medium break-words">{value}</span>
        <button type="button" onClick={() => (target === 'visa' ? setStep(2) : scrollToSection(target))}
          className="text-xs font-semibold text-brand-700 hover:underline flex-shrink-0">Edit</button>
      </div>
    );

    return (
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start pb-24 lg:pb-0">
        <div className="space-y-5 min-w-0">
          {/* 1 · Visa & travellers */}
          <FormSection id="sec-visa" n={secNo('sec-visa')} title="Visa & travellers" done={secDone('sec-visa')}
            aside={<button type="button" onClick={() => setStep(2)} className="text-xs font-semibold text-brand-700 hover:underline">Change visa</button>}>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4">
              <img src={`https://flagcdn.com/w40/${country.flag}.png`} alt="" className="w-8 h-5 object-cover rounded mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{country.name} · {visa.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatCurrency(adultRate(visa))} per adult{children > 0 ? ` · ${formatCurrency(childRate(visa))} per child` : ''} · GST included
                  {visa.processingTime && <> · processing {visa.processingTime}</>}
                  {visa.stayDuration && <> · stay up to {visa.stayDuration}</>}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Adults</p>
                  <p className="text-xs text-slate-400">18+ years on departure</p>
                </div>
                <Counter value={adults} min={children > 0 ? 0 : 1} max={MAX_TRAVELLERS - children} onChange={setAdults} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Children</p>
                  <p className="text-xs text-slate-400">Under 18 on departure</p>
                </div>
                <Counter value={children} min={adults === 0 ? 1 : 0} max={Math.min(9, MAX_TRAVELLERS - adults)} onChange={setChildren} />
              </div>
            </div>
          </FormSection>

          {/* 2 · Travel dates */}
          <FormSection id="sec-dates" n={secNo('sec-dates')} title="Travel dates" done={secDone('sec-dates')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="departure">Departure date <span className="text-red-500">*</span></Label>
                <Input id="departure" type="date" className="mt-1" value={travelStartDate}
                  min={fmtDate(earliestDeparture)} max={fmtDate(latestDeparture)}
                  aria-invalid={showErrors && !!dateErrors.departure}
                  onChange={(e) => setTravelStartDate(e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">
                  Earliest: {fmtDisplay(fmtDate(earliestDeparture))}{procDays ? ` (today + ${procDays} working days for processing)` : ''}
                </p>
                {(showErrors || !!travelStartDate) && dateErrors.departure && (
                  <p className="text-xs text-red-600 mt-1" role="alert">{dateErrors.departure}</p>
                )}
              </div>
              <div>
                <Label htmlFor="return">Return date <span className="text-red-500">*</span></Label>
                <Input id="return" type="date" className="mt-1" value={travelEndDate}
                  min={travelStartDate || fmtDate(earliestDeparture)}
                  aria-invalid={showErrors && !!dateErrors.return}
                  onChange={(e) => setTravelEndDate(e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Must be after departure</p>
                {(showErrors || !!travelEndDate) && dateErrors.return && (
                  <p className="text-xs text-red-600 mt-1" role="alert">{dateErrors.return}</p>
                )}
              </div>
            </div>
            {stayDays > 0 && !dateErrors.return && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs font-semibold text-brand-900 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-1">
                  Stay: {stayDays} day{stayDays === 1 ? '' : 's'}
                </span>
                {allowedStay > 0 && !stayTooLong && (
                  <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-1">
                    <Check className="inline w-3 h-3 mr-0.5" />Within {allowedStay} days allowed
                  </span>
                )}
              </div>
            )}
            {stayTooLong && (
              <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${singleEntry ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`} role="alert">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Your {stayDays}-day trip is longer than the {allowedStay} days this visa allows.
                  {singleEntry ? ' Shorten the trip or choose a longer visa to continue.' : ' Consider a longer visa type.'}
                  {' '}<button type="button" onClick={() => setStep(2)} className="font-semibold underline">See other visas</button>
                </span>
              </div>
            )}
          </FormSection>

          {/* 3 · Travellers: answers and uploads, one tab per person */}
          {childOnly && (
            <FormSection id="sec-parent" n={secNo('sec-parent')} title="Link with parent / guardian application" done={secDone('sec-parent')}>
              <ParentApplicationPicker
                countryId={country._id}
                from={travelStartDate}
                to={travelEndDate}
                value={parentApp}
                onChange={setParentApp}
                onParentApplyingNow={() => { setAdults(1); setParentApp(null); }}
                showErrors={showErrors}
              />
            </FormSection>
          )}

          <FormSection id="sec-travellers" n={secNo('sec-travellers')} title="Travellers & documents" done={secDone('sec-travellers')}
            aside={<span className="text-xs text-slate-400">PDF, JPG, PNG, DOC · max 10 MB</span>}>
            <div className="flex flex-wrap gap-2 mb-5 border-b border-slate-100 pb-3" role="tablist">
              {travelers.map((tr, idx) => {
                const isActive = idx === Math.min(activeTraveler, travelers.length - 1);
                const complete = travelerComplete(tr);
                return (
                  <button key={tr.key} type="button" role="tab" aria-selected={isActive} onClick={() => setActiveTraveler(idx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                      isActive ? (tr.type === 'adult' ? 'border-brand-900 bg-brand-50 text-brand-900' : 'border-emerald-600 bg-emerald-50 text-emerald-800')
                      : showErrors && !complete ? 'border-red-200 text-red-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    {complete ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Users className="w-3.5 h-3.5" />}
                    {tr.label}
                  </button>
                );
              })}
            </div>

            {activeTr && (() => {
              const items = itemsForTraveler(sortedFields, reqsFor(activeTr), activeTr);
              const links = parentLinksOf(activeTr.key);
              return (
                <div className="space-y-5">
                  {needsParentLink(activeTr) && (
                    <div className={`rounded-xl border-2 p-4 ${showErrors && !links.length ? 'border-red-200 bg-red-50/40' : 'border-gold-200 bg-gold-50/40'}`}>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <Link2 className="w-4 h-4 text-gold-600" /> Link with parent (same application) <span className="text-red-500">*</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 mb-3">Tick the adult(s) on this application who are {activeTr.label}&apos;s parents or guardian.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {travelers.filter((t) => t.type === 'adult').map((adult) => {
                          const link = links.find((l) => l.key === adult.key);
                          return (
                            <div key={adult.key} className={`rounded-lg border p-3 ${link ? 'border-gold-400 bg-white' : 'border-slate-200 bg-white'}`}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={!!link} onChange={() => toggleParent(activeTr.key, adult.key)} className="w-4 h-4 rounded" />
                                <span className="text-sm font-semibold text-slate-900">{adult.label}</span>
                                {travellerName(adult) && <span className="text-xs text-slate-500 truncate">{travellerName(adult)}</span>}
                              </label>
                              {link && (
                                <div className="flex gap-1.5 mt-2" role="radiogroup" aria-label={`Relation of ${adult.label}`}>
                                  {RELATIONS.map((rel) => (
                                    <button key={rel.value} type="button" role="radio" aria-checked={link.relation === rel.value}
                                      onClick={() => setRelation(activeTr.key, adult.key, rel.value)}
                                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${link.relation === rel.value ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                                      {rel.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {links.length > 0 && (
                        <p className="text-xs text-green-700 mt-3 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Parent passport copies are taken from this same application, no need to upload them again.
                        </p>
                      )}
                      {showErrors && !links.length && <p className="text-xs text-red-600 mt-2" role="alert">Link this child to at least one parent or guardian.</p>}
                    </div>
                  )}

                  {items.map((item) =>
                    item.kind === 'field' ? (
                      <div key={`f:${item.field._id || item.field.fieldName}`}>
                        <Label htmlFor={`${activeTr.key}__${item.field.fieldName}`}>
                          {item.field.label}
                          {item.field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <div className="mt-1">{renderField(item.field, activeTr.key)}</div>
                        {item.field.required && fieldError(formData[`${activeTr.key}__${item.field.fieldName}`]?.trim() ? '' : 'This answer is required')}
                        {shownSubFields(item.field, formData[`${activeTr.key}__${item.field.fieldName}`]).map((sub) => (
                          <div key={sub.fieldName} className="mt-3 ml-1 pl-4 border-l-2 border-brand-200 animate-fade-in">
                            <Label htmlFor={`${activeTr.key}__${sub.fieldName}`}>
                              {sub.label}
                              {sub.required && <span className="text-red-500 ml-1">*</span>}
                            </Label>
                            <div className="mt-1">{renderField(sub, activeTr.key)}</div>
                            {sub.required && fieldError(formData[`${activeTr.key}__${sub.fieldName}`]?.trim() ? '' : 'This answer is required')}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div key={`d:${item.doc._id || item.doc.name}`} className={item.doc.showWhen ? 'animate-fade-in' : undefined}>
                        {item.doc.showWhen && triggerText(item.doc, activeTr) && (
                          <p className="text-[11px] font-semibold text-gold-700 mb-1.5">Because: {triggerText(item.doc, activeTr)}</p>
                        )}
                        {renderDocCard(activeTr, item.doc)}
                      </div>
                    ),
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button type="button" disabled={activeTraveler === 0} onClick={() => setActiveTraveler((i) => Math.max(0, i - 1))}
                      className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1">
                      <ChevronLeft className="w-4 h-4" /> Previous traveller
                    </button>
                    {activeTraveler < travelers.length - 1 ? (
                      <button type="button" onClick={() => setActiveTraveler((i) => Math.min(travelers.length - 1, i + 1))}
                        className="text-sm font-semibold text-brand-700 hover:text-brand-900 flex items-center gap-1">
                        Next traveller <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : <span className="text-xs text-slate-400">Last traveller</span>}
                  </div>
                </div>
              );
            })()}
          </FormSection>

          {/* 4 · Contact */}
          <FormSection id="sec-contact" n={secNo('sec-contact')} title="Contact details" done={secDone('sec-contact')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact-email">Email <span className="text-red-500">*</span></Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input id="contact-email" type="email" className="pl-9" placeholder="name@email.com" value={contactEmail}
                    aria-invalid={showErrors && !!contactErrors.email}
                    onChange={(e) => setFormValue(CONTACT_EMAIL_KEY, e.target.value)} />
                </div>
                {fieldError(contactErrors.email)}
              </div>
              <div>
                <Label htmlFor="contact-mobile">Mobile (WhatsApp) <span className="text-red-500">*</span></Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <span className="absolute left-9 top-1/2 -translate-y-1/2 text-sm text-slate-500">+91</span>
                  <Input id="contact-mobile" type="tel" inputMode="numeric" className="pl-[4.25rem]" placeholder="98xxx xxxxx" value={contactMobile}
                    aria-invalid={showErrors && !!contactErrors.mobile}
                    onChange={(e) => setFormValue(CONTACT_MOBILE_KEY, e.target.value.replace(/[^\d\s+]/g, '').slice(0, 16))} />
                </div>
                <p className="text-xs text-slate-400 mt-1">Application updates are sent on this WhatsApp number</p>
                {fieldError(contactErrors.mobile)}
              </div>
            </div>
          </FormSection>

          {/* 5 · Review, promo, terms, submit */}
          <FormSection id="sec-review" n={secNo('sec-review')} title="Review & confirm" done={secDone('sec-review')}>
            <div className="mb-4">
              {reviewRow('Visa', `${country.name} · ${visa.name}`, 'visa')}
              {reviewRow('Dates', travelStartDate && travelEndDate ? `${fmtDisplay(travelStartDate)} to ${fmtDisplay(travelEndDate)} (${stayDays} day${stayDays === 1 ? '' : 's'})` : <span className="text-slate-400">Not chosen yet</span>, 'sec-dates')}
              {reviewRow(travelers.length > 1 ? 'Family' : 'Traveller', familyText, 'sec-travellers')}
              {childOnly && reviewRow('Parent', parentApp ? `Travels with ${parentApp.ref}` : <span className="text-slate-400">Not linked yet</span>, 'sec-parent')}
              {reviewRow('Documents', `${docTotals.done} of ${docTotals.total} required uploaded`, 'sec-travellers')}
              {reviewRow('Contact', `${contactEmail || 'no email'} · +91 ${mobileDigits(contactMobile) || '...'}`, 'sec-contact')}
            </div>

            {user?.promoApplicable !== false && (
              <div className="border border-gold-200 bg-gold-50/50 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-gold-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Promo Code
                </p>
                {promoResult ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-green-700 flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span className="font-mono tracking-widest">{promoResult.code}</span> applied
                      </p>
                      <p className="text-xs text-green-600 mt-0.5">
                        You save {promoResult.discountType === 'percentage' ? `${promoResult.discountValue}%` : formatCurrency(promoResult.discountValue)} ({formatCurrency(promoResult.discount)} off)
                      </p>
                    </div>
                    <button type="button" onClick={removePromo} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
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
                        aria-label="Promo code"
                        className="flex-1 h-9 px-3 text-sm font-mono font-semibold tracking-widest uppercase rounded-lg border border-gold-200 bg-white focus:outline-none focus:ring-2 focus:ring-gold-400"
                      />
                      <button type="button" onClick={handleApplyPromo} disabled={promoLoading || !promoInput.trim()}
                        className="px-4 h-9 text-sm font-semibold text-white bg-brand-900 hover:bg-brand-800 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-colors">
                        {promoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Apply
                      </button>
                    </div>
                    {promoError && <p className="text-xs text-red-500 mt-1">{promoError}</p>}
                  </div>
                )}
              </div>
            )}

            {visaTerms.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-4 mb-4">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Terms &amp; Conditions</p>
                <div className="space-y-2.5">
                  {visaTerms.map((term, i) => (
                    <label key={term._id || i} className="flex items-start gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={!!termsAccepted[i]}
                        onChange={(e) => setTermsAccepted((prev) => ({ ...prev, [i]: e.target.checked }))}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 shrink-0" />
                      <span className="text-sm text-slate-700 group-hover:text-slate-900">
                        {term.text}
                        {term.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                    </label>
                  ))}
                </div>
                {showErrors && !allRequiredTermsAccepted && (
                  <p className="text-xs text-red-600 mt-3" role="alert">Please accept all required terms to continue.</p>
                )}
              </div>
            )}

            <p className="text-xs text-slate-500 mb-3">
              <strong className="text-slate-700">Pay by UPI or bank transfer.</strong> After you submit you&apos;ll see a UPI QR code and our bank details. Our team verifies the payment, then reviews your documents.
            </p>
            {submitButton('h-11')}
          </FormSection>
        </div>

        {/* Sticky sidebar: progress, price, submit */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-900">Your progress</p>
              <span className="text-xs text-slate-400 tabular-nums">{doneCount} of {sections.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 mb-3 overflow-hidden">
              <div className="h-full bg-gold-600 transition-all" style={{ width: `${(doneCount / sections.length) * 100}%` }} />
            </div>
            <ul className="space-y-1">
              {sections.map((sec) => (
                <li key={sec.id}>
                  <button type="button" onClick={() => scrollToSection(sec.id)}
                    className={`w-full flex items-center gap-2 text-left text-xs py-1 rounded hover:bg-slate-50 ${sec.done ? 'text-slate-700' : 'text-slate-400'}`}>
                    {sec.done ? <CircleCheck className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4" />}
                    {sec.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900 mb-2">Price summary</p>
            <div className="flex items-center gap-2 mb-3">
              <img src={`https://flagcdn.com/w20/${country.flag}.png`} alt="" className="w-5 h-3 object-cover rounded" />
              <p className="text-xs text-slate-500 truncate">{country.name} · {visa.name}</p>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">{adults} Adult{adults > 1 ? 's' : ''} × {formatCurrency(adultRate(visa))}</span><span className="tabular-nums">{formatCurrency(adults * adultRate(visa))}</span></div>
              {children > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">{children} Child{children > 1 ? 'ren' : ''} × {formatCurrency(childRate(visa))}</span><span className="tabular-nums">{formatCurrency(children * childRate(visa))}</span></div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-green-700 text-xs"><span>Promo ({promoResult?.code})</span><span>-{formatCurrency(discount)}</span></div>
              )}
              <div className="flex justify-between items-baseline border-t border-slate-100 pt-2 mt-2">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-xl font-bold text-brand-900 tabular-nums">{formatCurrency(finalTotal)}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {travelers.length} traveller{travelers.length > 1 ? 's' : ''} · GST {formatCurrency(gst)} included (on service fee)
                {r.corp && ' · corporate pricing'}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              {submitButton()}
              <Button type="button" variant="outline" className="w-full" onClick={saveDraftNow} disabled={savingDraft || submitting}>
                {savingDraft ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                Save draft
              </Button>
              {draftId && <p className="text-[11px] text-slate-400 text-center">Autosaves to My Applications every 20 seconds</p>}
            </div>
          </div>
        </aside>

        {/* Mobile: total and submit stay reachable */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400">{doneCount} of {sections.length} done · Total</p>
            <p className="text-lg font-bold text-brand-900 tabular-nums">{formatCurrency(finalTotal)}</p>
          </div>
          <Button onClick={trySubmit} disabled={submitting} className={`ml-auto ${allDone ? '' : 'opacity-60'}`}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit & Pay'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container max-w-6xl">
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

      <StartOverDialog
        open={showStartOver}
        onOpenChange={setShowStartOver}
        fromDraft={!!draftId}
        hasUploadedFiles={hasUploadedFiles}
        saving={savingDraft}
        onSave={saveAndStartOver}
        onDiscard={resetWizard}
      />

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
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? 'bg-green-500 text-white' : active ? 'bg-brand-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : n}
              </div>
              <span className={`text-xs font-medium hidden sm:block ml-1.5 mr-1 ${active ? 'text-brand-700' : done ? 'text-green-700' : 'text-slate-400'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${step > n ? 'bg-green-300' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </div>

      {step < 3 && (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                            <div className="absolute top-2 right-2 w-6 h-6 bg-brand-900 rounded-full flex items-center justify-center shadow">
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
              <CardGridSkeleton count={4} className="sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3" cardClassName="h-52" />
            ) : visaTypes.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                <Globe className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">No active visa types for {selectedCountry?.name}</p>
                <p className="text-xs mt-1">Contact us for assistance.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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

      </div>
      )}

      {step < 3 && (
        <div className="flex items-center justify-between mt-6">
          <Button variant="outline" onClick={goBack} disabled={step === 1 || submitting}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button onClick={goNext} disabled={!canProceed()}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Step 3: the whole application on one page ── */}
      {step === 3 && selectedVisa && selectedCountry && renderSinglePage(selectedVisa, selectedCountry)}
    </div>
  );
}
