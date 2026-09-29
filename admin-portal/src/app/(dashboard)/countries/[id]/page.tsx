'use client';
import { Fragment, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Loader2, X, Save, LayoutTemplate, Check, Copy, Eraser, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, GripVertical, Search as SearchIcon, ArrowUpDown, ArrowLeft, Globe, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { toast } from '@/components/ui/use-toast';
import { ApplicationFormBuilder } from '@/components/shared/application-form-builder';
import { TermsEditor } from '@/components/shared/terms-editor';
import { TermPresetPanel } from '@/components/shared/term-preset-panel';
import { AiGenerateButton } from '@/components/shared/ai-generate-button';
import { useStoredPrefs } from '@/lib/useStoredPrefs';
import {
  getCountry, updateCountry, deleteCountry, toggleCountry, toggleCountryWebsite,
  getVisaTypes, createVisaType, updateVisaType, deleteVisaType, toggleVisaType, reorderVisaTypes,
  getFormPresets, createFormPreset, deleteFormPreset, getVisaConfig,
} from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { orderedFormArrays } from '@/types';
import type { Country, VisaType, FormField, DocumentRequirement, EntryType, FormPreset, DocumentType, VisaConfigOption, VisaConfigCategory, VisaTerm } from '@/types';

/**
 * Names a duplicate: "Tourist Visa" → "Tourist Visa Copy", then "… Copy 2", "… Copy 3"
 * as those get taken. Copying a copy strips the old suffix first, so you never end up
 * with "Tourist Visa Copy Copy".
 */
const copyName = (source: string, existing: string[]): string => {
  const base = source.replace(/\s+copy(\s+\d+)?$/i, '').trim() || source.trim();
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${base} Copy` : `${base} Copy ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
};

/** Subdocument ids belong to the original, a duplicate gets fresh ones from Mongo. */
const withoutIds = <T extends { _id?: string }>(rows: T[]) => rows.map(({ _id, ...rest }) => rest);

const emptyField = (): FormField => ({ label: '', fieldName: '', type: 'text', required: false, options: [], placeholder: '', order: 0, applicantType: 'adult' });
const isOcrDocType = (t: string) => t === 'passport_front' || t === 'passport_back';
const emptyDocReq = (): DocumentRequirement => ({ name: '', description: '', required: true, applicantType: 'adult', docType: 'custom', ocrEnabled: false, order: 0 });

function TabButton({ step, label, active, onClick }: { step: number; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap flex-shrink-0 transition-colors ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}>
      <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold flex-shrink-0 transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {step}
      </span>
      {label}
    </button>
  );
}

// Pricing splits along the line that actually matters: visa and VFS fees are
// pass-through charges (same for everyone), while the service fee is our margin and
// varies by both traveler type and account type.
type PriceField =
  | 'adultPrice' | 'childPrice'
  | 'adultVfsFee' | 'childVfsFee'
  | 'adultServiceFee' | 'childServiceFee'
  | 'corporateAdultServiceFee' | 'corporateChildServiceFee';

const PASS_THROUGH_ROWS: { label: string; required?: boolean; fields: [PriceField, PriceField] }[] = [
  { label: 'Visa fee', required: true, fields: ['adultPrice', 'childPrice'] },
  { label: 'VFS fee', fields: ['adultVfsFee', 'childVfsFee'] },
];

// Shared label | Adult | Child column template, so all three pricing blocks line up.
const PRICE_GRID = 'grid grid-cols-[minmax(7rem,1fr)_minmax(6.5rem,9rem)_minmax(6.5rem,9rem)] gap-x-3 gap-y-2.5 items-center';

const SERVICE_FEE_ROWS: { label: string; hint?: string; fields: [PriceField, PriceField] }[] = [
  { label: 'Individual', fields: ['adultServiceFee', 'childServiceFee'] },
  { label: 'Corporate', hint: 'blank = same as individual', fields: ['corporateAdultServiceFee', 'corporateChildServiceFee'] },
];

// Dialog steps, in order. Any tab can be opened at any time; required fields are checked on save.
const TABS = ['info', 'pricing', 'form', 'terms', 'notes'] as const;
type TabKey = (typeof TABS)[number];
const TAB_LABELS: Record<TabKey, string> = {
  info: 'Information',
  pricing: 'Pricing',
  form: 'Form',
  notes: 'Additional Notes',
  terms: 'Terms',
};
// Which tab a given validation error lives on, so a failed save jumps to the right step.
const ERROR_TAB: Record<string, TabKey> = {
  name: 'info', processingTime: 'info', adultPrice: 'pricing',
};

const DEFAULT_LIST_PREFS = {
  filterCategory: '',
  filterStatus: '' as '' | 'active' | 'inactive',
  sortBy: 'custom' as 'custom' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'newest' | 'oldest',
};

const emptyForm = () => ({
  country: '', name: '', description: '',
  adultPrice: '', childPrice: '', adultVfsFee: '', childVfsFee: '', adultServiceFee: '', childServiceFee: '',
  corporateAdultServiceFee: '', corporateChildServiceFee: '',
  processingTime: '', validity: '',
  entry: [] as EntryType[],
  visaSubType: 'e-visa' as string,
  stayDuration: '',
  jurisdiction: 'pan-india' as string,
  visaCategory: 'tourist' as string,
  process: 'normal' as string,
  formFields: [] as FormField[],
  documentRequirements: [] as DocumentRequirement[],
  terms: [] as VisaTerm[],
  additionalNotes: '',
});

export default function CountryDetailPage() {
  const params = useParams();
  const countryId = params.id as string;
  const router = useRouter();

  const [country, setCountry] = useState<Country | null>(null);
  const [countryLoading, setCountryLoading] = useState(true);
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [visaTypesLoading, setVisaTypesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [listPrefs, updateListPrefs] = useStoredPrefs('admin:visa-types', DEFAULT_LIST_PREFS);
  const { filterCategory, filterStatus, sortBy } = listPrefs;
  // Drag-to-reorder state for the custom sort (see canReorder / moveVisaType below).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);

  // ── Country header (basic info edit + outer toggles) ──
  const [showCountryForm, setShowCountryForm] = useState(false);
  const [countryForm, setCountryForm] = useState({ name: '', flag: '', description: '' });
  const [savingCountry, setSavingCountry] = useState(false);
  const [togglingCountry, setTogglingCountry] = useState(false);
  const [togglingWeb, setTogglingWeb] = useState(false);
  const [deleteCountryOpen, setDeleteCountryOpen] = useState(false);

  // Form presets
  const [presets, setPresets] = useState<FormPreset[]>([]);
  const [applyPresetId, setApplyPresetId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  // Jurisdiction / category / sub-type / entry option lists, managed on the Visa Config page.
  const [configOptions, setConfigOptions] = useState<VisaConfigOption[]>([]);

  const loadVisaTypes = () =>
    getVisaTypes(countryId).then((r) => setVisaTypes(r.data.data)).finally(() => setVisaTypesLoading(false));

  useEffect(() => {
    getCountry(countryId)
      .then((r) => setCountry(r.data.data))
      .catch(() => setCountry(null))
      .finally(() => setCountryLoading(false));
    loadVisaTypes();
    getFormPresets().then((r) => setPresets(r.data.data)).catch(() => {});
    getVisaConfig().then((r) => setConfigOptions(r.data.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  // Deactivating a country cascades to every visa under it: none are shown to customers
  // regardless of their own status, so the per-visa toggles are locked here to make that clear.
  const countryInactive = !!country && !country.isActive;

  // Active options for a category, plus the currently-selected value even if it's since
  // been deactivated, so editing an older visa type never silently resets the field.
  const optionsFor = (category: VisaConfigCategory, currentValue?: string) => {
    const active = configOptions
      .filter((o) => o.category === category && o.isActive)
      .sort((a, b) => a.order - b.order);
    if (currentValue && !active.some((o) => o.value === currentValue)) {
      const stale = configOptions.find((o) => o.category === category && o.value === currentValue);
      if (stale) return [...active, { ...stale, label: `${stale.label} (inactive)` }];
    }
    return active;
  };

  const labelOf = (category: VisaConfigCategory, value?: string) =>
    configOptions.find((o) => o.category === category && o.value === value)?.label || value;

  // The visa type as it stands in the form right now, for the AI writer.
  const visaAiContext = (skip: 'description' | 'additionalNotes') => ({
    country: country?.name,
    visaName: form.name,
    ...(skip !== 'description' ? { description: form.description } : {}),
    ...(skip !== 'additionalNotes' ? { additionalNotes: form.additionalNotes } : {}),
    category: labelOf('visaCategory', form.visaCategory),
    type: labelOf('visaSubType', form.visaSubType),
    entry: form.entry.map((e) => labelOf('entryType', e)),
    jurisdiction: labelOf('jurisdiction', form.jurisdiction),
    processing: form.process === 'express' ? 'Express' : 'Normal',
    processingTime: form.processingTime,
    validity: form.validity,
    stayDuration: form.stayDuration,
    documentsRequired: form.documentRequirements.map((d) => d.name),
    termsApplicantAccepts: form.terms.map((t) => t.text),
  });

  // Hidden tabs skip native validation, so required fields are checked here on save.
  const validateInfo = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Visa name is required';
    if (!form.adultPrice) errs.adultPrice = 'Adult price is required';
    if (!form.processingTime.trim()) errs.processingTime = 'Processing time is required';
    return errs;
  };

  // Clears a field's error as soon as the admin edits it.
  const clearInfoError = (key: string) =>
    setInfoErrors((prev) => (prev[key] ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)) : prev));

  const tabIndex = TABS.indexOf(activeTab);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateInfo();
    const firstError = Object.keys(errs)[0];
    if (firstError) {
      setInfoErrors(errs);
      const errorTab = ERROR_TAB[firstError] || 'info';
      setActiveTab(errorTab);
      toast({ title: 'Fill in the required fields', description: `Check the highlighted fields under ${TAB_LABELS[errorTab]}.`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        country: countryId,
        adultPrice: Number(form.adultPrice),
        childPrice: Number(form.childPrice || 0),
        adultVfsFee: Number(form.adultVfsFee || 0),
        childVfsFee: Number(form.childVfsFee || 0),
        adultServiceFee: Number(form.adultServiceFee || 0),
        childServiceFee: Number(form.childServiceFee || 0),
        corporateAdultServiceFee: form.corporateAdultServiceFee === '' ? '' : Number(form.corporateAdultServiceFee),
        corporateChildServiceFee: form.corporateChildServiceFee === '' ? '' : Number(form.corporateChildServiceFee),
        ...orderedFormArrays(form.formFields, form.documentRequirements),
        terms: form.terms.filter((t) => t.text.trim()).map((t, i) => ({ ...t, text: t.text.trim(), order: i })),
      };
      if (editId) {
        await updateVisaType(editId, payload);
        toast({ title: 'Visa type updated', variant: 'success' });
      } else {
        await createVisaType(payload);
        toast({ title: 'Visa type created', variant: 'success' });
      }
      setShowForm(false);
      setEditId(null);
      loadVisaTypes();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Clones a visa type, pricing, form items, terms and all, under a "Copy" name, and
   * drops it directly below the original rather than at the end of the list.
   */
  const duplicateVisa = async (vt: VisaType) => {
    setDuplicating(vt._id);
    try {
      const { formFields, documentRequirements } = orderedFormArrays(vt.formFields || [], vt.documentRequirements || []);
      const res = await createVisaType({
        country: countryId,
        name: copyName(vt.name, visaTypes.map((v) => v.name)),
        description: vt.description || '',
        adultPrice: vt.adultPrice || vt.price || 0,
        childPrice: vt.childPrice || 0,
        adultVfsFee: vt.adultVfsFee || 0,
        childVfsFee: vt.childVfsFee || 0,
        adultServiceFee: vt.adultServiceFee || 0,
        childServiceFee: vt.childServiceFee || 0,
        // '' clears the override on the server; `undefined` would silently keep it unset anyway.
        corporateAdultServiceFee: vt.corporateAdultServiceFee ?? '',
        corporateChildServiceFee: vt.corporateChildServiceFee ?? '',
        processingTime: vt.processingTime,
        validity: vt.validity || '',
        entry: vt.entry || [],
        visaSubType: vt.visaSubType,
        stayDuration: vt.stayDuration || '',
        jurisdiction: vt.jurisdiction,
        visaCategory: vt.visaCategory,
        process: vt.process || 'normal',
        formFields: withoutIds(formFields),
        documentRequirements: withoutIds(documentRequirements),
        terms: withoutIds(vt.terms || []).map((t, i) => ({ ...t, order: i })),
        additionalNotes: vt.additionalNotes || '',
      });
      const created: VisaType = res.data.data;
      // Slot the copy in right after its source so the two sit together.
      const sequence = [...visaTypes]
        .sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || a.name.localeCompare(b.name))
        .map((v) => v._id);
      sequence.splice(sequence.indexOf(vt._id) + 1, 0, created._id);
      await reorderVisaTypes(sequence).catch(() => {});
      toast({ title: `Duplicated as "${created.name}"`, description: 'Edit it to change the details.', variant: 'success' });
      loadVisaTypes();
    } catch (err: any) {
      toast({ title: 'Could not duplicate this visa type', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setDuplicating(null);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteVisaType(id);
    toast({ title: 'Moved to Trash', description: 'Restore it anytime from the Trash page.' });
    loadVisaTypes();
  };

  const handleToggle = async (id: string) => {
    setToggling(id);
    try {
      const res = await toggleVisaType(id);
      setVisaTypes((prev) => prev.map((vt) => vt._id === id ? { ...vt, isActive: res.data.data.isActive } : vt));
      toast({ title: res.data.data.isActive ? 'Visa type activated' : 'Visa type deactivated', variant: 'success' });
    } catch {
      toast({ title: 'Failed to toggle status', variant: 'destructive' });
    } finally {
      setToggling(null);
    }
  };

  // ── Country header actions ──
  const startCountryEdit = () => {
    if (!country) return;
    setCountryForm({ name: country.name, flag: country.flag, description: country.description });
    setShowCountryForm(true);
  };

  const handleCountrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCountry(true);
    try {
      const res = await updateCountry(countryId, countryForm);
      setCountry(res.data.data);
      toast({ title: 'Country updated', variant: 'success' });
      setShowCountryForm(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSavingCountry(false);
    }
  };

  const handleToggleCountry = async () => {
    setTogglingCountry(true);
    try {
      const res = await toggleCountry(countryId);
      setCountry((c) => c ? { ...c, isActive: res.data.data.isActive } : c);
      toast({ title: res.data.data.isActive ? 'Country activated' : 'Country deactivated', variant: 'success' });
    } catch {
      toast({ title: 'Failed to toggle status', variant: 'destructive' });
    } finally {
      setTogglingCountry(false);
    }
  };

  const handleToggleWeb = async () => {
    setTogglingWeb(true);
    try {
      const res = await toggleCountryWebsite(countryId);
      setCountry((c) => c ? { ...c, showOnWebsite: res.data.data.showOnWebsite } : c);
      toast({ title: res.data.data.showOnWebsite ? 'Shown on website' : 'Hidden from website', variant: 'success' });
    } catch {
      toast({ title: 'Failed to toggle website visibility', variant: 'destructive' });
    } finally {
      setTogglingWeb(false);
    }
  };

  const handleDeleteCountry = async () => {
    await deleteCountry(countryId);
    toast({ title: 'Moved to Trash', description: 'Restore it anytime from the Trash page.' });
    router.push('/countries');
  };

  const setTerms = (terms: VisaTerm[]) => setForm((f) => ({ ...f, terms }));

  // ── Form Presets ──
  const reloadPresets = () => getFormPresets().then((r) => setPresets(r.data.data)).catch(() => {});

  const applyPreset = () => {
    const preset = presets.find((p) => p._id === applyPresetId);
    if (!preset) return;
    // Run the preset through the same normaliser used on save, so a preset stored
    // before fields and documents shared one sequence lands in a coherent order
    // rather than carrying stale positions into this visa type.
    const normalized = orderedFormArrays(
      (preset.formFields || []).map((ff) => ({ ...ff, options: [...(ff.options || [])] })),
      (preset.documentRequirements || []).map((d) => ({ ...d })),
    );
    setForm((f) => ({ ...f, ...normalized }));
    const total = normalized.formFields.length + normalized.documentRequirements.length;
    toast({
      title: `Applied preset "${preset.name}"`,
      description: `${total} item${total === 1 ? '' : 's'} loaded: ${normalized.formFields.length} field(s), ${normalized.documentRequirements.length} document(s).`,
      variant: 'success',
    });
  };

  const saveAsPreset = async () => {
    const name = presetName.trim();
    if (!name) { toast({ title: 'Enter a preset name', variant: 'destructive' }); return; }
    if (form.formFields.length === 0 && form.documentRequirements.length === 0) {
      toast({ title: 'Add some fields first', variant: 'destructive' }); return;
    }
    setSavingPreset(true);
    try {
      await createFormPreset({
        name,
        ...orderedFormArrays(form.formFields, form.documentRequirements),
      });
      toast({ title: `Preset "${name}" saved`, variant: 'success' });
      setPresetName('');
      reloadPresets();
    } catch (err: any) {
      toast({ title: 'Failed to save preset', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeletePreset = async (id: string) => {
    await deleteFormPreset(id);
    if (applyPresetId === id) setApplyPresetId('');
    toast({ title: 'Moved to Trash' });
    reloadPresets();
  };

  // Clicking the chip's "x" only clears the current selection, it never deletes the
  // saved preset. Deleting is a separate, deliberate action via the trash icon.
  const deselectPreset = (id: string) => {
    if (applyPresetId === id) setApplyPresetId('');
  };

  const duplicatePreset = async (p: FormPreset) => {
    try {
      await createFormPreset({
        name: `${p.name} (Copy)`,
        description: p.description,
        ...orderedFormArrays(p.formFields || [], p.documentRequirements || []),
      });
      toast({ title: `Duplicated "${p.name}"`, variant: 'success' });
      reloadPresets();
    } catch (err: any) {
      toast({ title: 'Failed to duplicate preset', description: err.response?.data?.message, variant: 'destructive' });
    }
  };

  // Clears only the Fields/Documents sections of the current form, does not touch any saved preset.
  const clearFormFields = () => {
    setForm((f) => ({ ...f, formFields: [], documentRequirements: [] }));
    setApplyPresetId('');
  };

  const openCreate = () => {
    // Country is fixed to the page's country, pre-select it so it's never asked for.
    setForm({ ...emptyForm(), country: countryId });
    setEditId(null);
    setApplyPresetId('');
    setPresetName('');
    setActiveTab('info');
    setInfoErrors({});
    setShowForm(true);
  };

  const startEdit = (vt: VisaType) => {
    setForm({
      country: countryId,
      name: vt.name,
      description: vt.description,
      adultPrice: String(vt.adultPrice || vt.price || ''),
      childPrice: vt.childPrice ? String(vt.childPrice) : '',
      adultVfsFee: vt.adultVfsFee ? String(vt.adultVfsFee) : '',
      childVfsFee: vt.childVfsFee ? String(vt.childVfsFee) : '',
      adultServiceFee: vt.adultServiceFee ? String(vt.adultServiceFee) : '',
      childServiceFee: vt.childServiceFee ? String(vt.childServiceFee) : '',
      corporateAdultServiceFee: vt.corporateAdultServiceFee != null ? String(vt.corporateAdultServiceFee) : '',
      corporateChildServiceFee: vt.corporateChildServiceFee != null ? String(vt.corporateChildServiceFee) : '',
      processingTime: vt.processingTime || '',
      validity: vt.validity || '',
      entry: vt.entry?.length ? [vt.entry[0]] : [],
      visaSubType: vt.visaSubType || 'e-visa',
      stayDuration: String(vt.stayDuration || ''),
      jurisdiction: vt.jurisdiction || 'pan-india',
      visaCategory: vt.visaCategory || 'tourist',
      process: vt.process || 'normal',
      formFields: (vt.formFields || []).map((f) => ({ ...f })),
      documentRequirements: (vt.documentRequirements || []).map((d) => ({ ...d })),
      terms: (vt.terms || []).map((t) => ({ ...t })),
      additionalNotes: vt.additionalNotes || '',
    });
    setEditId(vt._id);
    setActiveTab('info');
    setInfoErrors({});
    setShowForm(true);
  };

  // GST is 18% of the service fee only, visa and VFS fees are never taxed. Matches checkout.
  const GST_RATE = 0.18;
  const num = (s: string) => Number(s || 0);
  const gstOnFee = (fee: number) => Math.round(fee * GST_RATE);
  // Live "customer pays" preview for the pricing card. Visa + VFS are shared by both
  // account types; only the service fee differs (and is the sole GST-taxed component), and
  // a blank corporate service fee falls back to the individual one, same rule as backend.
  const corpOrStd = (corp: string, std: string) => (corp !== '' ? num(corp) : num(std));
  const passThroughAdult = num(form.adultPrice) + num(form.adultVfsFee);
  const passThroughChild = num(form.childPrice) + num(form.childVfsFee);
  const corpAdultFee = corpOrStd(form.corporateAdultServiceFee, form.adultServiceFee);
  const corpChildFee = corpOrStd(form.corporateChildServiceFee, form.childServiceFee);
  // Customer-pays totals = pass-through charges + service fee + GST on that service fee.
  const subIndivAdult = passThroughAdult + num(form.adultServiceFee) + gstOnFee(num(form.adultServiceFee));
  const subIndivChild = passThroughChild + num(form.childServiceFee) + gstOnFee(num(form.childServiceFee));
  const subCorpAdult = passThroughAdult + corpAdultFee + gstOnFee(corpAdultFee);
  const subCorpChild = passThroughChild + corpChildFee + gstOnFee(corpChildFee);
  const corpFeeDiffers = form.corporateAdultServiceFee !== '' || form.corporateChildServiceFee !== '';

  // Plain function (not a component) so React keeps the same input instances between
  // renders, a nested component here would remount and steal focus on every keystroke.
  const priceInput = (name: PriceField, placeholder = '0') => (
    <div key={name} className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₹</span>
      <Input
        type="number"
        min="0"
        className={`pl-7 pr-3 text-right tabular-nums ${name === 'adultPrice' && infoErrors.adultPrice ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        placeholder={placeholder}
        value={form[name]}
        onChange={(e) => { setForm({ ...form, [name]: e.target.value }); if (name === 'adultPrice') clearInfoError('adultPrice'); }}
      />
    </div>
  );

  // Charged total = visa + VFS + service fee + GST (18% of the service fee only).
  const stdAdultTotal = (vt: VisaType) => (vt.adultPrice || vt.price) + (vt.adultVfsFee || 0) + (vt.adultServiceFee || 0) + gstOnFee(vt.adultServiceFee || 0);
  const stdChildTotal = (vt: VisaType) => (vt.childPrice || 0) + (vt.childVfsFee || 0) + (vt.childServiceFee || 0) + gstOnFee(vt.childServiceFee || 0);
  // Corporate differs from standard only by the service fee component (and its GST).
  const corpAdultTotal = (vt: VisaType) => { const fee = vt.corporateAdultServiceFee ?? vt.adultServiceFee ?? 0; return (vt.adultPrice || vt.price) + (vt.adultVfsFee || 0) + fee + gstOnFee(fee); };
  const corpChildTotal = (vt: VisaType) => { const fee = vt.corporateChildServiceFee ?? vt.childServiceFee ?? 0; return (vt.childPrice || 0) + (vt.childVfsFee || 0) + fee + gstOnFee(fee); };

  const displayedVisaTypes = visaTypes
    .filter((vt) => {
      if (search && !vt.name.toLowerCase().includes(search.toLowerCase()) && !(vt.description || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && vt.visaCategory !== filterCategory) return false;
      if (filterStatus === 'active' && !vt.isActive) return false;
      if (filterStatus === 'inactive' && vt.isActive) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'price-asc': return stdAdultTotal(a) - stdAdultTotal(b);
        case 'price-desc': return stdAdultTotal(b) - stdAdultTotal(a);
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name-asc': return a.name.localeCompare(b.name);
        // Custom: the admin's arranged sequence. Name breaks ties, so visa types saved
        // before ordering existed (all at 0) still read alphabetically until dragged.
        default: return ((a.order ?? 0) - (b.order ?? 0)) || a.name.localeCompare(b.name);
      }
    });

  // Reordering a filtered or differently-sorted view would write positions the admin
  // can't see, so the handles only appear on the full list in custom order.
  const canReorder = sortBy === 'custom' && !search && !filterCategory && !filterStatus;

  const { pageItems: visaPage, paginationProps: visaPagination } = usePagination(
    displayedVisaTypes, 'visa-types', `${search}|${filterCategory}|${filterStatus}|${sortBy}`,
  );
  const visaOffset = visaPagination.pageSize ? (visaPagination.page - 1) * visaPagination.pageSize : 0;

  const moveVisaType = async (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= displayedVisaTypes.length) return;
    const next = [...displayedVisaTypes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const previous = visaTypes;
    setVisaTypes(next.map((vt, i) => ({ ...vt, order: i })));
    try {
      await reorderVisaTypes(next.map((vt) => vt._id));
    } catch {
      setVisaTypes(previous);
      toast({ title: 'Could not save the new order', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <Link href="/countries" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Countries
      </Link>

      {/* ── Country header, outer active/website toggles + basic-info edit + delete ── */}
      <Card className={`mb-6 ${countryInactive ? 'border-warning/40' : ''}`}>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              {countryLoading
                ? <Skeleton className="w-14 h-10 rounded flex-shrink-0" />
                : country && <img src={`https://flagcdn.com/w80/${country.flag}.png`} alt={country.name} className="w-14 h-10 object-cover rounded shadow-sm flex-shrink-0" />}
              <div className="min-w-0">
                {countryLoading
                  ? <Skeleton className="h-6 w-44" />
                  : <h1 className="text-xl font-bold text-foreground truncate">{country?.name}</h1>}
                {countryLoading
                  ? <Skeleton className="h-4 w-64 mt-1.5" />
                  : country?.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{country.description}</p>}
                <div className="flex items-center gap-1 mt-3">
                  <button onClick={startCountryEdit} title="Edit basic info" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <Link href={`/countries/${countryId}/content`} title="Edit website content">
                    <span className="p-1.5 text-muted-foreground hover:text-violet-600 hover:bg-violet-500/10 rounded-lg transition-colors flex items-center">
                      <FileText className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                  <button onClick={() => setDeleteCountryOpen(true)} title="Move country to trash" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:min-w-[190px] sm:border-l sm:border-border sm:pl-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    {country?.isActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${country?.isActive ? 'bg-success' : 'bg-muted-foreground/40'}`}></span>
                  </span>
                  <span className={`text-xs font-semibold ${country?.isActive ? 'text-success' : 'text-muted-foreground'}`}>
                    {country?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <Switch checked={!!country?.isActive} onChange={handleToggleCountry} disabled={togglingCountry || !country} tone="success" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Globe className={`w-3 h-3 ${country?.showOnWebsite ? 'text-violet-500' : 'text-muted-foreground/40'}`} />
                  <span className={`text-xs font-semibold ${country?.showOnWebsite ? 'text-violet-600' : 'text-muted-foreground'}`}>
                    {country?.showOnWebsite ? 'On Website' : 'Hidden'}
                  </span>
                </div>
                <Switch checked={!!country?.showOnWebsite} onChange={handleToggleWeb} disabled={togglingWeb || !country} tone="violet" />
              </div>
            </div>
          </div>

          {showCountryForm && (
            <form onSubmit={handleCountrySubmit} className="mt-5 pt-5 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Country Name</Label>
                <Input className="mt-1" placeholder="e.g. Canada" value={countryForm.name} onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })} required />
              </div>
              <div>
                <Label>Flag Code (ISO 2-letter)</Label>
                <Input className="mt-1" placeholder="e.g. ca, us, gb" value={countryForm.flag} onChange={(e) => setCountryForm({ ...countryForm, flag: e.target.value.toLowerCase() })} required />
              </div>
              <div>
                <Label>Description</Label>
                <div className="relative mt-1">
                  <Input className="pr-12" placeholder="Short description" value={countryForm.description} onChange={(e) => setCountryForm({ ...countryForm, description: e.target.value })} />
                  <AiGenerateButton
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                    purpose="country.description"
                    value={countryForm.description}
                    onChange={(text) => setCountryForm((f) => ({ ...f, description: text }))}
                    getContext={() => ({ country: countryForm.name })}
                    countryId={countryId}
                  />
                </div>
              </div>
              <div className="sm:col-span-3 flex gap-2">
                <Button type="submit" disabled={savingCountry}>
                  {savingCountry ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCountryForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {countryInactive && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-warning-foreground flex-shrink-0">!</span>
          <p className="text-sm text-foreground/80">
            This country is <span className="font-semibold">deactivated</span>. All of its visa types are hidden from customers regardless of their own status. Reactivate the country to manage individual visa visibility.
          </p>
        </div>
      )}

      <PageHeader
        title="Visa Types"
        description="Manage this country's visa types, per-traveler pricing, and dynamic form fields."
        action={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Visa Type
          </Button>
        }
      />

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col gap-0">
          <DialogHeader className="border-b border-border pb-0 flex-shrink-0">
            <DialogTitle>{editId ? 'Edit Visa Type' : 'Create Visa Type'}</DialogTitle>
            <div className="flex gap-1 -mb-px overflow-x-auto">
              {TABS.map((tab, i) => (
                <TabButton key={tab} step={i + 1} label={TAB_LABELS[tab]} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
              ))}
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              <div className={activeTab === 'info' ? 'space-y-6' : 'hidden'}>
              {/* ── Basic Info ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Country</Label>
                  {/* Fixed to this page's country, shown read-only rather than as a picker. */}
                  <div className="mt-1 h-10 px-3 flex items-center gap-2 rounded-lg border border-input bg-muted/40 text-sm text-foreground">
                    {country && <img src={`https://flagcdn.com/w20/${country.flag}.png`} alt="" className="w-5 h-3 object-cover rounded" />}
                    <span className="truncate">{country?.name || '-'}</span>
                  </div>
                </div>
                <div>
                  <Label>Visa Name</Label>
                  <Input className={`mt-1 ${infoErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`} placeholder="e.g. 14 Days Single Tourist" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); clearInfoError('name'); }} required />
                  {infoErrors.name && <p className="text-xs text-destructive mt-1">{infoErrors.name}</p>}
                </div>
                <div>
                  <Label>Description</Label>
                  <div className="relative mt-1">
                    <Input className="pr-12" placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    <AiGenerateButton
                      className="absolute right-1.5 top-1/2 -translate-y-1/2"
                      purpose="visaType.description"
                      value={form.description}
                      onChange={(text) => setForm((f) => ({ ...f, description: text }))}
                      getContext={() => visaAiContext('description')}
                    />
                  </div>
                </div>
              </div>

              {/* ── Visa Details ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Stay Duration</Label>
                  <Input className="mt-1" type="text" placeholder="e.g. 14 Days" value={form.stayDuration} onChange={(e) => setForm({ ...form, stayDuration: e.target.value })} />
                </div>
                <div>
                  <Label>Processing Time</Label>
                  <Input className={`mt-1 ${infoErrors.processingTime ? 'border-destructive focus-visible:ring-destructive' : ''}`} type="text" placeholder="e.g. 2 Working Days" value={form.processingTime} onChange={(e) => { setForm({ ...form, processingTime: e.target.value }); clearInfoError('processingTime'); }} required />
                  {infoErrors.processingTime && <p className="text-xs text-destructive mt-1">{infoErrors.processingTime}</p>}
                </div>
                <div>
                  <Label>Validity</Label>
                  <Input className="mt-1" placeholder="e.g. 90 Days, 1 year" value={form.validity} onChange={(e) => setForm({ ...form, validity: e.target.value })} />
                </div>

                <div>
                  <Label>Visa Type</Label>
                  <select value={form.visaSubType} onChange={(e) => setForm({ ...form, visaSubType: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {optionsFor('visaSubType', form.visaSubType).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <Label>Entry</Label>
                  <select value={form.entry[0] || ''} onChange={(e) => setForm({ ...form, entry: e.target.value ? [e.target.value as EntryType] : [] })}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Select entry…</option>
                    {optionsFor('entryType', form.entry[0]).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <Label>Process</Label>
                  <label className="mt-1 flex gap-2 h-10 items-center cursor-pointer">
                    <input type="checkbox" checked={form.process === 'express'} onChange={(e) => setForm({ ...form, process: e.target.checked ? 'express' : 'normal' })} className="rounded text-primary focus:ring-ring" />
                    <span className="text-sm text-foreground/90">Express processing <span className="text-xs text-muted-foreground">(unchecked = Normal)</span></span>
                  </label>
                </div>

                <div>
                  <Label>Jurisdiction</Label>
                  <select value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {optionsFor('jurisdiction', form.jurisdiction).map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
                  </select>
                </div>

                <div>
                  <Label>Visa Category</Label>
                  <select value={form.visaCategory} onChange={(e) => setForm({ ...form, visaCategory: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {optionsFor('visaCategory', form.visaCategory).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              </div>

              {/* ── Step 2: Pricing ──
                  Split by who the charge belongs to: visa + VFS are pass-through and
                  identical for everyone, so they're entered once; the service fee is our
                  margin and gets its own individual/corporate grid. ── */}
              <div className={activeTab === 'pricing' ? '' : 'hidden'}>
                <div className="rounded-xl border border-border overflow-hidden max-w-2xl">
                  <div className="px-5 py-3.5 bg-muted/40 border-b border-border">
                    <p className="text-sm font-semibold text-foreground">Pricing</p>
                    <p className="text-xs text-muted-foreground mt-0.5">All fees are per traveler. 18% GST applies to the service fee only.</p>
                  </div>

                  <div className="p-5 space-y-6">
                    {/* Pass-through charges, one set of values, everyone pays them */}
                    <div>
                      <div className="flex items-baseline justify-between gap-3 mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Government &amp; VFS charges</p>
                        <p className="text-xs text-muted-foreground">Same for individual &amp; corporate</p>
                      </div>
                      <div className={PRICE_GRID}>
                        <span />
                        <span className="text-xs font-semibold text-muted-foreground text-right pr-3">Adult</span>
                        <span className="text-xs font-semibold text-muted-foreground text-right pr-3">Child</span>

                        {PASS_THROUGH_ROWS.map((row) => (
                          <Fragment key={row.label}>
                            <span className="text-sm text-foreground">
                              {row.label}
                              {row.required && <span className="text-destructive ml-0.5">*</span>}
                            </span>
                            {row.fields.map((name) => priceInput(name))}
                          </Fragment>
                        ))}
                      </div>
                      {infoErrors.adultPrice && <p className="text-xs text-destructive mt-2">{infoErrors.adultPrice}</p>}
                    </div>

                    {/* Service fee, the only component that varies by account type */}
                    <div className="pt-5 border-t border-border">
                      <div className="flex items-baseline justify-between gap-3 mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service fee</p>
                        <p className="text-xs text-muted-foreground">Optional. Enter 0 to waive</p>
                      </div>
                      <div className={PRICE_GRID}>
                        <span />
                        <span className="text-xs font-semibold text-muted-foreground text-right pr-3">Adult</span>
                        <span className="text-xs font-semibold text-muted-foreground text-right pr-3">Child</span>

                        {SERVICE_FEE_ROWS.map((row, rowIdx) => (
                          <Fragment key={row.label}>
                            <span className="text-sm text-foreground">
                              {row.label}
                              {row.hint && <span className="block text-xs text-muted-foreground">{row.hint}</span>}
                            </span>
                            {row.fields.map((name, i) => priceInput(
                              name,
                              // Corporate inputs preview the individual fee they'd inherit.
                              rowIdx === 1 ? (form[SERVICE_FEE_ROWS[0].fields[i]] || '0') : '0',
                            ))}
                          </Fragment>
                        ))}
                      </div>
                    </div>

                    {/* What each account type ends up paying */}
                    <div className="pt-5 border-t border-border">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Customer pays <span className="font-normal normal-case tracking-normal">(incl. 18% GST)</span></p>
                      <div className={PRICE_GRID}>
                        <span />
                        <span className="text-xs font-semibold text-muted-foreground text-right pr-3">Adult</span>
                        <span className="text-xs font-semibold text-muted-foreground text-right pr-3">Child</span>

                        <span className="text-sm text-foreground">Individual</span>
                        <span className="text-sm font-bold text-primary text-right pr-3 tabular-nums">{subIndivAdult > 0 ? formatCurrency(subIndivAdult) : '-'}</span>
                        <span className="text-sm font-bold text-primary text-right pr-3 tabular-nums">{subIndivChild > 0 ? formatCurrency(subIndivChild) : '-'}</span>

                        <span className="text-sm text-foreground flex items-center gap-1.5">
                          Corporate
                          {corpFeeDiffers && <span className="w-1.5 h-1.5 rounded-full bg-warning" title="A corporate service fee is set" />}
                        </span>
                        <span className={`text-sm font-bold text-right pr-3 tabular-nums ${corpFeeDiffers ? 'text-warning' : 'text-primary'}`}>{subCorpAdult > 0 ? formatCurrency(subCorpAdult) : '-'}</span>
                        <span className={`text-sm font-bold text-right pr-3 tabular-nums ${corpFeeDiffers ? 'text-warning' : 'text-primary'}`}>{subCorpChild > 0 ? formatCurrency(subCorpChild) : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={activeTab === 'form' ? 'space-y-6' : 'hidden'}>
              {/* ── Form Presets ── */}
              <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/15 space-y-3">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-violet-600" />
                  <p className="text-sm font-semibold text-violet-600">Form Presets</p>
                </div>
                <p className="text-xs text-violet-600/70">Apply a saved application form in one click, or save the current one as a reusable preset.</p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select value={applyPresetId} onChange={(e) => setApplyPresetId(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-violet-500/20 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-violet-500 flex-1">
                    <option value="">Select a preset to apply…</option>
                    {presets.map((p) => { const n = (p.formFields?.length || 0) + (p.documentRequirements?.length || 0); return <option key={p._id} value={p._id}>{p.name} ({n} item{n === 1 ? '' : 's'})</option>; })}
                  </select>
                  <Button type="button" variant="outline" disabled={!applyPresetId} onClick={applyPreset}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Apply Preset
                  </Button>
                  <Button type="button" variant="outline" onClick={clearFormFields} title="Clear the current fields & documents (does not delete any saved preset)">
                    <Eraser className="w-3.5 h-3.5 mr-1" /> Clear Form
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Input className="h-9 flex-1" placeholder="New preset name (saves current fields & docs)" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
                  <Button type="button" variant="outline" disabled={savingPreset} onClick={saveAsPreset}>
                    {savingPreset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1" /> Save as Preset</>}
                  </Button>
                </div>

                {presets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {presets.map((p) => (
                      <span key={p._id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card border text-xs font-medium ${applyPresetId === p._id ? 'border-violet-400 text-violet-700 ring-1 ring-violet-500/20' : 'border-violet-500/20 text-violet-600'}`}>
                        {p.name}
                        <button type="button" title="Duplicate preset" onClick={() => duplicatePreset(p)} className="text-violet-400/60 hover:text-violet-600 ml-0.5"><Copy className="w-3 h-3" /></button>
                        <button type="button" title="Delete preset (moves to Trash)" onClick={() => setDeletePresetId(p._id)} className="text-violet-400/60 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                        {applyPresetId === p._id && (
                          <button type="button" title="Deselect" onClick={() => deselectPreset(p._id)} className="text-violet-400/60 hover:text-violet-700"><X className="w-3 h-3" /></button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <ApplicationFormBuilder
                fields={form.formFields}
                docs={form.documentRequirements}
                onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              />
              </div>

              <div className={activeTab === 'notes' ? 'space-y-2' : 'hidden'}>
                <Label>Additional Notes</Label>
                <div className="relative mt-1">
                  <textarea
                    className="w-full min-h-[240px] rounded-lg border border-input bg-card text-foreground text-sm p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                    placeholder="Anything worth telling the applicant about this visa…"
                    value={form.additionalNotes}
                    onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })}
                  />
                  <AiGenerateButton
                    className="absolute right-2 top-2"
                    purpose="visaType.additionalNotes"
                    value={form.additionalNotes}
                    onChange={(text) => setForm((f) => ({ ...f, additionalNotes: text }))}
                    getContext={() => visaAiContext('additionalNotes')}
                  />
                </div>
                <p className="text-xs text-muted-foreground">The AI button uses the details, documents and terms entered in the other tabs, so fill those in first.</p>
              </div>

              <div className={activeTab === 'terms' ? 'space-y-5' : 'hidden'}>
                <TermPresetPanel terms={form.terms} onChange={setTerms} />
                <TermsEditor terms={form.terms} onChange={setTerms} />
              </div>

            </div>

            <div className="flex items-center gap-2 px-6 py-4 border-t border-border flex-shrink-0">
              {tabIndex > 0 && (
                <Button type="button" variant="outline" onClick={() => setActiveTab(TABS[tabIndex - 1])}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
                {tabIndex < TABS.length - 1 && (
                  <Button type="button" variant="outline" onClick={() => setActiveTab(TABS[tabIndex + 1])}>
                    {TAB_LABELS[TABS[tabIndex + 1]]} <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? 'Update Visa Type' : 'Create Visa Type'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters + sorting */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search visa types..."
            className="pl-9 h-9 w-56"
          />
        </div>
        <select value={filterCategory} onChange={(e) => updateListPrefs({ filterCategory: e.target.value })} className="h-9 px-3 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">All Categories</option>
          {optionsFor('visaCategory').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => updateListPrefs({ filterStatus: e.target.value as typeof filterStatus })} className="h-9 px-3 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <select value={sortBy} onChange={(e) => updateListPrefs({ sortBy: e.target.value as typeof sortBy })} className="h-9 px-3 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="custom">Custom order (drag)</option>
            <option value="name-asc">Name (A–Z)</option>
            <option value="name-desc">Name (Z–A)</option>
            <option value="price-asc">Price (low to high)</option>
            <option value="price-desc">Price (high to low)</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        {(search || filterCategory || filterStatus) && (
          <button
            onClick={() => { setSearch(''); updateListPrefs({ filterCategory: '', filterStatus: '' }); }}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {sortBy === 'custom' && !visaTypesLoading && visaTypes.length > 1 && (
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5" />
          {canReorder
            ? 'Drag a row to arrange the order applicants see. #1 is shown first.'
            : 'Clear the search and filters to rearrange the order.'}
        </p>
      )}

      <div className="bg-card rounded-2xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/40">
              {['#', 'Visa Type', 'Adult ₹', 'Child ₹', 'Corporate (A / C)', 'Process', 'Time', 'Entry', 'Category', 'Status', ''].map((h) => (
                <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visaTypesLoading ? (
              <TableSkeleton rows={5} cols={10} />
            ) : displayedVisaTypes.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                {visaTypes.length === 0 ? 'No visa types yet. Add one to get started.' : 'No visa types match the current filters.'}
              </TableCell></TableRow>
            ) : (
              visaPage.map((vt, pageIndex) => {
                const i = visaOffset + pageIndex;
                // A visa is effectively hidden from customers if the country is off,
                // even when its own toggle is on, reflect that here.
                const effectivelyOff = countryInactive || !vt.isActive;
                const isDropTarget = canReorder && !!dragId && dropId === vt._id && dragId !== vt._id;
                return (
                <TableRow
                  key={vt._id}
                  className={`${effectivelyOff ? 'opacity-60' : ''} ${dragId === vt._id ? 'opacity-40' : ''} ${isDropTarget ? 'bg-primary/5 outline outline-2 -outline-offset-2 outline-dashed outline-primary' : ''}`}
                  onDragOver={canReorder && dragId ? (e) => { e.preventDefault(); setDropId(vt._id); } : undefined}
                  onDrop={canReorder && dragId ? (e) => {
                    e.preventDefault();
                    moveVisaType(displayedVisaTypes.findIndex((v) => v._id === dragId), i);
                    setDragId(null); setDropId(null);
                  } : undefined}
                >
                  <TableCell className="pr-0">
                    <div className="flex items-center gap-1.5">
                      {canReorder ? (
                        <span
                          draggable
                          onDragStart={() => setDragId(vt._id)}
                          onDragEnd={() => { setDragId(null); setDropId(null); }}
                          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="w-4" />
                      )}
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-foreground">{vt.name}</p>
                    {vt.description && <p className="text-xs text-muted-foreground">{vt.description}</p>}
                    {vt.visaSubType && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {configOptions.find((o) => o.category === 'visaSubType' && o.value === vt.visaSubType)?.label || vt.visaSubType}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-primary" title="Visa + VFS + service fee, incl. 18% GST">
                    {formatCurrency(stdAdultTotal(vt))}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs" title="Visa + VFS + service fee, incl. 18% GST">
                    {vt.childPrice ? formatCurrency(stdChildTotal(vt)) : '-'}
                  </TableCell>
                  {/* Corporate differs only when a corporate service fee is set, otherwise
                      it matches the standard total, so it's shown muted. */}
                  <TableCell className="text-xs" title="Visa + VFS + corporate service fee, incl. 18% GST">
                    <span className={vt.corporateAdultServiceFee != null ? 'text-warning font-semibold' : 'text-muted-foreground/50'}>
                      {formatCurrency(corpAdultTotal(vt))}
                    </span>
                    <span className="text-muted-foreground/50"> / </span>
                    <span className={vt.corporateChildServiceFee != null ? 'text-warning font-semibold' : 'text-muted-foreground/50'}>
                      {vt.childPrice ? formatCurrency(corpChildTotal(vt)) : '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${vt.process === 'express' ? 'text-destructive bg-destructive/10' : 'text-muted-foreground bg-muted'}`}>
                      {vt.process || 'normal'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{vt.processingTime}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(vt.entry || []).map((e) => (
                        <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium capitalize">{e}</span>
                      ))}
                      {(!vt.entry || vt.entry.length === 0) && <span className="text-muted-foreground/50 text-xs">-</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs capitalize text-foreground/80">{vt.visaCategory || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Switch
                        checked={vt.isActive && !countryInactive}
                        onChange={() => handleToggle(vt._id)}
                        disabled={toggling === vt._id || countryInactive}
                        title={countryInactive ? 'Reactivate the country to manage visa visibility' : undefined}
                      />
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                          {vt.isActive && !countryInactive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>}
                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${vt.isActive && !countryInactive ? 'bg-success' : 'bg-muted-foreground/40'}`}></span>
                        </span>
                        <span className={`text-xs font-semibold ${vt.isActive && !countryInactive ? 'text-success' : 'text-muted-foreground'}`}>
                          {countryInactive ? 'Country off' : vt.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {/* Keyboard-reachable equivalent of dragging the handle. */}
                      {canReorder && (
                        <>
                          <button onClick={() => moveVisaType(i, i - 1)} disabled={i === 0} title="Move up" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"><ChevronUp className="w-3.5 h-3.5" /></button>
                          <button onClick={() => moveVisaType(i, i + 1)} disabled={i === displayedVisaTypes.length - 1} title="Move down" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"><ChevronDown className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      <button onClick={() => startEdit(vt)} title="Edit" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                      <button
                        onClick={() => duplicateVisa(vt)}
                        disabled={duplicating === vt._id}
                        title="Duplicate this visa type"
                        className="p-1.5 text-muted-foreground hover:text-violet-600 hover:bg-violet-500/10 rounded-lg disabled:opacity-50"
                      >
                        {duplicating === vt._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setDeleteId(vt._id)} title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <Pagination {...visaPagination} className="border-t border-border" />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Move this visa type to Trash?"
        description="You can restore it later from the Trash page."
        confirmLabel="Move to Trash"
        onConfirm={async () => { if (deleteId) await handleDelete(deleteId); }}
      />
      <ConfirmDialog
        open={!!deletePresetId}
        onOpenChange={(open) => !open && setDeletePresetId(null)}
        title="Move this preset to Trash?"
        description="You can restore it later from the Trash page."
        confirmLabel="Move to Trash"
        onConfirm={async () => { if (deletePresetId) await handleDeletePreset(deletePresetId); }}
      />
      <ConfirmDialog
        open={deleteCountryOpen}
        onOpenChange={setDeleteCountryOpen}
        title="Move this country to Trash?"
        description="Its visa types stay attached and can be restored with it from the Trash page."
        confirmLabel="Move to Trash"
        onConfirm={handleDeleteCountry}
      />
    </div>
  );
}
