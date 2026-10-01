import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../middleware/auth.middleware';
import ApplicationDraft from '../../models/ApplicationDraft';
import Country from '../../models/Country';
import VisaType from '../../models/VisaType';
import { encryptData, decryptData } from '../../utils/encryption';
import { sendSuccess, sendError } from '../../utils/response';

const MAX_DRAFTS = 10;
const MAX_STATE_BYTES = 200 * 1024;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isId = (v: unknown) => typeof v === 'string' && mongoose.isValidObjectId(v);
const count = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** Validates the wizard snapshot; returns the fields to store or an error. */
async function parse(body: Record<string, any>) {
  if (!isId(body.country) || !(await Country.exists({ _id: body.country }))) return { error: 'Choose a country first' };
  const visaType = isId(body.visaType) && (await VisaType.exists({ _id: body.visaType, country: body.country })) ? body.visaType : null;
  const state = JSON.stringify({
    formData: body.formData && typeof body.formData === 'object' ? body.formData : {},
    passportValues: body.passportValues && typeof body.passportValues === 'object' ? body.passportValues : {},
    vaultPicks: Array.isArray(body.vaultPicks) ? body.vaultPicks : [],
  });
  if (Buffer.byteLength(state) > MAX_STATE_BYTES) return { error: 'This draft is too large to save' };
  return {
    fields: {
      country: body.country,
      visaType,
      // Without a visa the furthest the user can resume is picking one.
      step: visaType ? count(body.step, 1, 4, 1) : Math.min(count(body.step, 1, 4, 1), 2),
      travelStartDate: DATE_RE.test(body.travelStartDate) ? body.travelStartDate : '',
      travelEndDate: DATE_RE.test(body.travelEndDate) ? body.travelEndDate : '',
      adults: count(body.adults, 0, 50, 1),
      children: count(body.children, 0, 50, 0),
      state: encryptData(state),
    },
  };
}

export const getDrafts = async (req: AuthRequest, res: Response): Promise<void> => {
  const drafts = await ApplicationDraft.find({ user: req.user!._id })
    .populate('country', 'name flag')
    .populate('visaType', 'name')
    .sort({ updatedAt: -1 });
  sendSuccess(res, drafts);
};

export const getDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  const draft = await ApplicationDraft.findOne({ _id: req.params.id, user: req.user!._id }).select('+state').populate('country');
  if (!draft) { sendError(res, 'Draft not found', 404); return; }
  let state = {};
  try { state = JSON.parse(decryptData(draft.state) || '{}'); } catch { /* unreadable, resume with an empty form */ }
  const { state: _omit, ...rest } = draft.toObject();
  sendSuccess(res, { ...rest, ...state });
};

export const createDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  if ((await ApplicationDraft.countDocuments({ user: req.user!._id })) >= MAX_DRAFTS) {
    sendError(res, `You can keep up to ${MAX_DRAFTS} saved drafts. Delete one from My Applications first.`); return;
  }
  const parsed = await parse(req.body || {});
  if ('error' in parsed) { sendError(res, parsed.error!); return; }
  const draft = await ApplicationDraft.create({ user: req.user!._id, ...parsed.fields });
  sendSuccess(res, { _id: draft._id }, 'Saved to My Applications', 201);
};

export const updateDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = await parse(req.body || {});
  if ('error' in parsed) { sendError(res, parsed.error!); return; }
  const draft = await ApplicationDraft.findOneAndUpdate({ _id: req.params.id, user: req.user!._id }, { $set: parsed.fields }, { new: true });
  if (!draft) { sendError(res, 'Draft not found', 404); return; }
  sendSuccess(res, { _id: draft._id }, 'Saved to My Applications');
};

export const deleteDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  const draft = await ApplicationDraft.findOneAndDelete({ _id: req.params.id, user: req.user!._id });
  if (!draft) { sendError(res, 'Draft not found', 404); return; }
  sendSuccess(res, null, 'Draft deleted');
};
