import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import TermPreset from '../../models/TermPreset';
import { sendSuccess, sendError } from '../../utils/response';
import { moveToTrash } from '../../utils/trash';
import { logActivity } from '../../utils/activityLog';

// Drops blank terms and renumbers the rest in the order they were sent.
const cleanTerms = (terms: unknown) =>
  (Array.isArray(terms) ? terms : [])
    .filter((t) => String(t?.text ?? '').trim())
    .map((t, order) => ({
      text: String(t.text).trim(),
      required: t.required !== false,
      defaultChecked: !!t.defaultChecked,
      order,
    }));

const readBody = (body: any) => ({
  name: String(body?.name ?? '').trim(),
  description: String(body?.description ?? '').trim(),
  terms: cleanTerms(body?.terms),
});

export const getTermPresets = async (_req: AdminRequest, res: Response): Promise<void> => {
  sendSuccess(res, await TermPreset.find().sort({ updatedAt: -1 }));
};

export const createTermPreset = async (req: AdminRequest, res: Response): Promise<void> => {
  const data = readBody(req.body);
  if (!data.name) { sendError(res, 'Preset name is required'); return; }
  const preset = await TermPreset.create(data);
  logActivity(req, 'create', 'Terms Preset', preset.name);
  sendSuccess(res, preset, 'Terms preset saved', 201);
};

export const updateTermPreset = async (req: AdminRequest, res: Response): Promise<void> => {
  const data = readBody(req.body);
  if (!data.name) { sendError(res, 'Preset name is required'); return; }
  const preset = await TermPreset.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!preset) { sendError(res, 'Terms preset not found', 404); return; }
  logActivity(req, 'update', 'Terms Preset', preset.name);
  sendSuccess(res, preset, 'Terms preset updated');
};

export const deleteTermPreset = async (req: AdminRequest, res: Response): Promise<void> => {
  const preset = await TermPreset.findById(req.params.id);
  if (!preset) { sendError(res, 'Terms preset not found', 404); return; }
  await moveToTrash('termPreset', preset);
  logActivity(req, 'delete', 'Terms Preset', preset.name);
  sendSuccess(res, null, 'Terms preset moved to trash');
};
