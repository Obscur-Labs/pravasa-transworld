'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AtSign, Loader2, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { addApplicationNote, getApplicationAssignees, getApplicationNotes } from '@/lib/api';
import { formatDateTimeIST, timeAgo } from '@/lib/utils';

interface Note { _id: string; adminName: string; text: string; mentions: { _id: string; name: string }[]; createdAt: string }
type Member = { _id: string; name: string };

/**
 * Staff-only notes on an application. Typing "@" opens the team list; whoever is picked
 * gets a notification only they can see.
 */
export function NotesCard({ applicationId }: { applicationId: string }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<Member[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getApplicationNotes(applicationId).then((r) => setNotes(r.data.data)).catch(() => setNotes([]));
    getApplicationAssignees().then((r) => setMembers(r.data.data)).catch(() => {});
  }, [applicationId]);

  // The word being typed after an "@", if any.
  const onChange = (value: string) => {
    setText(value);
    const caret = box.current?.selectionStart ?? value.length;
    const m = value.slice(0, caret).match(/@([\w.]*)$/);
    setQuery(m ? m[1].toLowerCase() : null);
  };

  const suggestions = useMemo(
    () => (query === null ? [] : members.filter((m) => m.name.toLowerCase().replace(/\s+/g, '').includes(query)).slice(0, 6)),
    [query, members],
  );

  const pick = (m: Member) => {
    const caret = box.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\w.]*)$/, `@${m.name.split(' ')[0]} `);
    setText(before + text.slice(caret));
    setMentions((prev) => (prev.some((x) => x._id === m._id) ? prev : [...prev, m]));
    setQuery(null);
    box.current?.focus();
  };

  const post = async () => {
    setSaving(true);
    try {
      // Only people still named in the text are notified.
      const named = mentions.filter((m) => text.includes(`@${m.name.split(' ')[0]}`));
      const r = await addApplicationNote(applicationId, { text: text.trim(), mentions: named.map((m) => m._id) });
      setNotes((prev) => [r.data.data, ...(prev || [])]);
      setText('');
      setMentions([]);
      toast({ title: r.data.message, variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Could not add the note', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="p-5 border-b border-border flex items-center gap-2">
        <StickyNote className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Internal notes</h3>
        <span className="text-xs text-muted-foreground">Team only, never shown to the customer</span>
      </div>
      <CardContent className="p-5 space-y-4">
        <div className="relative">
          <Textarea ref={box} rows={3} maxLength={2000} value={text} onChange={(e) => onChange(e.target.value)}
            placeholder="Add a note. Type @ to mention a team member." aria-label="New note" />
          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-56 rounded-lg border border-border bg-popover shadow-lg overflow-hidden" role="listbox">
              {suggestions.map((m) => (
                <li key={m._id}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                    <AtSign className="w-3.5 h-3.5 text-muted-foreground" />{m.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{text.length}/2000</span>
            <Button size="sm" onClick={post} disabled={saving || !text.trim()}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Post note'}
            </Button>
          </div>
        </div>

        {notes === null ? (
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n._id} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span className="font-semibold text-foreground">{n.adminName}</span>
                  <span title={formatDateTimeIST(n.createdAt)}>{timeAgo(n.createdAt)}</span>
                  {n.mentions.length > 0 && <span className="ml-auto">Notified: {n.mentions.map((m) => m.name).join(', ')}</span>}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
