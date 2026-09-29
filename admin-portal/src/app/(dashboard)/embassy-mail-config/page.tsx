'use client';
import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { getEmbassyMailConfig, updateEmbassyMailConfig } from '@/lib/api';
import type { EmbassyMailConfig, EmbassyMailPlaceholder, EmbassyMailSender } from '@/types';

type FormState = Omit<EmbassyMailConfig, '_id'>;

const empty: FormState = { subjectTemplate: '', bodyTemplate: '', defaultCc: '', replyTo: '' };

export default function EmbassyMailConfigPage() {
  const [form, setForm] = useState<FormState>(empty);
  const [saved, setSaved] = useState<FormState>(empty);
  const [placeholders, setPlaceholders] = useState<EmbassyMailPlaceholder[]>([]);
  const [sender, setSender] = useState<EmbassyMailSender | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEmbassyMailConfig()
      .then((r) => {
        const { config, placeholders: tokens, sender: from } = r.data.data as {
          config: EmbassyMailConfig;
          placeholders: EmbassyMailPlaceholder[];
          sender: EmbassyMailSender;
        };
        const { _id, ...rest } = config;
        setForm({ ...empty, ...rest });
        setSaved({ ...empty, ...rest });
        setPlaceholders(tokens);
        setSender(from);
      })
      .catch(() => toast({ title: 'Could not load the mail format', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateEmbassyMailConfig(form);
      setSaved(form);
      toast({ title: 'Embassy mail format saved', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Placeholders are inserted at the cursor, so a token can be dropped mid-sentence
  // without hand-typing the braces.
  const insertToken = (token: string) => {
    const el = document.getElementById('bodyTemplate') as HTMLTextAreaElement | null;
    const snippet = `{{${token}}}`;
    if (!el) {
      setForm((f) => ({ ...f, bodyTemplate: `${f.bodyTemplate}${snippet}` }));
      return;
    }
    const { selectionStart: start, selectionEnd: end, value } = el;
    const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
    setForm((f) => ({ ...f, bodyTemplate: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Embassy Mail Config"
        description="The default format every embassy or agency mail starts from. Admins can still edit each draft before sending."
        action={
          dirty ? (
            <Button variant="outline" onClick={() => setForm(saved)} disabled={saving}>
              <RotateCcw className="w-4 h-4 mr-2" /> Discard Changes
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                {sender && (
                  <div className="p-3 rounded-xl border border-border bg-muted/40">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Sent from</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">
                      {sender.name} <span className="text-muted-foreground font-normal">&lt;{sender.email}&gt;</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {sender.shared
                        ? 'Currently shares the no-reply address used for customer notifications. Set EMBASSY_EMAIL_FROM_ADDRESS in the backend env to send embassy mail from its own monitored mailbox.'
                        : 'Separate from the no-reply address used for customer notifications. Change it with EMBASSY_EMAIL_FROM_ADDRESS in the backend env.'}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="defaultCc">Always Cc <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      id="defaultCc"
                      className="mt-1"
                      placeholder="ops@yourcompany.com, docs@yourcompany.com"
                      value={form.defaultCc}
                      onChange={(e) => setForm({ ...form, defaultCc: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Pre-filled in every draft; removable per mail.</p>
                  </div>
                  <div>
                    <Label htmlFor="replyTo">Reply-To <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      id="replyTo"
                      type="email"
                      className="mt-1"
                      placeholder="visa@yourcompany.com"
                      value={form.replyTo}
                      onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Where the embassy&apos;s reply lands.</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="subjectTemplate">Subject</Label>
                  <Input
                    id="subjectTemplate"
                    className="mt-1 font-mono text-[13px]"
                    value={form.subjectTemplate}
                    onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="bodyTemplate">Message</Label>
                  <textarea
                    id="bodyTemplate"
                    rows={22}
                    value={form.bodyTemplate}
                    onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-[13px] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Sent exactly as written: line breaks and spacing are preserved in the email.
                  </p>
                </div>

                <div>
                  <Button onClick={handleSave} disabled={saving || !dirty}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Format
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit lg:sticky lg:top-6">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Placeholders</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click one to drop it into the message. Each is replaced with the application&apos;s own data.
              </p>
            </div>
            <CardContent className="p-4 space-y-1.5 max-h-[70vh] overflow-y-auto">
              {placeholders.map((p) => (
                <button
                  key={p.token}
                  onClick={() => insertToken(p.token)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-accent transition-colors"
                >
                  <span className="text-xs font-mono font-semibold text-primary">{`{{${p.token}}}`}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{p.description}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
