import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import { MessageTemplate, TRIGGERS, VARIABLES, render } from '../../utils/messageTemplates';
import { sendTemplateEmail, customerAppUrl } from '../../services/email.service';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';

const SAMPLE: Record<string, string> = {
  name: 'Arjun Patel', app_id: 'PRS-UNI-24815', country: 'France', visa: 'Schengen Tourist', status: 'Visa Approved',
  reason: 'Insufficient travel history', link: customerAppUrl('/applications'), review_link: customerAppUrl('/testimonials'),
};

/** Every trigger with its saved template, or the built-in text when nothing is saved yet. */
export const getMessageTemplates = async (_req: AdminRequest, res: Response): Promise<void> => {
  const saved = await MessageTemplate.find().lean<{ trigger: string; subject: string; body: string; enabled: boolean }[]>();
  const items = TRIGGERS.map((t) => {
    const s = saved.find((x) => x.trigger === t.key);
    return { trigger: t.key, label: t.label, subject: s?.subject ?? t.subject, body: s?.body ?? t.body, enabled: s?.enabled ?? false };
  });
  sendSuccess(res, { items, variables: VARIABLES, sample: SAMPLE });
};

export const saveMessageTemplate = async (req: AdminRequest, res: Response): Promise<void> => {
  const def = TRIGGERS.find((t) => t.key === req.params.trigger);
  if (!def) { sendError(res, 'Unknown trigger', 404); return; }
  const subject = String(req.body?.subject ?? '').trim().slice(0, 150);
  const body = String(req.body?.body ?? '').trim().slice(0, 4000);
  const enabled = !!req.body?.enabled;
  if (enabled && (!subject || !body)) { sendError(res, 'Add a subject and a message before switching auto-send on'); return; }
  const doc = await MessageTemplate.findOneAndUpdate({ trigger: def.key }, { $set: { subject, body, enabled } }, { upsert: true, new: true });
  logActivity(req, 'update', 'Message Template', `${def.label}: ${enabled ? 'auto-send on' : 'auto-send off'}`);
  sendSuccess(res, doc, 'Template saved');
};

/** Sends the template, filled with sample values, to the signed-in admin's email. */
export const sendTestTemplate = async (req: AdminRequest, res: Response): Promise<void> => {
  const to = req.admin?.email;
  if (!to) { sendError(res, 'Add an email to your profile to receive tests'); return; }
  const subject = render(String(req.body?.subject ?? ''), SAMPLE);
  const body = render(String(req.body?.body ?? ''), SAMPLE);
  if (!subject.trim() || !body.trim()) { sendError(res, 'Write a subject and message first'); return; }
  await sendTemplateEmail({ email: to, subject: `[Test] ${subject}`, body });
  sendSuccess(res, null, `Test sent to ${to}`);
};
