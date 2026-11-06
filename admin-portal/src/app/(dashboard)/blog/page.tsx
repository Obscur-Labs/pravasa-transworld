'use client';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Newspaper, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface Row { _id: string; title: string; slug: string; category: string; status: 'draft' | 'published'; publishAt: string | null; views: number; updatedAt: string }
const empty = { title: '', slug: '', category: 'Visa guides', excerpt: '', coverUrl: '', coverAlt: '', seoTitle: '', metaDescription: '', body: '', status: 'draft', publishAt: '' };
const SITE = process.env.NEXT_PUBLIC_USER_PORTAL_URL || 'https://pravasatransworld.com';

/** Blog posts: write in plain text with "## " headings; publish now or at a later time (IST). */
export default function BlogAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const load = useCallback(() => api.get('/admin/blog').then((r) => setRows(r.data.data)).catch(() => {}).finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);

  const open = async (id: string | 'new') => {
    setEditing(id);
    if (id === 'new') { setForm(empty); return; }
    const p = (await api.get(`/admin/blog/${id}`)).data.data;
    const local = p.publishAt ? new Date(new Date(p.publishAt).getTime() + 5.5 * 3600000).toISOString().slice(0, 16) : '';
    setForm({ ...empty, ...p, publishAt: local });
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, publishAt: form.publishAt ? `${form.publishAt}:00+05:30` : '' };
      await (editing === 'new' ? api.post('/admin/blog', body) : api.put(`/admin/blog/${editing}`, body));
      toast({ title: 'Post saved', variant: 'success' });
      setEditing(null);
      load();
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const status = (r: Row) => r.status === 'draft' ? ['Draft', 'bg-muted text-muted-foreground']
    : r.publishAt && new Date(r.publishAt) > new Date() ? ['Scheduled', 'bg-info/10 text-info'] : ['Published', 'bg-success/10 text-success'];
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <PageHeader title="Blog" description="Visa guides and news for the website. Posts go live at their publish time." action={<Button onClick={() => open('new')}><Plus className="w-4 h-4 mr-1.5" />New post</Button>} />
      {loading ? <Skeleton className="h-48 w-full rounded-xl" /> : rows.length === 0 ? (
        <EmptyState icon={Newspaper} title="No posts yet" action={<Button onClick={() => open('new')}>New post</Button>} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>{['Title', 'Category', 'Status', 'Publish date', 'Views', ''].map((h) => <th key={h} className="text-left font-semibold px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><p className="font-semibold">{r.title}</p><p className="text-xs text-muted-foreground">/blog/{r.slug}</p></td>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3"><span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', status(r)[1])}>{status(r)[0]}</span></td>
                  <td className="px-4 py-3">{r.publishAt ? formatDate(r.publishAt) : '-'}</td>
                  <td className="px-4 py-3 tabular-nums">{r.views}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button type="button" aria-label={`Edit ${r.title}`} onClick={() => open(r._id)} className="p-1.5 rounded hover:bg-accent"><Pencil className="w-4 h-4" /></button>
                    {r.status === 'published' && <a href={`${SITE}/blog/${r.slug}`} target="_blank" rel="noopener noreferrer" aria-label="View on site" className="inline-block p-1.5 rounded hover:bg-accent"><ExternalLink className="w-4 h-4" /></a>}
                    <button type="button" aria-label={`Delete ${r.title}`} onClick={() => setDeleting(r)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Sheet open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetTitle>{editing === 'new' ? 'New post' : 'Edit post'}</SheetTitle>
          <div className="mt-4 space-y-3">
            <div><Label>Title <span className="text-muted-foreground font-normal">({form.title.length}/110)</span></Label><Input className="mt-1" maxLength={110} value={form.title} onChange={set('title')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Slug</Label><Input className="mt-1" placeholder="auto from title" value={form.slug} onChange={set('slug')} /></div>
              <div><Label>Category</Label><Input className="mt-1" value={form.category} onChange={set('category')} /></div>
            </div>
            <div><Label>Excerpt</Label><Textarea className="mt-1" rows={2} maxLength={300} value={form.excerpt} onChange={set('excerpt')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cover image link (1200 x 630)</Label><Input className="mt-1" placeholder="https://..." value={form.coverUrl} onChange={set('coverUrl')} /></div>
              <div><Label>Cover alt text</Label><Input className="mt-1" value={form.coverAlt} onChange={set('coverAlt')} /></div>
            </div>
            <div><Label>Body <span className="text-muted-foreground font-normal">(start a line with "## " for a heading; blank line between paragraphs)</span></Label><Textarea className="mt-1 font-mono text-xs" rows={16} value={form.body} onChange={set('body')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SEO title <span className="text-muted-foreground font-normal">({form.seoTitle.length}/60)</span></Label><Input className="mt-1" maxLength={60} value={form.seoTitle} onChange={set('seoTitle')} /></div>
              <div><Label>Meta description <span className="text-muted-foreground font-normal">({form.metaDescription.length}/160)</span></Label><Input className="mt-1" maxLength={160} value={form.metaDescription} onChange={set('metaDescription')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Status</Label><NativeSelect className="mt-1" value={form.status} onChange={set('status')}><option value="draft">Draft</option><option value="published">Published</option></NativeSelect></div>
              <div><Label>Publish at (IST, optional)</Label><Input className="mt-1" type="datetime-local" value={form.publishAt} onChange={set('publishAt')} /></div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Save post</Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)} title="Delete this post?" description="It disappears from the website straight away." confirmLabel="Delete"
        onConfirm={async () => { if (deleting) { await api.delete(`/admin/blog/${deleting._id}`); toast({ title: 'Post deleted', variant: 'success' }); load(); } }} />
    </div>
  );
}
