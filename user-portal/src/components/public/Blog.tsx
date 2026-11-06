'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface PostSummary { _id: string; title: string; slug: string; category: string; excerpt: string; coverUrl: string; coverAlt: string; publishAt: string; readingTime: number }
interface Post extends PostSummary { body: string; author: string }

function PostCard({ p }: { p: PostSummary }) {
  return (
    <Link href={`/blog/${p.slug}`} className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-[1200/630] bg-gradient-to-br from-brand-950 to-brand-700">
        {p.coverUrl && <img src={p.coverUrl} alt={p.coverAlt} loading="lazy" className="w-full h-full object-cover" />}
      </div>
      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-gold-600">{p.category}</p>
        <h2 className="mt-1 font-bold text-brand-950 group-hover:underline">{p.title}</h2>
        {p.excerpt && <p className="mt-2 text-sm text-slate-600 line-clamp-3">{p.excerpt}</p>}
        <p className="mt-3 text-xs text-slate-400">{formatDate(p.publishAt)} · {p.readingTime} min read</p>
      </div>
    </Link>
  );
}

/** Listing with category chips. */
export function BlogList() {
  const [data, setData] = useState<{ posts: PostSummary[]; categories: string[] } | null>(null);
  const [category, setCategory] = useState('');
  useEffect(() => {
    api.get('/public/blog', { params: category ? { category } : {} }).then((r) => setData(r.data.data)).catch(() => setData({ posts: [], categories: [] }));
  }, [category]);

  return (
    <>
      <section className="bg-gradient-to-br from-brand-950 to-brand-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-400 mb-3">Blog</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold">Visa guides and travel tips</h1>
        </div>
      </section>
      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {!!data?.categories.length && (
            <div className="flex flex-wrap gap-2 mb-6">
              {['', ...data.categories].map((c) => (
                <button key={c || 'all'} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full border text-sm font-medium ${category === c ? 'bg-brand-950 text-white border-brand-950' : 'border-slate-200 text-slate-600'}`}>
                  {c || 'All'}
                </button>
              ))}
            </div>
          )}
          {!data ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
          ) : data.posts.length === 0 ? (
            <p className="py-12 text-center text-slate-500">No posts {category ? 'in this category ' : ''}yet. <Link href="/countries" className="underline">Browse destinations</Link></p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{data.posts.map((p) => <PostCard key={p._id} p={p} />)}</div>
          )}
        </div>
      </section>
    </>
  );
}

/** One post: "## " lines become headings, blank lines split paragraphs. */
export function BlogPost({ slug }: { slug: string }) {
  const [data, setData] = useState<{ post: Post; related: PostSummary[] } | null | 'missing'>(null);
  useEffect(() => { api.get(`/public/blog/${slug}`).then((r) => setData(r.data.data)).catch(() => setData('missing')); }, [slug]);

  if (data === 'missing') return <div className="max-w-3xl mx-auto px-4 py-20 text-center"><p className="text-slate-600">This post is not available.</p><Link href="/blog" className="mt-3 inline-block underline">All posts</Link></div>;
  if (!data) return <div className="max-w-3xl mx-auto px-4 py-16 space-y-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-5 rounded bg-slate-100 animate-pulse" />)}</div>;
  const { post, related } = data;
  const blocks = post.body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-900"><ArrowLeft className="w-4 h-4" />All posts</Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-gold-600">{post.category}</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-brand-950 leading-tight">{post.title}</h1>
      <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">{post.author && <>{post.author} · </>}{formatDate(post.publishAt)} · <Clock className="w-3.5 h-3.5" />{post.readingTime} min read</p>
      {post.coverUrl && <img src={post.coverUrl} alt={post.coverAlt} className="mt-6 w-full rounded-2xl aspect-[1200/630] object-cover" />}
      <div className="mt-8 space-y-4 text-slate-700 leading-relaxed">
        {blocks.map((b, i) => b.startsWith('## ')
          ? <h2 key={i} className="pt-4 text-2xl font-bold text-brand-950">{b.slice(3)}</h2>
          : <p key={i} className="whitespace-pre-line">{b}</p>)}
      </div>
      <div className="mt-10 rounded-2xl bg-brand-950 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="font-semibold">Ready to apply? We check every document before it reaches the embassy.</p>
        <Link href="/countries" className="shrink-0 rounded-lg bg-gold-600 px-5 py-2.5 font-bold hover:bg-gold-700">Find your visa</Link>
      </div>
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold text-brand-950 mb-4">Related posts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{related.map((p) => <PostCard key={p._id} p={p} />)}</div>
        </div>
      )}
    </article>
  );
}
