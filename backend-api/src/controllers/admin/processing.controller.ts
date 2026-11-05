import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import Application, { IApplication, ISubmission, PARENT_RELATIONS, ParentRelation } from '../../models/Application';
import Document from '../../models/Document';
import { deleteFromCloudinary, uploadToCloudinary } from '../../services/cloudinary.service';
import { generateCarryChecklistPDF } from '../../services/pdf.service';
import { logActivity } from '../../utils/activityLog';
import { notifyCustomer } from '../../utils/customerNotify';
import { checkParent, parentAdults, tripDates } from '../../utils/parentLink';
import { buildTravellers } from '../../utils/travellers';
import { sendSuccess, sendError } from '../../utils/response';

/**
 * The France flow after documents are approved: VFS appointment, how each traveller
 * submits (visit VFS for biometrics, or Pravasa submits when fingerprints are reusable),
 * extra documents the embassy asks for, and dispatch of the passports.
 */

const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const truthy = (v: unknown) => v === true || v === 'true';

const responsesOf = (app: IApplication): Record<string, string> => {
  const r = app.formResponses as unknown;
  return r instanceof Map ? Object.fromEntries(r) : ((r as Record<string, string>) || {});
};

/** Travellers named from their passport answers, falling back to "Adult 1". */
function travellerNames(app: IApplication): string[] {
  const r = responsesOf(app);
  const list = app.travellers?.length ? app.travellers : buildTravellers(app.referenceId, app.adults, app.children, []);
  return list.map((t) => [r[`${t.label} - Given Name(s)`], r[`${t.label} - Surname`]].filter(Boolean).join(' ') || t.label);
}

const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** What to take to the centre: originals of everything uploaded, plus the usual extras. */
export async function buildCarryChecklist(app: IApplication) {
  const docs = await Document.find({ application: app._id }).select('requirementName');
  const names = new Set<string>();
  for (const d of docs) {
    const base = d.requirementName
      .replace(/^(Adult|Child) \d+\s*-\s*/i, '')
      .replace(/^Additional\s*-\s*/i, '')
      .replace(/\s*\((Front|Back|\d+)\)\s*$/i, '')
      .trim();
    if (base && !/passport|photo/i.test(base)) names.add(base);
  }
  const appt = app.vfsAppointment;
  const country = app.country as unknown as { name?: string };
  const visa = app.visaType as unknown as { name?: string };
  return generateCarryChecklistPDF({
    referenceId: app.referenceId,
    countryName: country?.name || '',
    visaName: visa?.name || '',
    travellers: travellerNames(app),
    appointment: appt?.date ? { centre: appt.centre, date: fmtDate(appt.date), time: appt.time, reference: appt.reference } : null,
    items: [
      'Original passports for every traveller, plus any old passports',
      'Recent photographs as per the visa photo rules',
      'Printed and signed visa application form',
      ...(appt?.date ? ['Printed appointment letter'] : []),
      ...[...names].map((n) => `${n} (original or printed copy)`),
      'Fees payable at the centre, if any',
    ],
  });
}

async function loadApp(req: AdminRequest, res: Response): Promise<IApplication | null> {
  const app = await Application.findById(req.params.id).populate('country', 'name').populate('visaType', 'name');
  if (!app) sendError(res, 'Application not found', 404);
  return app;
}

export const downloadCarryChecklist = async (req: AdminRequest, res: Response): Promise<void> => {
  const app = await loadApp(req, res);
  if (!app) return;
  const pdf = await buildCarryChecklist(app);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="checklist-${app.referenceId}.pdf"`);
  res.end(pdf);
};

export const updateVfsAppointment = async (req: AdminRequest, res: Response): Promise<void> => {
  const app = await loadApp(req, res);
  if (!app) return;
  const prev = app.vfsAppointment;
  const next = {
    centre: str(req.body.centre),
    date: str(req.body.date, 10),
    time: str(req.body.time, 10),
    reference: str(req.body.reference),
    letterUrl: prev?.letterUrl || '',
    letterPublicId: prev?.letterPublicId || '',
    letterName: prev?.letterName || '',
    sentAt: prev?.sentAt || null,
  };
  if (!next.centre || !next.date || !next.time) { sendError(res, 'Centre, date and time are required'); return; }

  if (req.file) {
    const { url, publicId } = await uploadToCloudinary(req.file.buffer, 'vfs-letters', 'auto', { private: true });
    if (prev?.letterPublicId) deleteFromCloudinary(prev.letterPublicId, prev.letterUrl).catch(() => {});
    Object.assign(next, { letterUrl: url, letterPublicId: publicId, letterName: req.file.originalname.slice(0, 120) });
  }

  const notify = truthy(req.body.notify);
  if (notify) next.sentAt = new Date();
  app.vfsAppointment = next;
  await app.save();
  logActivity(req, 'update', 'Application', `${app.referenceId}: VFS appointment ${next.date} ${next.time}, ${next.centre}${notify ? ' (sent to customer)' : ''}`);

  if (notify) {
    await notifyCustomer(app, {
      title: 'VFS appointment booked',
      message: `Your appointment is booked. Download the documents-to-carry checklist from your application and take every original with you.`,
      emailSubject: `VFS appointment on ${fmtDate(next.date)}`,
      lines: [['Centre', next.centre], ['Date', fmtDate(next.date)], ['Time', next.time], ['Reference', next.reference]],
    });
  }
  sendSuccess(res, app, notify ? 'Appointment saved and sent to the customer' : 'Appointment saved');
};

export const updateSubmission = async (req: AdminRequest, res: Response): Promise<void> => {
  const app = await loadApp(req, res);
  if (!app) return;
  if (!app.travellers?.length) app.travellers = buildTravellers(app.referenceId, app.adults, app.children, []);
  const traveller = app.travellers.find((t) => t.key === req.params.key);
  if (!traveller) { sendError(res, 'Traveller not found', 404); return; }

  const mode = str(req.body.mode, 20) as ISubmission['mode'];
  const biometrics = str(req.body.biometricsWithin2Years, 5) as ISubmission['biometricsWithin2Years'];
  if (!['', 'visit_vfs', 'pravasa'].includes(mode)) { sendError(res, 'Unknown submission type'); return; }
  // Pravasa only submits on someone's behalf when their fingerprints are under 2 years old.
  if (mode === 'pravasa' && biometrics !== 'yes') {
    sendError(res, 'Pravasa can submit only when biometrics were given within the last 2 years'); return;
  }
  if (mode === 'pravasa' && (!str(req.body.reference) || !str(req.body.date))) {
    sendError(res, 'Add the submission reference and date'); return;
  }

  const notify = truthy(req.body.notify);
  traveller.submission = {
    mode,
    biometricsWithin2Years: ['yes', 'no'].includes(biometrics) ? biometrics : '',
    previousVisaVerified: truthy(req.body.previousVisaVerified),
    centre: str(req.body.centre),
    reference: str(req.body.reference),
    date: str(req.body.date, 10),
    notifiedAt: notify ? new Date() : traveller.submission?.notifiedAt ?? null,
  };
  app.markModified('travellers');
  await app.save();
  logActivity(req, 'update', 'Application', `${traveller.ref}: submission ${mode === 'pravasa' ? 'by Pravasa' : mode === 'visit_vfs' ? 'visit VFS' : 'cleared'}`);

  if (notify && mode) {
    const name = travellerNames(app)[app.travellers.indexOf(traveller)] || traveller.label;
    const appt = app.vfsAppointment;
    await notifyCustomer(app, mode === 'visit_vfs'
      ? {
        title: 'Visit VFS for biometrics',
        message: `${name} needs to visit the VFS centre in person to give fingerprints and a photo.`,
        lines: [['Traveller', `${name} (${traveller.ref})`], ['Centre', appt?.centre || ''], ['Date', fmtDate(appt?.date || '')], ['Time', appt?.time || '']],
      }
      : {
        title: 'No need to visit VFS',
        message: `Good news: ${name}'s fingerprints from a recent visa can be reused, so Pravasa has submitted the documents on their behalf. We will update you on the decision.`,
        lines: [['Traveller', `${name} (${traveller.ref})`], ['Submitted at', traveller.submission.centre], ['Reference', traveller.submission.reference], ['Date', fmtDate(traveller.submission.date)]],
      });
  }
  sendSuccess(res, app, 'Submission saved');
};

export const requestAdditionalDocs = async (req: AdminRequest, res: Response): Promise<void> => {
  const app = await loadApp(req, res);
  if (!app) return;
  const labels = (app.travellers?.length ? app.travellers : buildTravellers(app.referenceId, app.adults, app.children, [])).map((t) => t.label);
  const items = (Array.isArray(req.body.items) ? req.body.items : [])
    .map((i: { name?: unknown; appliesTo?: unknown }) => ({ name: str(i?.name, 120), appliesTo: labels.includes(str(i?.appliesTo)) ? str(i?.appliesTo) : 'All' }))
    .filter((i: { name: string }) => i.name);
  if (!items.length) { sendError(res, 'Add at least one document'); return; }
  const note = str(req.body.note, 500);
  if (!note) { sendError(res, 'Add a note for the customer'); return; }

  const current = app.additionalDocs?.items || [];
  const added = items
    .map((i: { name: string; appliesTo: string }) => ({
      ...i,
      // Family-wide requests sit outside any traveller's tab; the card lists them.
      requirementName: i.appliesTo === 'All' ? `Additional - ${i.name}` : `${i.appliesTo} - Additional - ${i.name}`,
      status: 'requested' as const,
      requestedAt: new Date(),
    }))
    .filter((i: { requirementName: string }) => !current.some((c) => c.requirementName === i.requirementName));

  app.additionalDocs = {
    items: [...current, ...added],
    note,
    dueDate: str(req.body.dueDate, 10),
    submittedMethod: '',
    submittedRef: '',
    submittedDate: '',
  };
  await app.save();
  logActivity(req, 'update', 'Application', `${app.referenceId}: requested ${added.length} additional document(s)`);

  await notifyCustomer(app, {
    title: 'More documents needed',
    message: `The embassy needs more documents: ${added.map((i: { name: string }) => i.name).join(', ')}. ${note} Upload them from your application.`,
    lines: [['Due by', fmtDate(app.additionalDocs.dueDate)]],
  });
  sendSuccess(res, app, 'Request sent to the customer');
};

export const markAdditionalDocsSubmitted = async (req: AdminRequest, res: Response): Promise<void> => {
  const app = await loadApp(req, res);
  if (!app) return;
  if (!app.additionalDocs?.items.length) { sendError(res, 'No additional documents were requested'); return; }
  app.additionalDocs.submittedMethod = str(req.body.method, 80);
  app.additionalDocs.submittedRef = str(req.body.reference, 80);
  app.additionalDocs.submittedDate = str(req.body.date, 10);
  if (!app.additionalDocs.submittedMethod || !app.additionalDocs.submittedDate) { sendError(res, 'Method and date are required'); return; }
  app.markModified('additionalDocs');
  await app.save();
  logActivity(req, 'update', 'Application', `${app.referenceId}: additional documents submitted (${app.additionalDocs.submittedMethod})`);
  sendSuccess(res, app, 'Marked as submitted');
};

export const updateDispatch = async (req: AdminRequest, res: Response): Promise<void> => {
  const app = await loadApp(req, res);
  if (!app) return;
  const method = str(req.body.method, 20) as 'courier' | 'pickup' | 'digital';
  if (!['courier', 'pickup', 'digital'].includes(method)) { sendError(res, 'Pick how the visa goes back to the customer'); return; }
  if (method === 'courier' && (!str(req.body.courier) || !str(req.body.trackingNumber))) {
    sendError(res, 'Add the courier and tracking number'); return;
  }
  const notify = truthy(req.body.notify);
  app.dispatch = {
    method,
    courier: method === 'courier' ? str(req.body.courier, 80) : '',
    trackingNumber: method === 'courier' ? str(req.body.trackingNumber, 80) : '',
    dispatchedAt: app.dispatch?.dispatchedAt || new Date(),
    notifiedAt: notify ? new Date() : app.dispatch?.notifiedAt ?? null,
  };
  await app.save();
  logActivity(req, 'update', 'Application', `${app.referenceId}: dispatch ${method}${app.dispatch.trackingNumber ? ` ${app.dispatch.courier} ${app.dispatch.trackingNumber}` : ''}`);

  if (notify) {
    const how = method === 'courier' ? `Your passports are on their way by ${app.dispatch.courier}.`
      : method === 'pickup' ? 'Your passports are ready to collect from our Surat office.'
      : 'Your visa copies are in your application.';
    await notifyCustomer(app, {
      title: 'Your visa is ready',
      message: `Good news: the visa is approved. ${how} Happy journey!`,
      type: 'visa_approved',
      lines: [['Courier', app.dispatch.courier], ['Tracking number', app.dispatch.trackingNumber]],
    });
  }
  sendSuccess(res, app, notify ? 'Dispatch saved and customer told' : 'Dispatch saved');
};

/** Unlink a child-only order from its parent, or point it at another parent application. */
export const updateParentLink = async (req: AdminRequest, res: Response): Promise<void> => {
  const app = await loadApp(req, res);
  if (!app) return;
  if (!app.parentLink) { sendError(res, 'This application is not linked to a parent'); return; }

  if (req.body.action === 'unlink') {
    const from = app.parentLink.ref;
    app.parentLink.status = 'broken';
    app.parentLink.reason = 'was unlinked by the Pravasa team';
    app.parentLink.checkedAt = new Date();
    await app.save();
    logActivity(req, 'update', 'Application', `${app.referenceId}: unlinked from parent ${from}`);
    sendSuccess(res, app, 'Unlinked; the application is on hold until relinked');
    return;
  }

  const ref = str(req.body.parentRef, 40).toUpperCase();
  const parent = await Application.findOne({ $or: [{ referenceId: ref }, { 'travellers.ref': ref }] });
  if (!parent || String(parent._id) === String(app._id)) { sendError(res, 'Parent application not found', 404); return; }
  const { from, to } = tripDates(app);
  const eligibility = await checkParent(parent, { countryId: app.country?._id ?? app.country, from, to, excludeChildId: app._id });
  if (!eligibility.ok) { sendError(res, eligibility.reason); return; }

  const adult = parentAdults(parent).find((a) => a.key === str(req.body.parentKey)) || parentAdults(parent)[0];
  const relation = (PARENT_RELATIONS.includes(req.body.relation) ? req.body.relation : 'guardian') as ParentRelation;
  const previous = app.parentLink.ref;
  app.parentLink = {
    application: parent._id as typeof app.parentLink.application,
    ref: parent.referenceId,
    parents: [{ key: adult.key, relation }],
    status: 'ok',
    reason: '',
    checkedAt: new Date(),
  };
  await app.save();
  logActivity(req, 'update', 'Application', `${app.referenceId}: parent changed from ${previous} to ${parent.referenceId}`);
  sendSuccess(res, app, `Linked to ${parent.referenceId}`);
};
