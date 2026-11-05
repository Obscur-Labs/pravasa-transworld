import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import Application, { IApplication, IParentLink, PARENT_RELATIONS, ParentRelation } from '../../models/Application';
import Document from '../../models/Document';
import ParentVerification from '../../models/ParentVerification';
import { checkParent, maskName, normalizeDob, parentAdults, tripDates } from '../../utils/parentLink';
import { sendSuccess, sendError } from '../../utils/response';

type ChildTrip = { countryId: string; from: string; to: string };
const tripOf = (q: Record<string, unknown>): ChildTrip => ({
  countryId: String(q.country || ''),
  from: String(q.from || ''),
  to: String(q.to || ''),
});

/** Card data for one possible parent. Another customer's names are masked and their DOBs never leave. */
async function describe(app: IApplication, trip: ChildTrip, own: boolean) {
  const eligibility = await checkParent(app, trip);
  const { from, to } = tripDates(app);
  const visa = app.visaType as unknown as { name?: string } | null;
  return {
    _id: app._id,
    referenceId: app.referenceId,
    visaName: visa?.name || '',
    status: app.status,
    from,
    to,
    own,
    adults: parentAdults(app).map(({ key, label, ref, name }) => ({ key, label, ref, name: own ? name : maskName(name) })),
    eligibility,
  };
}

/** The customer's own applications to the same country, each marked eligible or not with a reason. */
export const listParentCandidates = async (req: AuthRequest, res: Response): Promise<void> => {
  const trip = tripOf(req.query);
  if (!trip.countryId) { sendError(res, 'country is required'); return; }
  const apps = await Application.find({ user: req.user!._id, country: trip.countryId })
    .populate('visaType', 'name')
    .sort({ createdAt: -1 })
    .limit(20);
  sendSuccess(res, await Promise.all(apps.map((a) => describe(a, trip, true))));
};

async function findByQuery(raw: string): Promise<IApplication | null> {
  const q = raw.trim().toUpperCase();
  if (!q) return null;
  // An application number, a traveller's own ID under it, or a passport number off a scan.
  const byRef = await Application.findOne({ $or: [{ referenceId: q }, { 'travellers.ref': q }] }).populate('visaType', 'name');
  if (byRef) return byRef;
  if (!/^[A-Z][0-9]{7}$/.test(q)) return null;
  const doc = await Document.findOne({ 'extractedData.Passport No': q }).select('application');
  return doc ? Application.findById(doc.application).populate('visaType', 'name') : null;
}

/** Search by application ID (PRS-...) or the parent's passport number. */
export const lookupParent = async (req: AuthRequest, res: Response): Promise<void> => {
  const trip = tripOf(req.body || {});
  const app = await findByQuery(String(req.body?.query || ''));
  if (!app) { sendError(res, 'No application found for that ID or passport number', 404); return; }
  const own = String(app.user) === String(req.user!._id);
  sendSuccess(res, { ...(await describe(app, trip, own)), needsDob: !own });
};

/**
 * Another customer's application is only usable once the parent's date of birth matches
 * one of its adults, read from the passport answers or, failing that, the scan itself.
 */
export async function dobMatches(app: IApplication, dob: string): Promise<boolean> {
  const wanted = normalizeDob(dob);
  if (!wanted) return false;
  const adults = parentAdults(app);
  if (adults.some((a) => normalizeDob(a.dob) === wanted)) return true;
  const scans = await Document.find({ application: app._id, 'extractedData.Date of Birth': { $exists: true } }).select('extractedData requirementName');
  return scans.some((d) => {
    const isAdult = adults.some((a) => d.requirementName.startsWith(`${a.label} -`)) || !/^(Adult|Child) \d+/.test(d.requirementName);
    return isAdult && normalizeDob(String(d.extractedData?.get('Date of Birth') || '')) === wanted;
  });
}

export const verifyParent = async (req: AuthRequest, res: Response): Promise<void> => {
  const app = await Application.findById(String(req.body?.applicationId || ''));
  if (!app) { sendError(res, 'Application not found', 404); return; }
  if (!(await dobMatches(app, String(req.body?.dob || '')))) {
    sendError(res, "That date of birth doesn't match the parent on this application"); return;
  }
  await ParentVerification.create({ user: req.user!._id, application: app._id });
  sendSuccess(res, { verified: true });
};

/**
 * Validates the parent link sent with a child-only order and returns what to store.
 * Same rules as the cards the customer picked from, checked again here.
 */
export async function resolveParentLink(
  userId: unknown,
  input: unknown,
  trip: ChildTrip,
): Promise<{ link: IParentLink } | { error: string }> {
  const body = (input || {}) as { applicationId?: unknown; parents?: { key?: unknown; relation?: unknown }[] };
  const parent = await Application.findById(String(body.applicationId || ''));
  if (!parent) return { error: 'Link this child to a parent or guardian application first' };

  const eligibility = await checkParent(parent, trip);
  if (!eligibility.ok) return { error: eligibility.reason };
  // Another account's application must have been verified (rate-limited) beforehand.
  if (String(parent.user) !== String(userId) && !(await ParentVerification.exists({ user: userId, application: parent._id }))) {
    return { error: "Verify the parent's date of birth first" };
  }

  const adultKeys = parentAdults(parent).map((a) => a.key);
  const seen = new Set<string>();
  const parents = (Array.isArray(body.parents) ? body.parents : []).flatMap((p) => {
    const key = String(p?.key ?? '');
    const relation = String(p?.relation ?? '') as ParentRelation;
    if (!adultKeys.includes(key) || !PARENT_RELATIONS.includes(relation) || seen.has(key)) return [];
    seen.add(key);
    return [{ key, relation }];
  }).slice(0, 2);
  if (!parents.length) return { error: 'Choose which adult on that application is the parent or guardian' };

  return { link: { application: parent._id as IParentLink['application'], ref: parent.referenceId, parents, status: 'ok', reason: '', checkedAt: new Date() } };
}
