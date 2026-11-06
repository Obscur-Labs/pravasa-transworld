import { Request, Response } from 'express';
import mongoose, { Schema } from 'mongoose';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';

/** A blog post. Body is plain text with "## " headings; it goes live once published and its publish time has passed. */
const BlogPostSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    category: { type: String, default: 'Visa guides' },
    excerpt: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    coverAlt: { type: String, default: '' },
    seoTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    body: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishAt: { type: Date, default: null },
    author: { type: String, default: '' },
    readingTime: { type: Number, default: 1 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const BlogPost = mongoose.models.BlogPost || mongoose.model('BlogPost', BlogPostSchema);

const live = () => ({ status: 'published', publishAt: { $lte: new Date() } });
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const listFields = 'title slug category excerpt coverUrl coverAlt publishAt readingTime author';

export const getPosts = async (req: Request, res: Response): Promise<void> => {
  const filter: Record<string, unknown> = live();
  if (req.query.category) filter.category = String(req.query.category);
  const [posts, categories] = await Promise.all([
    BlogPost.find(filter).sort({ publishAt: -1 }).limit(60).select(listFields).lean(),
    BlogPost.distinct('category', live()),
  ]);
  sendSuccess(res, { posts, categories });
};

export const getPost = async (req: Request, res: Response): Promise<void> => {
  const post = await BlogPost.findOneAndUpdate({ slug: req.params.slug, ...live() }, { $inc: { views: 1 } }, { new: true }).lean();
  if (!post) { sendError(res, 'Post not found', 404); return; }
  const related = await BlogPost.find({ ...live(), category: (post as unknown as { category: string }).category, slug: { $ne: req.params.slug } })
    .sort({ publishAt: -1 }).limit(3).select(listFields).lean();
  sendSuccess(res, { post, related });
};

// Admin
export const adminGetPosts = async (_req: AdminRequest, res: Response): Promise<void> => {
  sendSuccess(res, await BlogPost.find().sort({ updatedAt: -1 }).select(`${listFields} status views updatedAt`).lean());
};

export const adminGetPost = async (req: AdminRequest, res: Response): Promise<void> => {
  const post = await BlogPost.findById(req.params.id).lean();
  if (!post) { sendError(res, 'Post not found', 404); return; }
  sendSuccess(res, post);
};

export const adminSavePost = async (req: AdminRequest, res: Response): Promise<void> => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (title.length < 10 || title.length > 110) { sendError(res, 'Title should be 10 to 110 characters'); return; }
  const slug = slugify(String(b.slug || '') || title);
  if (await BlogPost.exists({ slug, _id: { $ne: req.params.id || null } })) { sendError(res, 'Another post already uses this slug'); return; }
  const body = String(b.body || '').slice(0, 60000);
  const status = b.status === 'published' ? 'published' : 'draft';
  if (status === 'published' && !/^## /m.test(body)) { sendError(res, 'Add at least one "## " heading before publishing'); return; }
  if (b.coverUrl && !String(b.coverAlt || '').trim()) { sendError(res, 'Describe the cover image (alt text)'); return; }
  const publishAt = b.publishAt ? new Date(b.publishAt) : null;
  const fields = {
    title, slug, body, status,
    category: String(b.category || 'Visa guides').trim().slice(0, 40),
    excerpt: String(b.excerpt || '').trim().slice(0, 300),
    coverUrl: /^https:\/\//.test(String(b.coverUrl || '')) ? String(b.coverUrl) : '',
    coverAlt: String(b.coverAlt || '').trim().slice(0, 150),
    seoTitle: String(b.seoTitle || '').trim().slice(0, 60),
    metaDescription: String(b.metaDescription || '').trim().slice(0, 160),
    publishAt: status === 'published' ? (publishAt && !Number.isNaN(publishAt.getTime()) ? publishAt : new Date()) : publishAt,
    readingTime: Math.max(1, Math.round(body.split(/\s+/).length / 200)),
    author: req.admin?.name || '',
  };
  const post = req.params.id
    ? await BlogPost.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true })
    : await BlogPost.create(fields);
  if (!post) { sendError(res, 'Post not found', 404); return; }
  logActivity(req, req.params.id ? 'update' : 'create', 'Blog Post', `${title} (${status})`);
  sendSuccess(res, post, 'Post saved');
};

export const adminDeletePost = async (req: AdminRequest, res: Response): Promise<void> => {
  const post = await BlogPost.findByIdAndDelete(req.params.id);
  if (!post) { sendError(res, 'Post not found', 404); return; }
  logActivity(req, 'delete', 'Blog Post', String(post.title));
  sendSuccess(res, null, 'Post deleted');
};
