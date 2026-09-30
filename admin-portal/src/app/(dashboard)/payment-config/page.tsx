'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { getPaymentConfig, updatePaymentConfig } from '@/lib/api';
import type { PaymentConfig } from '@/types';
import { Textarea } from '@/components/ui/textarea';

type FormState = Omit<PaymentConfig, '_id'>;

const empty: FormState = {
  upiId: '', payeeName: '', merchantCode: '',
  bankName: '', accountName: '', accountNumber: '', ifsc: '', branch: '',
  verificationHours: 24, terms: [],
};
const UPI_ID_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^d{6,20}$/;

// Same shape the backend builds for customers, fixed at Rs 1 for a safe live test.
function testLink(f: FormState): string {
  const params: [string, string][] = [['pa', f.upiId], ['pn', f.payeeName], ['am', '1.00'], ['cu', 'INR'], ['tn', 'Test payment']];
  if (f.merchantCode) params.push(['mc', f.merchantCode], ['tr', 'TEST']);
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

/** Whether customers currently see this method. */
function MethodStatus({ ready }: { ready: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${ready ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-success' : 'bg-muted-foreground/60'}`} />
      {ready ? 'Shown to customers' : 'Hidden'}
    </span>
  );
}

export default function PaymentConfigPage() {
  const [form, setForm] = useState<FormState>(empty);
  const [defaultTerms, setDefaultTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPaymentConfig()
      .then((r) => {
        const { _id, ...rest } = r.data.data.config as PaymentConfig;
        setForm({ ...empty, ...rest });
        setDefaultTerms(r.data.data.defaultTerms || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const setTerm = (i: number, value: string) =>
    setForm((f) => ({ ...f, terms: f.terms.map((t, j) => (j === i ? value : t)) }));

  const upiValid = UPI_ID_RE.test(form.upiId.trim());
  const canPreview = upiValid && !!form.payeeName.trim();
  const accountValid = ACCOUNT_RE.test(form.accountNumber);
  const ifscValid = IFSC_RE.test(form.ifsc);
  const bankReady = accountValid && ifscValid && !!form.accountName.trim();
  const upiReady = canPreview;

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await updatePaymentConfig({ ...form, terms: form.terms.map((t) => t.trim()).filter(Boolean) });
      const { _id, ...rest } = r.data.data.config as PaymentConfig;
      setForm({ ...empty, ...rest });
      toast({ title: 'Payment settings saved', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Payment Settings"
        description="Where customers send UPI and bank payments, and what they must confirm before submitting one."
      />

      {loading ? (
        <Card><CardContent className="p-6 space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-foreground">UPI account</h2>
                  <MethodStatus ready={upiReady} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">
                  Use a business UPI ID linked to the company current account. Some UPI apps limit or block payments with a pre-filled amount to personal UPI IDs.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="upiId">UPI ID</Label>
                    <Input id="upiId" className="mt-1 font-mono" placeholder="e.g. pravasa@icici"
                      value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value.trim() })} />
                    {form.upiId && !upiValid && <p className="text-xs text-destructive mt-1">That does not look like a UPI ID.</p>}
                  </div>
                  <div>
                    <Label htmlFor="payeeName">Payee name</Label>
                    <Input id="payeeName" className="mt-1" placeholder="Exactly as registered on the UPI ID"
                      value={form.payeeName} onChange={(e) => setForm({ ...form, payeeName: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="merchantCode">Merchant category code <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="merchantCode" className="mt-1 font-mono" placeholder="4 digits, from your bank" inputMode="numeric" maxLength={4}
                      value={form.merchantCode} onChange={(e) => setForm({ ...form, merchantCode: e.target.value.replace(/\D/g, '') })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-foreground">Bank account</h2>
                  <MethodStatus ready={bankReady} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">
                  Shown to customers for NEFT, RTGS or IMPS, useful for amounts above UPI limits. Leave the account number empty to hide bank transfer.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="accountName">Account holder name</Label>
                    <Input id="accountName" className="mt-1" placeholder="Exactly as on the bank account"
                      value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="bankName">Bank name</Label>
                    <Input id="bankName" className="mt-1" placeholder="e.g. AU Small Finance Bank"
                      value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="accountNumber">Account number</Label>
                    <Input id="accountNumber" className="mt-1 font-mono" inputMode="numeric" maxLength={20}
                      value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/D/g, '') })} />
                    {form.accountNumber && !accountValid && <p className="text-xs text-destructive mt-1">Account numbers are 6 to 20 digits.</p>}
                  </div>
                  <div>
                    <Label htmlFor="ifsc">IFSC</Label>
                    <Input id="ifsc" className="mt-1 font-mono uppercase" placeholder="e.g. AUBL0002132" maxLength={11}
                      value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
                    {form.ifsc && !ifscValid && <p className="text-xs text-destructive mt-1">IFSC is 11 characters, like AUBL0002132.</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="branch">Branch <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="branch" className="mt-1"
                      value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold text-foreground">Verification</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">Applies to both methods. Every submitted payment is checked by hand against the bank statement.</p>
                <div className="max-w-xs">
                  <Label htmlFor="hours">Verification time (hours)</Label>
                  <Input id="hours" type="number" min={1} max={168} className="mt-1"
                    value={form.verificationHours} onChange={(e) => setForm({ ...form, verificationHours: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground mt-1">Promised to customers. Late ones are flagged in Payment Verification.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-semibold text-foreground">Payment confirmations</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Customers must tick every one before submitting. <code className="rounded bg-muted px-1">{'{hours}'}</code> is replaced with the verification time.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setForm({ ...form, terms: [...defaultTerms] })}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Defaults
                  </Button>
                </div>
                <div className="space-y-2.5">
                  {form.terms.map((term, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Textarea
                        rows={2}
                        value={term}
                        onChange={(e) => setTerm(i, e.target.value)}
                        aria-label={`Confirmation ${i + 1}`}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon" aria-label={`Remove confirmation ${i + 1}`}
                        onClick={() => setForm({ ...form, terms: form.terms.filter((_, j) => j !== i) })}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setForm({ ...form, terms: [...form.terms, ''] })}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />Add confirmation
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </div>

          <Card className="xl:sticky xl:top-6">
            <CardContent className="p-6 text-center">
              <h2 className="font-semibold text-foreground">Test with &#8377;1</h2>
              <p className="text-xs text-muted-foreground mt-0.5 mb-4">
                Scan with a phone before going live. The rupee should land in the company account under this payee name.
              </p>
              {canPreview ? (
                <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
                  <QRCodeSVG value={testLink(form)} size={180} level="M" title="Rs 1 test payment QR code" />
                </div>
              ) : (
                <div className="mx-auto flex h-[206px] w-[206px] items-center justify-center rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                  Enter a valid UPI ID and payee name to see the test QR.
                </div>
              )}
              {canPreview && <p className="text-xs text-muted-foreground mt-3">Paying to <span className="font-semibold text-foreground">{form.payeeName}</span></p>}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
