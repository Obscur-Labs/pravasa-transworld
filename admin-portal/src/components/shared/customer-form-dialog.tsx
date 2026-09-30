'use client';
import { useEffect, useState } from 'react';
import { User as UserIcon, Building2, Check, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { createUser, updateUser } from '@/lib/api';
import type { CorporateType, User } from '@/types';

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing customer to edit; null/undefined creates a new one. */
  customer?: User | null;
  onSaved: (saved: User) => void;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  accountType: 'individual' | 'corporate';
  corporateType: CorporateType;
  gstNumber: string;
  isActive: boolean;
  promoApplicable: boolean;
}

const empty = (): FormState => ({
  name: '',
  email: '',
  phone: '',
  accountType: 'individual',
  corporateType: 'corporate',
  gstNumber: '',
  isActive: true,
  promoApplicable: true,
});

const inputClass =
  'w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: CustomerFormDialogProps) {
  const [form, setForm] = useState<FormState>(empty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      customer
        ? {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            accountType: customer.accountType || 'individual',
            corporateType: customer.corporateType === 'b2b_agent' ? 'b2b_agent' : 'corporate',
            gstNumber: customer.gstNumber || '',
            isActive: customer.isActive,
            promoApplicable: customer.promoApplicable !== false,
          }
        : empty()
    );
  }, [open, customer]);

  const isCorporate = form.accountType === 'corporate';
  const valid =
    form.name.trim() &&
    form.email.trim() &&
    form.phone.trim() &&
    (!isCorporate || form.gstNumber.trim());

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        accountType: form.accountType,
        corporateType: isCorporate ? form.corporateType : 'corporate',
        gstNumber: isCorporate ? form.gstNumber.trim() : '',
        isActive: form.isActive,
        promoApplicable: form.promoApplicable,
      };
      const res = customer ? await updateUser(customer._id, payload) : await createUser(payload);
      onOpenChange(false);
      onSaved(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>{customer ? 'Edit Customer' : 'New Customer'}</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          {/* Account type */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Customer Type *</label>
            <div className="flex rounded-xl border border-input overflow-hidden">
              {([
                { value: 'individual' as const, label: 'Individual', icon: UserIcon },
                { value: 'corporate' as const, label: 'Corporate', icon: Building2 },
              ]).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, accountType: value })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                    form.accountType === value
                      ? value === 'corporate' ? 'bg-warning text-warning-foreground' : 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Corporate kind. Admin-only: the customer never sees which one they are. */}
          {isCorporate && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Corporate Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'corporate' as const, label: 'Corporate', desc: 'Corporate service fee, pays by any method' },
                  { value: 'b2b_agent' as const, label: 'B2B Agent', desc: 'Uses the B2B price list set on each visa' },
                ]).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, corporateType: value })}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      form.corporateType === value
                        ? value === 'b2b_agent' ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30' : 'border-warning bg-warning/10 ring-1 ring-warning/30'
                        : 'border-input hover:bg-muted'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      {form.corporateType === value && <Check className="w-3.5 h-3.5" />}{label}
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Only admins see this. The customer just sees their prices.</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {isCorporate ? 'Company / Contact Name *' : 'Full Name *'}
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={isCorporate ? 'e.g. Acme Travels Pvt Ltd' : 'e.g. Rahul Sharma'}
              className={inputClass}
            />
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Phone *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. 9876543210"
                className={inputClass}
              />
            </div>
          </div>

          {/* GST (corporate only) */}
          {isCorporate && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">GST Number *</label>
              <input
                value={form.gstNumber}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })}
                placeholder="e.g. 22AAAAA0000A1Z5"
                className={`${inputClass} font-mono tracking-wider uppercase`}
              />
              <p className="text-xs text-muted-foreground mt-1">Required for corporate accounts. Shown on receipts.</p>
            </div>
          )}

          {/* Toggles */}
          <div className="flex gap-3">
            {([
              { key: 'isActive' as const, label: 'Active', desc: 'Customer can sign in and apply', tone: 'success' as const },
              { key: 'promoApplicable' as const, label: 'Promo Eligible', desc: 'Can apply promo codes', tone: 'violet' as const },
            ]).map(({ key, label, desc, tone }) => (
              <div key={key} className="flex-1 flex items-center gap-3 p-3 rounded-xl border border-border">
                <Switch checked={form[key]} onChange={() => setForm({ ...form, [key]: !form[key] })} tone={tone} />
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !valid}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            {saving ? 'Saving…' : customer ? 'Update Customer' : 'Create Customer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
