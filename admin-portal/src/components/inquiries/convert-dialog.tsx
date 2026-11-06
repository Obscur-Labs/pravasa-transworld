'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/components/ui/use-toast';
import { convertInquiry, getCountries, getVisaTypes } from '@/lib/api';

export interface ConvertTarget { kind: 'lead' | 'inquiry'; id: string; name: string; email: string }

/**
 * Starts an application for the person who asked: their account is found or created from
 * the inquiry's email, a draft for the chosen visa lands in their My Applications, and they
 * get an email with a link to finish it.
 */
export function ConvertDialog({ target, onClose, onConverted }: {
  target: ConvertTarget | null;
  onClose: () => void;
  onConverted: (doc: { status: string; convertedTo: { visaName: string } }) => void;
}) {
  const [countries, setCountries] = useState<{ _id: string; name: string }[]>([]);
  const [visas, setVisas] = useState<{ _id: string; name: string }[]>([]);
  const [form, setForm] = useState({ country: '', visaTypeId: '', adults: 1, children: 0, travelDate: '', notify: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setForm({ country: '', visaTypeId: '', adults: 1, children: 0, travelDate: '', notify: true });
    if (!countries.length) getCountries().then((r) => setCountries(r.data.data.filter((c: { isActive?: boolean }) => c.isActive !== false))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  useEffect(() => {
    setVisas([]);
    if (form.country) getVisaTypes(form.country).then((r) => setVisas(r.data.data.filter((v: { isActive?: boolean }) => v.isActive !== false))).catch(() => {});
  }, [form.country]);

  const submit = async () => {
    if (!target || !form.visaTypeId) return;
    setSaving(true);
    try {
      const r = await convertInquiry(target.kind, target.id, {
        visaTypeId: form.visaTypeId, adults: form.adults, children: form.children, travelDate: form.travelDate, notify: form.notify,
      });
      onConverted(r.data.data);
      toast({ title: 'Application started', description: `${target.name} can finish it from My Applications.`, variant: 'success' });
      onClose();
    } catch (err: any) {
      toast({ title: 'Could not convert', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to application</DialogTitle>
          <DialogDescription>
            {target?.email
              ? `Creates ${target.name}'s account (${target.email}) if needed and starts the visa below in their My Applications.`
              : 'This inquiry has no email address, so an account cannot be created. Ask the customer for one first.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Country
            <NativeSelect className="mt-1" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value, visaTypeId: '' })}>
              <option value="">Choose a country</option>
              {countries.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </NativeSelect>
          </label>
          <label className="block text-sm font-medium">Visa
            <NativeSelect className="mt-1" value={form.visaTypeId} disabled={!form.country} onChange={(e) => setForm({ ...form, visaTypeId: e.target.value })}>
              <option value="">{form.country && !visas.length ? 'No active visas' : 'Choose a visa'}</option>
              {visas.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
            </NativeSelect>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-sm font-medium">Adults
              <Input className="mt-1" type="number" min={1} max={10} value={form.adults} onChange={(e) => setForm({ ...form, adults: Number(e.target.value) || 1 })} />
            </label>
            <label className="block text-sm font-medium">Children
              <Input className="mt-1" type="number" min={0} max={9} value={form.children} onChange={(e) => setForm({ ...form, children: Number(e.target.value) || 0 })} />
            </label>
            <label className="block text-sm font-medium">Travel date
              <Input className="mt-1" type="date" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />
            Email the customer a link to continue
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.visaTypeId || !target?.email}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Start application
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
