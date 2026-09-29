import mongoose, { Document, Schema } from 'mongoose';

// Singleton, always exactly one document, upserted via findOneAndUpdate({}, ...).
// Holds the house style for the covering mail an admin sends to an embassy or agency
// when forwarding an application. Placeholders ({{referenceId}}, {{formData}}, …) are
// filled in when the composer opens; see utils/embassyMailTemplate.
export interface IEmbassyMailConfig extends Document {
  subjectTemplate: string;
  bodyTemplate: string;
  /** Always copied in, your own processing desk, usually. Comma-separated. */
  defaultCc: string;
  /** Where the embassy's reply should land, if not the sending address. */
  replyTo: string;
}

export const DEFAULT_SUBJECT_TEMPLATE =
  'Visa Application {{referenceId}}: {{visaType}} for {{country}}';

export const DEFAULT_BODY_TEMPLATE = `Dear Sir / Madam,

Please find below the details of a visa application submitted through {{companyName}}, along with the applicant's supporting documents attached to this email.

Application Number : {{referenceId}}
Visa Type          : {{visaType}}
Destination        : {{country}}
Travellers         : {{travellers}}
Travel Dates       : {{travelDates}}

APPLICANT
{{applicantName}}
{{applicantEmail}} | {{applicantPhone}}

SUBMITTED DETAILS
{{formData}}

DOCUMENTS ATTACHED
{{documentList}}

We request you to kindly process this application. Please reply to this email should any further document or clarification be required.

Regards,
{{companyName}}
{{today}}`;

const EmbassyMailConfigSchema = new Schema<IEmbassyMailConfig>(
  {
    subjectTemplate: { type: String, default: DEFAULT_SUBJECT_TEMPLATE },
    bodyTemplate: { type: String, default: DEFAULT_BODY_TEMPLATE },
    defaultCc: { type: String, default: '' },
    replyTo: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model<IEmbassyMailConfig>('EmbassyMailConfig', EmbassyMailConfigSchema);
