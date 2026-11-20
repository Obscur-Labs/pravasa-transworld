import mongoose, { Schema } from 'mongoose';

/** Customer email for a trigger: a status change, or the review request after delivery. */
const MessageTemplateSchema = new Schema(
  {
    trigger: { type: String, required: true, unique: true },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    enabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);
export const MessageTemplate = mongoose.models.MessageTemplate || mongoose.model('MessageTemplate', MessageTemplateSchema);

export const TRIGGERS: { key: string; label: string; subject: string; body: string }[] = [
  { key: 'payment_completed', label: 'Payment received', subject: 'Payment received for {{app_id}}',
    body: 'Namaste {{name}},\n\nWe have verified your payment for the {{country}} {{visa}} application {{app_id}}. Our team will check your documents next.\n\nTrack it here: {{link}}' },
  { key: 'documents_under_review', label: 'Documents in review', subject: 'We are checking your documents ({{app_id}})',
    body: 'Namaste {{name}},\n\nOur team is checking the documents for {{app_id}}. If anything is missing we will tell you straight away.\n\n{{link}}' },
  { key: 'documents_approved', label: 'Documents approved', subject: 'Documents approved for {{app_id}}',
    body: 'Namaste {{name}},\n\nYour documents for {{app_id}} are approved and being prepared for the embassy.\n\n{{link}}' },
  { key: 'visa_processing', label: 'Sent to embassy', subject: '{{app_id}} has been sent to the embassy',
    body: 'Namaste {{name}},\n\nYour {{country}} visa application {{app_id}} has been sent to the embassy. We will update you as soon as we hear back.\n\n{{link}}' },
  { key: 'embassy_review', label: 'Embassy reviewing', subject: 'The embassy is reviewing {{app_id}}',
    body: 'Namaste {{name}},\n\nThe embassy is now reviewing your application {{app_id}}.\n\n{{link}}' },
  { key: 'visa_approved', label: 'Visa approved', subject: 'Your {{country}} visa is approved',
    body: 'Namaste {{name}},\n\nGreat news: your {{country}} {{visa}} for {{app_id}} is approved. We will send it to you shortly.\n\n{{link}}' },
  { key: 'visa_rejected', label: 'Visa rejected', subject: 'Update on your {{country}} visa ({{app_id}})',
    body: 'Namaste {{name}},\n\nUnfortunately the embassy did not approve {{app_id}}. Reason: {{reason}}\n\nOur team will contact you about next steps.\n\n{{link}}' },
  { key: 'visa_delivered', label: 'Visa delivered', subject: 'Your {{country}} visa has been delivered',
    body: 'Namaste {{name}},\n\nYour visa for {{app_id}} has been delivered. Have a great trip!\n\n{{link}}' },
  { key: 'feedback_request', label: 'Feedback request', subject: 'How did we do with your {{country}} visa?',
    body: 'Namaste {{name}},\n\nThank you for applying with Pravasa Transworld. Could you spare a minute to review us? Use your application ID {{app_id}} on this page: {{review_link}}' },
];

export const VARIABLES = ['name', 'app_id', 'country', 'visa', 'status', 'reason', 'link', 'review_link'];

export const render = (text: string, vars: Record<string, string>) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));

/** The saved template for a trigger when it is switched on, otherwise null (the built-in email is used). */
export async function activeTemplate(trigger: string): Promise<{ subject: string; body: string } | null> {
  const t = await MessageTemplate.findOne({ trigger, enabled: true }).lean<{ subject: string; body: string }>();
  return t && t.subject.trim() && t.body.trim() ? t : null;
}
