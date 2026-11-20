'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Template { trigger: string; label: string; subject: string; body: string; enabled: boolean }

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k] ?? m);

/** Customer emails per stage: edit, preview with sample values, send a test, and switch auto-send on. */
export default function MessageTemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [sample, setSample] = useState<Record<string, string>>({});
  const [active, setActive] = useState('');
  const [draft, setDraft] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.get('/admin/message-templates').then((r) => {
      setItems(r.data.data.items);
      setVariables(r.data.data.variables);
      setSample(r.data.data.sample);
      setActive(r.data.data.items[0]?.trigger || '');
    }).catch(() => toast({ title: 'Could not load templates', variant: 'destructive' }));
  }, []);

  const saved = items.find((t) => t.trigger === active) || null;
  useEffect(() => { setDraft(saved ? { ...saved } : null); }, [active, items]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!draft && !!saved && (draft.subject !== saved.subject || draft.body !== saved.body || draft.enabled !== saved.enabled);

  const insert = (v: string) => {
    if (!draft) return;
    const el = bodyRef.current;
    const token = `{{${v}}}`;
    const at = el ? el.selectionStart : draft.body.length;
    const end = el ? el.selectionEnd : at;
    setDraft({ ...draft, body: draft.body.slice(0, at) + token + draft.body.slice(end) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length); });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await api.put(`/admin/message-templates/${draft.trigger}`, draft);
      setItems((prev) => prev.map((t) => (t.trigger === draft.trigger ? draft : t)));
      toast({ title: 'Template saved', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!draft) return;
    setTesting(true);
    try {
      const r = await api.post(`/admin/message-templates/${draft.trigger}/test`, draft);
      toast({ title: r.data.message, variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Could not send the test', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">
      <PageHeader title="Message Templates" description="The email each customer gets at every stage. With auto-send off, the standard status email goes out instead." />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_340px] gap-4 items-start">
        <Card className="p-3">
          <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Trigger: status</p>
          {!items.length ? <Skeleton className="h-64 w-full" /> : (
            <ul className="space-y-1">
              {items.map((t) => (
                <li key={t.trigger}>
                  <button type="button" onClick={() => setActive(t.trigger)} aria-current={active === t.trigger ? 'true' : undefined}
                    className={cn('w-full flex items-center justify-between gap-2 rounded-lg border-l-2 px-3 py-2 text-left text-sm',
                      active === t.trigger ? 'border-primary bg-accent font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground')}>
                    {t.label}
                    <span className={cn('text-[11px] font-semibold', t.enabled ? 'text-success' : 'text-muted-foreground')}>{t.enabled ? 'On' : 'Off'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          {!draft ? <Skeleton className="h-96 w-full" /> : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-foreground">{draft.label}</h2>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', draft.enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                  Auto-send {draft.enabled ? 'on' : 'off'}
                </span>
                <Switch checked={draft.enabled} onChange={() => setDraft({ ...draft, enabled: !draft.enabled })} title="Auto-send" />
              </div>
              <p className="mt-2 inline-flex items-center gap-1.5 border-b-2 border-primary pb-1 text-sm font-semibold text-foreground"><Mail className="w-4 h-4" />Email</p>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="mt-subject">Subject</Label>
                  <Input id="mt-subject" className="mt-1" maxLength={150} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="mt-body">Message</Label>
                  <Textarea id="mt-body" ref={bodyRef} rows={10} className="mt-1" maxLength={4000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Insert variable</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {variables.map((v) => (
                      <button key={v} type="button" onClick={() => insert(v)} className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary hover:bg-primary/20">{`{{${v}}}`}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" onClick={test} disabled={testing}>{testing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}Send test to my email</Button>
                <span className="ml-auto flex gap-2">
                  <Button variant="outline" disabled={!dirty} onClick={() => saved && setDraft({ ...saved })}>Discard</Button>
                  <Button onClick={save} disabled={saving || !dirty}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Save template</Button>
                </span>
              </div>
            </>
          )}
        </Card>

        <Card className="p-4 bg-muted/60 lg:col-span-2 xl:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Preview</p>
          {draft && (
            <div className="mt-3 rounded-xl bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">{fill(draft.subject, sample)}</p>
              <p className="mt-3 text-sm text-foreground/90 whitespace-pre-line break-words">{fill(draft.body, sample)}</p>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Sample values. Real emails use the customer&apos;s details.</p>
        </Card>
      </div>
    </div>
  );
}
