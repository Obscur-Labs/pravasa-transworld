'use client';
import { useEffect, useState } from 'react';
import { Loader2, Mail, MessageCircle, Settings2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/components/ui/use-toast';
import { sendInquiryReply } from '@/lib/api';
import { cn, formatDateTimeIST } from '@/lib/utils';
import type { InquiryReply, ReplyTemplate } from '@/types';

export interface ReplyTarget {
  kind: 'lead' | 'inquiry';
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  message: string;
  createdAt: string;
  replies: InquiryReply[];
}

type Channel = 'whatsapp' | 'email' | 'both';
const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: 'WhatsApp', email: 'Email', both: 'WhatsApp + Email' };
const fill = (body: string, name: string) => body.replace(/\{name\}/g, name.split(' ')[0] || name);

/** Reply to one inquiry: pick a template, edit, send by WhatsApp and/or email. Every reply is kept on the inquiry. */
export function ReplyDrawer({ target, templates, onClose, onSent, onManageTemplates }: {
  target: ReplyTarget | null;
  templates: ReplyTemplate[];
  onClose: () => void;
  onSent: (doc: { replies: InquiryReply[]; status: string }) => void;
  onManageTemplates: () => void;
}) {
  const digits = target?.phone.replace(/\D/g, '') || '';
  const channels = ([digits && 'whatsapp', target?.email && 'email', digits && target?.email && 'both'].filter(Boolean)) as Channel[];
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [markAwaiting, setMarkAwaiting] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setBody('');
    setPicked(null);
    setMarkAwaiting(true);
    setChannel(channels.includes('both') ? 'both' : channels[0] || 'whatsapp');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  const send = async () => {
    if (!target || !body.trim()) return;
    // Opened before the request so the browser treats it as a click, not a popup.
    const wa = channel !== 'email' && digits ? window.open(`https://wa.me/${digits}?text=${encodeURIComponent(body.trim())}`, '_blank', 'noopener') : null;
    setSending(true);
    try {
      const r = await sendInquiryReply(target.kind, target.id, { body: body.trim(), channel, markAwaiting });
      onSent(r.data.data);
      toast({ title: channel === 'whatsapp' ? 'Reply logged; finish sending in WhatsApp' : 'Reply sent', variant: 'success' });
      onClose();
    } catch (err: any) {
      wa?.close();
      toast({ title: 'Could not send the reply', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={!!target} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col">
        {target && (
          <>
            <SheetTitle>Reply to inquiry</SheetTitle>
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold text-foreground">
                {target.name} <span className="font-normal text-muted-foreground">· {target.source} · {formatDateTimeIST(target.createdAt)}</span>
              </p>
              {target.message && <p className="mt-1 text-foreground/90 whitespace-pre-line">{target.message}</p>}
            </div>

            {target.replies.length > 0 && (
              <ol className="mt-3 space-y-2" aria-label="Earlier replies">
                {target.replies.map((r, i) => (
                  <li key={i} className="ml-8 rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm">
                    <p className="whitespace-pre-line text-foreground">{r.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{r.by} · {CHANNEL_LABEL[r.channel]} · {formatDateTimeIST(r.at)}</p>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Template</p>
              <button type="button" onClick={onManageTemplates} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Settings2 className="w-3.5 h-3.5" />Manage
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <button key={t.title} type="button" aria-pressed={picked === t.title}
                  onClick={() => { setPicked(t.title); setBody(fill(t.body, target.name)); }}
                  className={cn('px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                    picked === t.title ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                  {t.title}
                </button>
              ))}
              {templates.length === 0 && <p className="text-xs text-muted-foreground">No templates yet.</p>}
            </div>

            <label className="mt-4 text-sm font-semibold text-foreground" htmlFor="reply-body">Reply</label>
            <Textarea id="reply-body" rows={7} className="mt-1.5" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your reply..." />

            <label className="mt-4 text-sm font-semibold text-foreground" htmlFor="reply-channel">Channel</label>
            <NativeSelect id="reply-channel" className="mt-1.5" value={channel} onChange={(e) => setChannel(e.target.value as Channel)} disabled={!channels.length}>
              {channels.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </NativeSelect>
            {channel !== 'email' && (
              <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />WhatsApp opens with this text ready; press send there.
                {channel === 'both' && <><Mail className="w-3 h-3 ml-1" />Email goes straight away.</>}
              </p>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" className="rounded" checked={markAwaiting} onChange={(e) => setMarkAwaiting(e.target.checked)} />
              Mark as Awaiting customer after sending
            </label>

            <div className="mt-auto pt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={send} disabled={sending || !body.trim() || !channels.length}>
                {sending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Send reply
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
