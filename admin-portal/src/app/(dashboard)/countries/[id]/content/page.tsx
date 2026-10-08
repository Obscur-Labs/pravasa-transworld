'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Plus, X, Save, Globe, ImagePlus,
  HelpCircle, Eye, MapPin, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { getCountries, updateCountryWebContent, uploadCountryImage, removeCountryImage } from '@/lib/api';
import { AiGenerateButton, type AiPurpose } from '@/components/shared/ai-generate-button';
import type { Country, CountryWebContent, CountryFaq } from '@/types';
import { Textarea } from '@/components/ui/textarea';

const emptyContent: CountryWebContent = {
  overview: '',
  requirements: '', processingInfo: '', tips: '', faqs: [],
};

/* Where each form section appears on the live country page. */
const LOC = {
  slider: 'Photo Slider',
  overview: 'Overview Card',
  requirements: 'Requirements Card',
  processing: 'Processing Card',
  tips: 'Tips Card',
  faq: 'FAQ Accordion',
} as const;

function LocationBadge({ loc }: { loc: keyof typeof LOC }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
      <MapPin className="w-2.5 h-2.5" />
      {LOC[loc]}
    </span>
  );
}

/* ─── Section card wrapper ─── */
function Section({ loc, title, subtitle, children }: {
  loc: keyof typeof LOC; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border bg-muted/40 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-foreground/80 uppercase tracking-wider">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        <LocationBadge loc={loc} />
      </div>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function TA({ value, onChange, placeholder, rows = 4, ai }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
  /** AI button, pinned inside the field's top-right corner. */
  ai?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={ai ? 'pr-12' : undefined}
      />
      {ai && <div className="absolute right-2 top-2">{ai}</div>}
    </div>
  );
}

/* ─── Mini Page Map (right panel) ─── */
function PageMap() {
  const zones = [
    {
      label: 'Photo Slider',
      color: 'bg-primary/5 border-primary/20 text-primary',
      dot: 'bg-primary',
      fields: ['Photos you upload'],
      auto: false,
    },
    {
      label: 'Visa Info Grid',
      color: 'bg-muted border-border text-muted-foreground',
      dot: 'bg-muted-foreground',
      fields: ['Visa type, stay, entry, validity, processing time'],
      auto: true,
    },
    {
      label: 'Overview Card',
      color: 'bg-primary/10 border-primary/20 text-primary',
      dot: 'bg-primary',
      fields: ['Overview text'],
      auto: false,
    },
    {
      label: 'Requirements Card',
      color: 'bg-primary/5 border-primary/20 text-primary',
      dot: 'bg-primary',
      fields: ['Visa requirements text'],
      auto: false,
    },
    {
      label: 'Processing & Tips',
      color: 'bg-warning/10 border-warning/20 text-warning',
      dot: 'bg-warning',
      fields: ['Processing info (left)', 'Tips (right)'],
      auto: false,
    },
    {
      label: 'FAQ Accordion',
      color: 'bg-primary/5 border-primary/20 text-primary',
      dot: 'bg-primary',
      fields: ['All your FAQs'],
      auto: false,
    },
    {
      label: 'Sidebar (right)',
      color: 'bg-muted border-border text-muted-foreground',
      dot: 'bg-muted-foreground',
      fields: ['Visa types', 'Pricing', 'Apply CTA'],
      auto: true,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border bg-muted/40 flex items-center gap-2">
        <Eye className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-extrabold text-foreground/80 uppercase tracking-widest">What users see</span>
      </div>

      {/* Wireframe zones */}
      <div className="p-4 space-y-2">
        {zones.map((z) => (
          <div key={z.label} className={`rounded-xl border p-3 ${z.color}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${z.dot}`} />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">{z.label}</span>
              </div>
              {z.auto && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-card/70 text-muted-foreground px-1.5 py-0.5 rounded-full border border-border">
                  <Zap className="w-2 h-2" /> auto
                </span>
              )}
            </div>
            <ul className="space-y-0.5">
              {z.fields.map((f) => (
                <li key={f} className="text-[10px] font-medium opacity-80 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-current opacity-50 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="px-4 pb-4 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-semibold">Auto = pulled from visa types, no editing needed</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function CountryContentPage() {
  const { id } = useParams<{ id: string }>();
  const [country, setCountry] = useState<Country | null>(null);
  const [content, setContent] = useState<CountryWebContent>(emptyContent);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCountries()
      .then((r) => {
        const found = r.data.data.find((c: Country) => c._id === id);
        if (found) {
          setCountry(found);
          setImages(found.images || []);
          const { heroTagline: _t, highlights: _h, ...saved } = (found.webContent || {}) as CountryWebContent & { heroTagline?: string; highlights?: string[] };
          setContent({ ...emptyContent, ...saved, faqs: saved.faqs || [] });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const setField = <K extends keyof CountryWebContent>(key: K, value: CountryWebContent[K]) =>
    setContent((prev) => ({ ...prev, [key]: value }));

  // Everything else on this page, so the AI writes each card consistently with the rest.
  const aiContext = (skip: string, extra: Record<string, unknown> = {}) => {
    const { faqs, ...fields } = content;
    return {
      country: country?.name,
      countryDescription: country?.description,
      ...Object.fromEntries(Object.entries(fields).filter(([k]) => k !== skip)),
      faqQuestions: (faqs || []).map((f) => f.question),
      ...extra,
    };
  };

  const aiFor = (key: keyof Omit<CountryWebContent, 'faqs'>) => (
    <AiGenerateButton
      purpose={`country.${key}` as AiPurpose}
      value={content[key] || ''}
      onChange={(text) => setField(key, text)}
      getContext={() => aiContext(key)}
      countryId={id}
    />
  );

  const addFaq = () =>
    setField('faqs', [...(content.faqs || []), { question: '', answer: '' }]);
  const updateFaq = (i: number, key: keyof CountryFaq, val: string) => {
    const updated = [...(content.faqs || [])];
    updated[i] = { ...updated[i], [key]: val };
    setField('faqs', updated);
  };
  const removeFaq = (i: number) =>
    setField('faqs', (content.faqs || []).filter((_, idx) => idx !== i));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await uploadCountryImage(id, fd);
      setImages(res.data.data.images || []);
      toast({ title: 'Image uploaded', variant: 'success' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async (url: string) => {
    setRemovingImage(url);
    try {
      const res = await removeCountryImage(id, url);
      setImages(res.data.data.images || []);
      toast({ title: 'Image removed', variant: 'success' });
    } catch {
      toast({ title: 'Failed to remove image', variant: 'destructive' });
    } finally {
      setRemovingImage(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCountryWebContent(id, content);
      toast({ title: 'Content saved', description: 'Website page updated.', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <Skeleton className="h-4 w-36 mb-4" />
        <div className="flex items-center gap-3 mb-7">
          <Skeleton className="w-10 h-7 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-5">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)}
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Country not found.</p>
        <Link href="/countries" className="text-primary hover:underline text-sm mt-2 inline-block">← Back to Countries</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* ── Page Header ── */}
      <div className="mb-7">
        <Link href="/countries" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Countries
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={`https://flagcdn.com/w40/${country.flag}.png`} alt={country.name} className="w-10 h-7 object-cover rounded shadow-sm" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{country.name}: Website Content</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Globe className={`w-3.5 h-3.5 ${country.showOnWebsite ? 'text-violet-500' : 'text-muted-foreground/50'}`} />
                <span className={`text-xs font-semibold ${country.showOnWebsite ? 'text-violet-600' : 'text-muted-foreground'}`}>
                  {country.showOnWebsite ? 'Live on website' : 'Hidden. Enable "Show on Website" on the Countries page'}
                </span>
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Content
          </Button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* LEFT: Form */}
        <div className="xl:col-span-2 space-y-5">

          {/* Photos */}
          <Section loc="slider" title="Photos" subtitle="First image = cover. Multiple images create a slider on the public page.">
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {images.map((url, i) => (
                  <div key={url} className="relative group rounded-xl overflow-hidden aspect-video bg-muted">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    {i === 0 && (
                      <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Cover</span>
                    )}
                    <button
                      onClick={() => handleRemoveImage(url)}
                      disabled={removingImage === url}
                      className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      {removingImage === url ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/jpg" className="hidden" onChange={handleImageUpload} />
            <Button
              type="button" variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="gap-2 w-full border-dashed border-border hover:border-primary/40 hover:text-primary text-muted-foreground"
            >
              {uploadingImage
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                : <><ImagePlus className="w-4 h-4" /> Upload Photo</>}
            </Button>
          </Section>

          {/* Overview */}
          <Section loc="overview" title="Overview" subtitle="A paragraph describing the country and visa experience.">
            <TA
              value={content.overview}
              onChange={(v) => setField('overview', v)}
              ai={aiFor('overview')}
              placeholder="Write a compelling overview of the country and visa journey..."
              rows={5}
            />
          </Section>

          {/* Requirements */}
          <Section loc="requirements" title="Visa Requirements" subtitle="Documents needed, eligibility, and conditions.">
            <TA
              value={content.requirements}
              onChange={(v) => setField('requirements', v)}
              ai={aiFor('requirements')}
              placeholder="General visa requirements: documents needed, eligibility criteria..."
              rows={5}
            />
          </Section>

          {/* Processing Info */}
          <Section loc="processing" title="Processing Information" subtitle="Shown in the left card of the two-column row.">
            <TA
              value={content.processingInfo}
              onChange={(v) => setField('processingInfo', v)}
              ai={aiFor('processingInfo')}
              placeholder="Processing timeline, stages, what applicants can expect..."
              rows={4}
            />
          </Section>

          {/* Tips */}
          <Section loc="tips" title="Tips for Applicants" subtitle="Shown in the right card next to Processing Info.">
            <TA
              value={content.tips}
              onChange={(v) => setField('tips', v)}
              ai={aiFor('tips')}
              placeholder="Helpful tips, common mistakes to avoid, best practices..."
              rows={4}
            />
          </Section>

          {/* FAQs */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-muted/40 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-foreground/80 uppercase tracking-wider">Frequently Asked Questions</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {(content.faqs || []).length === 0
                    ? 'No FAQs yet. Add as many as you need'
                    : `${(content.faqs || []).length} FAQ${(content.faqs || []).length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(content.faqs || []).length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20">
                    {(content.faqs || []).length}
                  </span>
                )}
                <LocationBadge loc="faq" />
              </div>
            </div>
            <CardContent className="p-5">
              <div className="space-y-3 mb-4">
                {(content.faqs || []).map((faq, i) => (
                  <div key={i} className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-card border-b border-border">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Question {i + 1}</span>
                      </div>
                      <button onClick={() => removeFaq(i)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded" title="Remove">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-4 space-y-2.5">
                      <Input
                        placeholder="Enter the question..."
                        value={faq.question}
                        onChange={(e) => updateFaq(i, 'question', e.target.value)}
                        className="bg-card font-medium text-sm"
                      />
                      <TA
                        value={faq.answer}
                        onChange={(v) => updateFaq(i, 'answer', v)}
                        placeholder={faq.question.trim() ? 'Enter the answer, or let AI draft it...' : 'Enter the answer...'}
                        ai={faq.question.trim() ? (
                          <AiGenerateButton
                            purpose="country.faqAnswer"
                            value={faq.answer}
                            onChange={(text) => updateFaq(i, 'answer', text)}
                            getContext={() => aiContext('faqs', { question: faq.question })}
                            countryId={id}
                          />
                        ) : undefined}
                        rows={3}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {(content.faqs || []).length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 py-8 text-center mb-4">
                  <HelpCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">No FAQs added yet.</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Add as many questions and answers as you need.</p>
                </div>
              )}

              <Button type="button" variant="outline" onClick={addFaq} className="gap-2 w-full border-dashed border-border hover:border-primary/40 hover:text-primary text-muted-foreground">
                <Plus className="w-4 h-4" /> Add FAQ
              </Button>
            </CardContent>
          </Card>

          {/* Save row */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/countries">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Content
            </Button>
          </div>
        </div>

        {/* RIGHT: Page map */}
        <div className="xl:sticky xl:top-4 xl:self-start space-y-4">
          <PageMap />

          {/* Quick status */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-2.5">
            <p className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider mb-3">Content Status</p>
            {[
              { label: 'Photos',           filled: images.length > 0,           hint: `${images.length} uploaded` },
              { label: 'Overview',         filled: !!content.overview.trim(),    hint: content.overview.trim() ? '✓ set' : 'empty' },
              { label: 'Requirements',     filled: !!content.requirements.trim(),hint: content.requirements.trim() ? '✓ set' : 'empty' },
              { label: 'Processing Info',  filled: !!content.processingInfo.trim(), hint: content.processingInfo.trim() ? '✓ set' : 'empty' },
              { label: 'Tips',             filled: !!content.tips.trim(),        hint: content.tips.trim() ? '✓ set' : 'empty' },
              { label: 'FAQs',             filled: (content.faqs || []).length > 0, hint: `${(content.faqs || []).length} added` },
            ].map(({ label, filled, hint }) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${filled ? 'bg-success' : 'bg-muted-foreground/30'}`} />
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                </div>
                <span className={`text-[10px] font-bold ${filled ? 'text-success' : 'text-muted-foreground/50'}`}>{hint}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
