import { Request, Response } from 'express';
import mongoose, { Schema } from 'mongoose';
import Application from '../../models/Application';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';

/** A customer review. Only approved ones are public; a matching approved application marks it verified. */
const TestimonialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: '' },
    application: { type: Schema.Types.ObjectId, ref: 'Application', default: null },
    applicationRef: { type: String, default: '' },
    verified: { type: Boolean, default: false },
    country: { type: Schema.Types.ObjectId, ref: 'Country', default: null },
    visaType: { type: Schema.Types.ObjectId, ref: 'VisaType', default: null },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    rejectReason: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    consentAt: { type: Date, required: true },
  },
  { timestamps: true }
);
export const Testimonial = mongoose.models.Testimonial || mongoose.model('Testimonial', TestimonialSchema);

const PAGE = 9;
const DONE = ['visa_approved', 'visa_delivered'];
const publicFields = 'name city rating text verified featured createdAt country visaType';

/** Approved reviews, filterable by country, visa and minimum rating; newest or highest first. */
export const getTestimonials = async (req: Request, res: Response): Promise<void> => {
  const filter: Record<string, unknown> = { status: 'approved' };
  for (const key of ['country', 'visaType'] as const) {
    const v = String(req.query[key] || '');
    if (mongoose.isValidObjectId(v)) filter[key] = v;
  }
  const rating = Number(req.query.rating);
  if (rating >= 1 && rating <= 5) filter.rating = { $gte: rating };
  if (req.query.featured === 'true') filter.featured = true;
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const sort: Record<string, 1 | -1> = req.query.sort === 'highest' ? { rating: -1, createdAt: -1 } : { featured: -1, createdAt: -1 };
  const [items, total] = await Promise.all([
    Testimonial.find(filter).sort(sort).skip((page - 1) * PAGE).limit(PAGE).select(publicFields)
      .populate('country', 'name flag').populate('visaType', 'name').lean(),
    Testimonial.countDocuments(filter),
  ]);
  sendSuccess(res, { items, total, hasMore: page * PAGE < total });
};

/** Average and count over verified, approved reviews only (also feeds the AggregateRating markup). */
export const getTestimonialSummary = async (_req: Request, res: Response): Promise<void> => {
  const [row] = await Testimonial.aggregate([
    { $match: { status: 'approved', verified: true } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 }, five: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } } } },
  ]);
  sendSuccess(res, { average: row ? Math.round(row.avg * 10) / 10 : 0, count: row?.count || 0, fiveStar: row?.five || 0 });
};

export const submitTestimonial = async (req: Request, res: Response): Promise<void> => {
  const b = req.body || {};
  if (b.website) { sendSuccess(res, null, 'Thank you'); return; } // honeypot: bots fill every field
  const name = String(b.name || '').trim();
  const city = String(b.city || '').trim();
  const text = String(b.text || '').trim();
  const rating = Math.floor(Number(b.rating));
  const ref = String(b.applicationRef || '').trim().toUpperCase();
  if (name.length < 2 || name.length > 50) { sendError(res, 'Enter your name (2 to 50 characters)'); return; }
  if (city.length > 40) { sendError(res, 'City can be at most 40 characters'); return; }
  if (!(rating >= 1 && rating <= 5)) { sendError(res, 'Choose a rating from 1 to 5'); return; }
  if (text.length < 30 || text.length > 800) { sendError(res, 'Your review should be 30 to 800 characters'); return; }
  if (b.consent !== true) { sendError(res, 'Please agree to us publishing your review'); return; }
  if (!/^PRS-[A-Z]+-\d{4,}$/.test(ref)) { sendError(res, 'Enter your application ID, e.g. PRS-UNI-24817'); return; }
  const app = await Application.findOne({ referenceId: ref }).select('status country visaType');
  if (!app || !DONE.includes(app.status)) { sendError(res, 'We could not find an approved application with that ID'); return; }
  if (await Testimonial.exists({ application: app._id })) { sendError(res, 'A review for this application has already been sent'); return; }
  await Testimonial.create({
    name, city, rating, text, application: app._id, applicationRef: ref, verified: true,
    country: app.country, visaType: app.visaType, consentAt: new Date(),
  });
  sendSuccess(res, null, 'Thank you! Your review will appear once our team checks it.', 201);
};

// Admin moderation
export const adminListTestimonials = async (req: AdminRequest, res: Response): Promise<void> => {
  const status = ['pending', 'approved', 'rejected'].includes(String(req.query.status)) ? req.query.status : 'pending';
  const items = await Testimonial.find({ status }).sort({ createdAt: -1 }).limit(200)
    .populate('country', 'name').populate('visaType', 'name').lean();
  const counts = await Testimonial.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  sendSuccess(res, { items, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
};

export const adminUpdateTestimonial = async (req: AdminRequest, res: Response): Promise<void> => {
  const update: Record<string, unknown> = {};
  if (['approved', 'rejected', 'pending'].includes(req.body?.status)) update.status = req.body.status;
  if (req.body?.status === 'rejected') update.rejectReason = String(req.body.rejectReason || '').slice(0, 200);
  if (typeof req.body?.featured === 'boolean') update.featured = req.body.featured;
  const doc = await Testimonial.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
  if (!doc) { sendError(res, 'Review not found', 404); return; }
  logActivity(req, 'update', 'Testimonial', `${doc.name}: ${update.status ?? (doc.featured ? 'featured' : 'unfeatured')}`);
  sendSuccess(res, doc, 'Review updated');
};
