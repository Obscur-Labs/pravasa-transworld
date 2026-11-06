import mongoose, { Document, Schema } from 'mongoose';

/** One line of a B2B agent's account: invoices raise what they owe, payments and commission lower it. */
export interface IAgentLedger extends Document {
  agent: mongoose.Types.ObjectId;
  date: Date;
  kind: 'invoice' | 'payment' | 'commission' | 'adjustment';
  description: string;
  debit: number;
  credit: number;
  application: mongoose.Types.ObjectId | null;
  reference: string;
  /** For commission lines, the month it covers ("2026-10"), so a month is posted once. */
  period: string;
  by: string;
}

const AgentLedgerSchema = new Schema<IAgentLedger>(
  {
    agent: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true },
    kind: { type: String, enum: ['invoice', 'payment', 'commission', 'adjustment'], required: true },
    description: { type: String, default: '' },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    application: { type: Schema.Types.ObjectId, ref: 'Application', default: null },
    reference: { type: String, default: '' },
    period: { type: String, default: '' },
    by: { type: String, default: '' },
  },
  { timestamps: true }
);

AgentLedgerSchema.index({ agent: 1, date: 1 });

export default mongoose.model<IAgentLedger>('AgentLedger', AgentLedgerSchema);
