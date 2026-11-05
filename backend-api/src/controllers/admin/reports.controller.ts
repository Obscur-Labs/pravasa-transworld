import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import Payment from '../../models/Payment';
import Application from '../../models/Application';
import VisaFile from '../../models/VisaFile';
import ReceiptConfig from '../../models/ReceiptConfig';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess } from '../../utils/response';

/**
 * Revenue, GST register, B2B agent and processing-time reports over a date range.
 * Money comes from verified payments (by the date they were verified); each payment's
 * service fee and GST come from the price locked on its application.
 */

const DAY = 86400000;

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD in IST; defaults to the current month so far. */
function rangeOf(q: Record<string, unknown>) {
  const ist = (d: string, end = false) => new Date(`${d}T${end ? '23:59:59.999' : '00:00:00'}+05:30`);
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(q.from)) ? String(q.from) : `${today.slice(0, 8)}01`;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(q.to)) ? String(q.to) : today;
  return { from, to, start: ist(from), end: ist(to, true) };
}

type PaidRow = {
  _id: unknown;
  amount: number;
  discountApplied?: number;
  paidAt: Date;
  application: {
    _id: unknown; referenceId: string; adults: number; children: number;
    adultBase: number; adultVfs: number; adultFee: number; childBase: number; childVfs: number; childFee: number; gstAmount: number;
    country?: { name: string; flag: string } | null; visaType?: { name: string } | null;
  } | null;
  user: { _id: unknown; name: string; email: string; accountType?: string; corporateType?: string; gstNumber?: string } | null;
};

async function paidInRange(start: Date, end: Date): Promise<PaidRow[]> {
  return Payment.find({ status: 'completed', paidAt: { $gte: start, $lte: end } })
    .populate({
      path: 'application',
      select: 'referenceId adults children adultBase adultVfs adultFee childBase childVfs childFee gstAmount country visaType',
      populate: [{ path: 'country', select: 'name flag' }, { path: 'visaType', select: 'name' }],
    })
    .populate('user', 'name email accountType corporateType gstNumber')
    .sort({ paidAt: 1 })
    .lean() as unknown as Promise<PaidRow[]>;
}

/** The fee split of one payment: service fee (taxable), GST, and pass-through visa + VFS fees. */
function splitOf(p: PaidRow) {
  const a = p.application;
  if (!a) return { taxable: 0, gst: 0, passThrough: p.amount };
  const taxable = a.adults * (a.adultFee || 0) + a.children * (a.childFee || 0);
  const passThrough = a.adults * ((a.adultBase || 0) + (a.adultVfs || 0)) + a.children * ((a.childBase || 0) + (a.childVfs || 0));
  return { taxable, gst: a.gstAmount || 0, passThrough };
}

const addTo = (map: Map<string, { label: string; flag?: string; revenue: number; count: number }>, key: string, label: string, amount: number, flag?: string) => {
  const cur = map.get(key) ?? { label, flag, revenue: 0, count: 0 };
  cur.revenue += amount;
  cur.count += 1;
  map.set(key, cur);
};

export const getRevenueReport = async (req: AdminRequest, res: Response): Promise<void> => {
  const r = rangeOf(req.query);
  const rows = await paidInRange(r.start, r.end);
  const byCountry = new Map<string, { label: string; flag?: string; revenue: number; count: number }>();
  const byVisa = new Map<string, { label: string; revenue: number; count: number }>();
  const byDay = new Map<string, number>();
  let revenue = 0; let taxable = 0; let gst = 0; let passThrough = 0; let discounts = 0;

  for (const p of rows) {
    const s = splitOf(p);
    revenue += p.amount;
    taxable += s.taxable;
    gst += s.gst;
    passThrough += s.passThrough;
    discounts += p.discountApplied || 0;
    const c = p.application?.country;
    addTo(byCountry, c?.name || 'Unknown', c?.name || 'Unknown', p.amount, c?.flag);
    const v = p.application?.visaType?.name || 'Unknown';
    addTo(byVisa, `${c?.name}|${v}`, `${c?.name || ''} · ${v}`, p.amount);
    const day = new Date(new Date(p.paidAt).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + p.amount);
  }

  const trend: { date: string; revenue: number }[] = [];
  for (let t = r.start.getTime(); t <= r.end.getTime() && trend.length < 400; t += DAY) {
    const d = new Date(t + 5.5 * 3600000).toISOString().slice(0, 10);
    trend.push({ date: d, revenue: byDay.get(d) || 0 });
  }
  const sorted = <T extends { revenue: number }>(m: Map<string, T>) => [...m.values()].sort((a, b) => b.revenue - a.revenue);

  sendSuccess(res, {
    from: r.from, to: r.to,
    kpis: { revenue, payments: rows.length, taxable, gst, passThrough, discounts },
    byCountry: sorted(byCountry),
    byVisa: sorted(byVisa).slice(0, 15),
    trend,
  });
};

// GSTIN's first two digits are the state code. Same state as ours: CGST + SGST; else IGST.
async function gstRows(start: Date, end: Date) {
  const config = await ReceiptConfig.findOne().lean();
  const ourState = (config?.stateCode || '24').padStart(2, '0');
  const rows = await paidInRange(start, end);

  // Receipt numbers as printed: COUNTRY-APPNO-YY-SEQ, the sequence counting this application's verified payments.
  const seqOf = new Map<string, number>();
  const earlier = await Payment.aggregate([
    { $match: { status: 'completed', application: { $in: rows.map((r) => r.application?._id).filter(Boolean) } } },
    { $sort: { paidAt: 1 } },
    { $group: { _id: '$application', ids: { $push: '$_id' } } },
  ]);
  for (const e of earlier) (e.ids as unknown[]).forEach((id, i) => seqOf.set(String(id), i + 1));

  return rows.map((p) => {
    const a = p.application;
    const s = splitOf(p);
    const gstin = (p.user?.accountType === 'corporate' && p.user.gstNumber) ? p.user.gstNumber.toUpperCase() : '';
    const placeOfSupply = gstin ? gstin.slice(0, 2) : ourState;
    const intra = placeOfSupply === ourState;
    const half = Math.round((s.gst / 2) * 100) / 100;
    const paidAt = new Date(p.paidAt);
    return {
      invoice: `${(a?.country?.flag || 'XX').toUpperCase()}-${(a?.referenceId || '').split('-').pop() || '0000'}-${String(paidAt.getFullYear()).slice(-2)}-${String(seqOf.get(String(p._id)) || 1).padStart(3, '0')}`,
      date: paidAt.toISOString(),
      application: a?.referenceId || '',
      billedTo: p.user?.name || '',
      gstin,
      placeOfSupply,
      taxable: s.taxable,
      cgst: intra ? half : 0,
      sgst: intra ? s.gst - half : 0,
      igst: intra ? 0 : s.gst,
      exempt: s.passThrough,
      total: p.amount,
    };
  });
}

export const getGstRegister = async (req: AdminRequest, res: Response): Promise<void> => {
  const r = rangeOf(req.query);
  const rows = await gstRows(r.start, r.end);
  const sum = (k: 'taxable' | 'cgst' | 'sgst' | 'igst' | 'total') => rows.reduce((t, x) => t + x[k], 0);
  sendSuccess(res, {
    from: r.from, to: r.to, rows,
    totals: { taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'), igst: sum('igst'), total: sum('total'), b2b: rows.filter((x) => x.gstin).length },
  });
};

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  // A leading =, +, - or @ would run as a formula in Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The GST register as CSV, columns in the order GSTR-1 asks for them. */
export const downloadGstRegisterCsv = async (req: AdminRequest, res: Response): Promise<void> => {
  const r = rangeOf(req.query);
  const rows = await gstRows(r.start, r.end);
  const istDate = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
  const header = ['Invoice No', 'Invoice Date (IST)', 'Application', 'Billed To', 'GSTIN', 'Place of Supply', 'Taxable Value', 'CGST 9%', 'SGST 9%', 'IGST 18%', 'Visa/VFS fees (no GST)', 'Invoice Total'];
  const lines = [header, ...rows.map((x) => [x.invoice, istDate(x.date), x.application, x.billedTo, x.gstin, x.placeOfSupply, x.taxable, x.cgst, x.sgst, x.igst, x.exempt, x.total])]
    .map((cols) => cols.map(csvCell).join(','));
  logActivity(req, 'create', 'Report Export', `GST register ${r.from} to ${r.to} (${rows.length} invoices)`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="gst-register-${r.from}-to-${r.to}.csv"`);
  res.end(`﻿${lines.join('\r\n')}`);
};

/** Revenue and applications per B2B agent. */
export const getAgentReport = async (req: AdminRequest, res: Response): Promise<void> => {
  const r = rangeOf(req.query);
  const rows = (await paidInRange(r.start, r.end)).filter((p) => p.user?.corporateType === 'b2b_agent' && p.user.accountType === 'corporate');
  const byAgent = new Map<string, { agent: string; email: string; revenue: number; payments: number; serviceFees: number }>();
  for (const p of rows) {
    const key = String(p.user!._id);
    const cur = byAgent.get(key) ?? { agent: p.user!.name, email: p.user!.email, revenue: 0, payments: 0, serviceFees: 0 };
    cur.revenue += p.amount;
    cur.payments += 1;
    cur.serviceFees += splitOf(p).taxable;
    byAgent.set(key, cur);
  }
  sendSuccess(res, { from: r.from, to: r.to, agents: [...byAgent.values()].sort((a, b) => b.revenue - a.revenue) });
};

/** How long work takes: payment verification, and submission to visa delivered, per country. */
export const getSlaReport = async (req: AdminRequest, res: Response): Promise<void> => {
  const r = rangeOf(req.query);
  const verified = await Payment.find({ status: 'completed', verifiedAt: { $gte: r.start, $lte: r.end }, submittedAt: { $ne: null } })
    .select('submittedAt verifiedAt').lean();
  const hours = verified.map((p) => (new Date(p.verifiedAt!).getTime() - new Date(p.submittedAt!).getTime()) / 3600000).filter((h) => h >= 0);

  const delivered = await VisaFile.find({ createdAt: { $gte: r.start, $lte: r.end } }).select('application createdAt').lean();
  const apps = await Application.find({ _id: { $in: delivered.map((d) => d.application) } }).select('createdAt country').populate('country', 'name').lean();
  const appOf = new Map(apps.map((a) => [String(a._id), a]));
  const byCountry = new Map<string, number[]>();
  for (const d of delivered) {
    const a = appOf.get(String(d.application));
    if (!a) continue;
    const days = (new Date((d as unknown as { createdAt: Date }).createdAt).getTime() - new Date(a.createdAt).getTime()) / DAY;
    const name = (a.country as unknown as { name?: string })?.name || 'Unknown';
    byCountry.set(name, [...(byCountry.get(name) || []), days]);
  }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

  // Still open and older than a week, by where they are stuck.
  const stuck = await Application.aggregate([
    { $match: { status: { $nin: ['visa_delivered', 'visa_rejected'] }, createdAt: { $lt: new Date(Date.now() - 7 * DAY) } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  sendSuccess(res, {
    from: r.from, to: r.to,
    paymentVerificationHours: avg(hours),
    paymentsVerified: hours.length,
    deliveryDays: avg([...byCountry.values()].flat()),
    delivered: delivered.length,
    byCountry: [...byCountry.entries()].map(([country, xs]) => ({ country, avgDays: avg(xs), delivered: xs.length })).sort((a, b) => b.delivered - a.delivered),
    stuck: stuck.map((s) => ({ status: s._id as string, count: s.count as number })),
  });
};
