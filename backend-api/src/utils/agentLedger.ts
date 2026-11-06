import mongoose from 'mongoose';
import AgentLedger from '../models/AgentLedger';

/** What the agent owes right now (debits minus credits), optionally only before a date. */
export async function agentBalance(agentId: unknown, before?: Date): Promise<number> {
  const match: Record<string, unknown> = { agent: new mongoose.Types.ObjectId(String(agentId)) };
  if (before) match.date = { $lt: before };
  const [row] = await AgentLedger.aggregate([{ $match: match }, { $group: { _id: null, d: { $sum: '$debit' }, c: { $sum: '$credit' } } }]);
  return Math.round(((row?.d || 0) - (row?.c || 0)) * 100) / 100;
}

/** Ledger lines between two dates with a running balance, plus the totals a statement shows. */
export async function agentStatement(agentId: unknown, from: Date, to: Date) {
  const opening = await agentBalance(agentId, from);
  const rows = await AgentLedger.find({ agent: agentId, date: { $gte: from, $lte: to } }).sort({ date: 1, createdAt: 1 }).lean();
  let balance = opening;
  const lines = rows.map((r) => {
    balance = Math.round((balance + r.debit - r.credit) * 100) / 100;
    return { _id: r._id, date: r.date, kind: r.kind, description: r.description, reference: r.reference, debit: r.debit, credit: r.credit, balance };
  });
  const invoiced = rows.reduce((s, r) => s + r.debit, 0);
  const received = rows.reduce((s, r) => s + r.credit, 0);
  return { opening, invoiced, received, closing: balance, lines };
}
