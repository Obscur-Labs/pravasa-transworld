'use client';
import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { getReceiptConfig, updateReceiptConfig, downloadDemoReceipt, updateBranding } from '@/lib/api';
import type { ReceiptConfig } from '@/types';
import { BusinessHoursCard } from '@/components/shared/business-hours-card';
import { BrandingCard, type BrandingValue } from '@/components/shared/branding-card';
import { UnsavedBar, useUnsaved } from '@/components/shared/unsaved-bar';

type FormState = Omit<ReceiptConfig, '_id'>;

const empty: FormState = {
  companyName: '', addressLine1: '', addressLine2: '', phone: '', fax: '', email: '',
  gstin: '', pan: '', stateName: '', stateCode: '', sacCode: '998555', logoUrl: '',
  brandPrimary: '#0B2E3D', brandAccent: '#9F7437', brandFont: 'Inter',
  phone2: '', website: '', businessHours: '',
};

const BRAND_KEYS = ['logoUrl', 'brandPrimary', 'brandAccent', 'brandFont', 'website'] as const;
// Hours save from their own card, so they never count as unsaved here.
const tracked = ({ hoursSchedule: _h, businessHours: _b, ...rest }: FormState) => rest;

const FIELDS: { key: Exclude<keyof FormState, 'hoursSchedule' | (typeof BRAND_KEYS)[number]>; label: string; placeholder: string; span?: 1 | 2 }[] = [
  { key: 'companyName', label: 'Company Name', placeholder: 'e.g. Pravasa Transworld Pvt. Ltd.', span: 2 },
  { key: 'addressLine1', label: 'Address Line 1', placeholder: 'Building, street', span: 2 },
  { key: 'addressLine2', label: 'Address Line 2', placeholder: 'City, state, PIN', span: 2 },
  { key: 'phone', label: 'Phone', placeholder: '+91 84695 24000' },
  { key: 'phone2', label: 'Second Phone', placeholder: '+91 84693 24000' },
  { key: 'fax', label: 'Fax', placeholder: 'Optional' },
  { key: 'email', label: 'Email', placeholder: 'billing@yourcompany.com' },
  { key: 'gstin', label: 'Company GSTIN', placeholder: 'e.g. 27AACCA7715P1Z9' },
  { key: 'pan', label: 'Company PAN', placeholder: 'e.g. AACCA7715P' },
  { key: 'stateName', label: 'State', placeholder: 'e.g. Maharashtra' },
  { key: 'stateCode', label: 'GST State Code', placeholder: 'e.g. 27' },
  { key: 'sacCode', label: 'SAC Code', placeholder: 'e.g. 998555' },
];

export default function ReceiptConfigPage() {
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { dirty, markSaved, saved } = useUnsaved(tracked(form));

  useEffect(() => {
    getReceiptConfig()
      .then((r) => {
        const { _id, ...rest } = r.data.data as ReceiptConfig;
        const loaded = { ...empty, ...rest };
        setForm(loaded);
        markSaved(tracked(loaded));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { hoursSchedule: _h, businessHours: _b, ...details } = form;
      const brand = Object.fromEntries(BRAND_KEYS.map((k) => [k, form[k]]));
      await updateReceiptConfig(details);
      await updateBranding(brand);
      markSaved(tracked(form));
      toast({ title: 'Settings saved', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadDemo = async () => {
    setDownloading(true);
    try {
      const response = await downloadDemoReceipt();
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'receipt-demo.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', description: 'Could not generate the demo receipt.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Receipt Config"
        description="Company details printed on every receipt / tax invoice. Name, address, phones, email, website and hours also show across the website."
        action={
          <Button variant="outline" onClick={handleDownloadDemo} disabled={downloading}>
            {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download Demo Receipt
          </Button>
        }
      />

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key} className={f.span === 2 ? 'sm:col-span-2' : undefined}>
                  <Label>{f.label}</Label>
                  <Input
                    className="mt-1"
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-5">
            The website header, footer, contact, privacy and terms pages read the address, both phones, email, website and hours from here.
            Leave a field empty to keep the default shown today.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            GSTIN, PAN, and State are only printed on receipts for corporate customers (invoices then show a GST breakdown).
            Individual customers get a simpler receipt without any tax details.
          </p>

        </CardContent>
      </Card>

      {!loading && (
        <BrandingCard
          value={Object.fromEntries(BRAND_KEYS.map((k) => [k, form[k]])) as unknown as BrandingValue}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
      )}

      {!loading && (
        <BusinessHoursCard
          schedule={form.hoursSchedule}
          label={form.businessHours}
          onSaved={(businessHours, hoursSchedule) => setForm((f) => ({ ...f, businessHours, hoursSchedule }))}
        />
      )}

      <UnsavedBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={() => { const s = saved(); if (s) setForm((f) => ({ ...f, ...s })); }}
      />
    </div>
  );
}
