import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import User from '../../models/User';
import Application from '../../models/Application';
import AgentLedger from '../../models/AgentLedger';
import { agentBalance, agentStatement } from '../../utils/agentLedger';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';
import { sendInquiryReplyEmail, customerAppUrl } from '../../services/email.service';

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const DAY = 86400000;
const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : NaN;
};
const AGENT = { accountType: 'corporate', corporateType: 'b2b_agent' };
const inr = (n: number) => `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Every agent with limit, what they owe, recent volume and status, plus the page KPIs. */
export const getAgents = async (_req: AdminRequest, res: Response): Promise<void> => {
  const agents = await User.find(AGENT).sort({ createdAt: 1 }).lean();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const since30 = new Date(Date.now() - 30 * DAY);
  const rows = await Promise.all(agents.map(async (a) => {
    const used = await agentBalance(a._id);
    const apps30 = await Application.countDocuments({ user: a._id, createdAt: { $gte: since30 } });
    const limit = a.creditLimit || 0;
    const pct = limit ? Math.round((used / limit) * 100) : 0;
    const status = a.agentPaused ? 'paused' : limit && used > limit ? 'over_limit' : limit && pct >= 90 ? 'near_limit' : 'active';
    return {
      _id: a._id, name: a.name, email: a.email, phone: a.phone, agentCode: a.agentCode || '', city: a.city || '', contactPerson: a.contactPerson || '',
      gstNumber: a.gstNumber || '', creditLimit: limit, commissionPct: a.commissionPct || 0, paymentTermsDays: a.paymentTermsDays ?? 15,
      used, pct, apps30, status, createdAt: a.createdAt,
    };
  }));
  const commission = await AgentLedger.aggregate([{ $match: { kind: 'commission', date: { $gte: monthStart } } }, { $group: { _id: null, t: { $sum: '$credit' } } }]);
  sendSuccess(res, {
    agents: rows,
    kpis: {
      active: rows.filter((r) => r.status !== 'paused').length,
      addedThisMonth: rows.filter((r) => new Date(r.createdAt) >= monthStart).length,
      creditExtended: rows.reduce((s, r) => s + r.creditLimit, 0),
      outstanding: rows.reduce((s, r) => s + Math.max(0, r.used), 0),
      commissionThisMonth: commission[0]?.t || 0,
      avgCommission: rows.length ? Math.round((rows.reduce((s, r) => s + r.commissionPct, 0) / rows.length) * 10) / 10 : 0,
    },
  });
};

/** Validated agent fields shared by create and update. */
function agentFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (body.name !== undefined) out.name = String(body.name).trim().slice(0, 120);
  if (body.contactPerson !== undefined) out.contactPerson = String(body.contactPerson).trim().slice(0, 120);
  if (body.city !== undefined) out.city = String(body.city).trim().slice(0, 80);
  if (body.phone !== undefined) {
    const d = String(body.phone).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(d)) return { error: 'Enter a 10-digit Indian mobile number' };
    out.phone = `+91 ${d}`;
  }
  if (body.gstNumber !== undefined) {
    const g = String(body.gstNumber).trim().toUpperCase();
    if (g && !GSTIN_RE.test(g)) return { error: 'GSTIN should look like 24ABCDE1234F1Z5' };
    out.gstNumber = g;
  }
  if (body.creditLimit !== undefined) {
    const n = num(body.creditLimit, 0, 1e9);
    if (Number.isNaN(n)) return { error: 'Credit limit must be a number' };
    out.creditLimit = Math.round(n);
  }
  if (body.commissionPct !== undefined) {
    const n = num(body.commissionPct, 0, 30);
    if (Number.isNaN(n)) return { error: 'Commission must be between 0 and 30%' };
    out.commissionPct = n;
  }
  if (body.paymentTermsDays !== undefined) out.paymentTermsDays = num(body.paymentTermsDays, 0, 90) || 0;
  if (body.agentPaused !== undefined) out.agentPaused = !!body.agentPaused;
  return { fields: out };
}

export const createAgent = async (req: AdminRequest, res: Response): Promise<void> => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { sendError(res, 'Enter a valid email'); return; }
  if (!String(req.body?.name || '').trim()) { sendError(res, 'Agency name is required'); return; }
  if (await User.exists({ email })) { sendError(res, 'An account with this email already exists; turn it into an agent from Customers'); return; }
  const parsed = agentFields(req.body || {});
  if ('error' in parsed) { sendError(res, parsed.error as string); return; }
  const count = await User.countDocuments({ agentCode: { $exists: true, $ne: '' } });
  const agent = await User.create({ ...parsed.fields, email, ...AGENT, agentCode: `AGT-${1020 + count}` });
  if (req.body?.sendLogin !== false) {
    sendInquiryReplyEmail({
      email, name: String(req.body.contactPerson || agent.name),
      body: `Your Pravasa Transworld B2B agent account for ${agent.name} is ready. Sign in with this email address; we send a one-time code each time. Your credit limit is ${inr(agent.creditLimit || 0)} with ${agent.paymentTermsDays ?? 15}-day payment terms.`,
      link: customerAppUrl('/login'), linkLabel: 'Sign in',
    }).catch((err) => console.error('Agent welcome email failed', err));
  }
  logActivity(req, 'create', 'B2B Agent', `${agent.agentCode} ${agent.name}`);
  sendSuccess(res, agent, 'Agent created', 201);
};

export const updateAgent = async (req: AdminRequest, res: Response): Promise<void> => {
  const parsed = agentFields(req.body || {});
  if ('error' in parsed) { sendError(res, parsed.error as string); return; }
  const agent = await User.findOneAndUpdate({ _id: req.params.id, ...AGENT }, { $set: parsed.fields }, { new: true });
  if (!agent) { sendError(res, 'Agent not found', 404); return; }
  logActivity(req, 'update', 'B2B Agent', `${agent.agentCode || ''} ${agent.name}`.trim());
  sendSuccess(res, agent, 'Agent updated');
};

function range(q: Record<string, unknown>) {
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(q.to)) ? new Date(`${q.to}T23:59:59+05:30`) : new Date();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(q.from)) ? new Date(`${q.from}T00:00:00+05:30`) : new Date(to.getTime() - 30 * DAY);
  return { from, to };
}

export const getStatement = async (req: AdminRequest, res: Response): Promise<void> => {
  const agent = await User.findOne({ _id: req.params.id, ...AGENT }).lean();
  if (!agent) { sendError(res, 'Agent not found', 404); return; }
  const { from, to } = range(req.query);
  const statement = await agentStatement(agent._id, from, to);
  const lastInvoice = statement.lines.filter((l) => l.kind === 'invoice').pop();
  const dueBy = lastInvoice ? new Date(new Date(lastInvoice.date).getTime() + (agent.paymentTermsDays ?? 15) * DAY) : null;
  sendSuccess(res, { agent: { _id: agent._id, name: agent.name, agentCode: agent.agentCode, creditLimit: agent.creditLimit || 0, email: agent.email }, from, to, dueBy, ...statement });
};

/** The same statement as a CSV that opens in Excel. */
export const exportStatementCsv = async (req: AdminRequest, res: Response): Promise<void> => {
  const agent = await User.findOne({ _id: req.params.id, ...AGENT }).lean();
  if (!agent) { sendError(res, 'Agent not found', 404); return; }
  const { from, to } = range(req.query);
  const s = await agentStatement(agent._id, from, to);
  const day = (d: Date) => new Date(new Date(d).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['Date', 'Particulars', 'Reference', 'Debit', 'Credit', 'Balance'],
    [day(from), 'Opening balance', '', '', '', s.opening],
    ...s.lines.map((l) => [day(l.date), l.description, l.reference, l.debit || '', l.credit || '', l.balance]),
    [day(to), 'Closing balance', '', s.invoiced, s.received, s.closing],
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="statement-${agent.agentCode || agent._id}-${day(to)}.csv"`);
  res.send('﻿' + lines.map((r) => r.map(esc).join(',')).join('\n'));
};

/** Emails the agent a summary of the period with a link to their statement page. */
export const emailStatement = async (req: AdminRequest, res: Response): Promise<void> => {
  const agent = await User.findOne({ _id: req.params.id, ...AGENT }).lean();
  if (!agent) { sendError(res, 'Agent not found', 404); return; }
  const { from, to } = range(req.body || {});
  const s = await agentStatement(agent._id, from, to);
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const lines = s.lines.map((l) => `${fmt(new Date(l.date))}  ${l.description}  ${l.debit ? `+${inr(l.debit)}` : `-${inr(l.credit)}`}`).join('\n');
  await sendInquiryReplyEmail({
    email: agent.email, name: agent.contactPerson || agent.name,
    body: `Here is your statement for ${fmt(from)} to ${fmt(to)}.\n\nOpening balance: ${inr(s.opening)}\nInvoiced: ${inr(s.invoiced)}\nReceived: ${inr(s.received)}\nClosing balance: ${inr(s.closing)}${lines ? `\n\n${lines}` : ''}`,
    link: customerAppUrl('/agent'), linkLabel: 'Open my statement',
  });
  logActivity(req, 'update', 'B2B Agent', `${agent.agentCode || agent.name}: statement emailed`);
  sendSuccess(res, null, 'Statement emailed');
};

export const recordAgentPayment = async (req: AdminRequest, res: Response): Promise<void> => {
  const agent = await User.findOne({ _id: req.params.id, ...AGENT });
  if (!agent) { sendError(res, 'Agent not found', 404); return; }
  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  if (!(amount > 0)) { sendError(res, 'Enter the amount received'); return; }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date)) ? new Date(`${req.body.date}T12:00:00+05:30`) : new Date();
  const mode = String(req.body?.mode || 'NEFT').slice(0, 30);
  const reference = String(req.body?.reference || '').trim().slice(0, 60);
  const entry = await AgentLedger.create({
    agent: agent._id, date, kind: 'payment', credit: amount, reference,
    description: `Payment received - ${mode}${reference ? ` ${reference}` : ''}`, by: req.admin?.name || '',
  });
  logActivity(req, 'create', 'B2B Agent', `${agent.agentCode || agent.name}: payment ${inr(amount)} recorded`);
  sendSuccess(res, entry, 'Payment recorded', 201);
};

/** Credits each agent's commission for a month on that month's invoices; a month posts once per agent. */
export const postCommission = async (req: AdminRequest, res: Response): Promise<void> => {
  const period = /^\d{4}-\d{2}$/.test(String(req.body?.month)) ? String(req.body.month) : '';
  if (!period) { sendError(res, 'Pick a month'); return; }
  const start = new Date(`${period}-01T00:00:00+05:30`);
  const end = new Date(start); end.setMonth(end.getMonth() + 1);
  const agents = await User.find({ ...AGENT, commissionPct: { $gt: 0 } }).lean();
  let posted = 0;
  for (const a of agents) {
    if (await AgentLedger.exists({ agent: a._id, kind: 'commission', period })) continue;
    const [row] = await AgentLedger.aggregate([{ $match: { agent: a._id, kind: 'invoice', date: { $gte: start, $lt: end } } }, { $group: { _id: null, t: { $sum: '$debit' } } }]);
    const amount = Math.round(((row?.t || 0) * (a.commissionPct || 0)) / 100);
    if (!amount) continue;
    await AgentLedger.create({ agent: a._id, date: new Date(), kind: 'commission', credit: amount, period, description: `Commission credit (${period}, ${a.commissionPct}%)`, by: req.admin?.name || '' });
    posted++;
  }
  logActivity(req, 'create', 'B2B Agent', `Commission for ${period} posted to ${posted} agents`);
  sendSuccess(res, { posted }, posted ? `Commission posted for ${posted} agent${posted === 1 ? '' : 's'}` : 'Nothing new to post for that month');
};
