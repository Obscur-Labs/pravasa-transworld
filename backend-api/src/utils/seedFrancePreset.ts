import 'dotenv/config';
import { connectDB } from '../config/database';
import FormPreset from '../models/FormPreset';

// France Schengen form from the single-page apply spec: employment and marital status
// questions drive which supporting documents each traveller is asked for. Safe to re-run;
// it overwrites the preset of the same name.
const NAME = 'France Schengen (Tourist)';

type Who = 'adult' | 'child' | 'both';
type Row =
  | { kind: 'field'; label: string; fieldName: string; type: string; options?: string[]; applicantType?: Who; required?: boolean }
  | { kind: 'doc'; name: string; description?: string; docType?: string; applicantType?: Who; required?: boolean;
      fileTypes?: string[]; maxSizeMb?: number; showWhen?: { field: string; values: string[] } };

const PDF_IMG = ['pdf', 'jpg', 'png'];
const employed = (...values: string[]) => ({ field: 'employmentStatus', values });

const rows: Row[] = [
  { kind: 'doc', name: 'Passport Front', docType: 'passport_front', applicantType: 'both', fileTypes: PDF_IMG, maxSizeMb: 5,
    description: 'Valid for at least 3 months after your return date' },
  { kind: 'doc', name: 'Passport Back', docType: 'passport_back', applicantType: 'both', fileTypes: PDF_IMG, maxSizeMb: 5 },
  { kind: 'doc', name: 'Photo', docType: 'photo', applicantType: 'both', fileTypes: ['jpg', 'png'], maxSizeMb: 2,
    description: '35 x 45 mm, white background, face clearly visible' },

  { kind: 'field', label: 'Employment Status', fieldName: 'employmentStatus', type: 'radio',
    options: ['Employed', 'Self-employed', 'Student', 'Retired', 'Unemployed'] },
  { kind: 'doc', name: 'Salary Slips (last 3 months)', fileTypes: PDF_IMG, showWhen: employed('Employed') },
  { kind: 'doc', name: 'NOC or Leave Letter from Employer', fileTypes: PDF_IMG, showWhen: employed('Employed') },
  { kind: 'doc', name: 'GST or Business Registration', fileTypes: PDF_IMG, showWhen: employed('Self-employed') },
  { kind: 'doc', name: 'Business Bank Statement (6 months)', fileTypes: PDF_IMG, showWhen: employed('Self-employed') },
  { kind: 'doc', name: 'ITR (last 3 years)', fileTypes: PDF_IMG, showWhen: employed('Employed', 'Self-employed') },
  { kind: 'doc', name: 'Student ID', fileTypes: PDF_IMG, showWhen: employed('Student') },
  { kind: 'doc', name: 'NOC from School or College', fileTypes: PDF_IMG, showWhen: employed('Student') },
  { kind: 'doc', name: 'Pension Proof', fileTypes: PDF_IMG, showWhen: employed('Retired') },

  { kind: 'field', label: 'Marital Status', fieldName: 'maritalStatus', type: 'radio',
    options: ['Single', 'Married', 'Divorced', 'Widowed'] },
  { kind: 'doc', name: 'Marriage Certificate', fileTypes: PDF_IMG, showWhen: { field: 'maritalStatus', values: ['Married'] } },

  { kind: 'doc', name: 'Birth Certificate', applicantType: 'child', fileTypes: PDF_IMG },
  { kind: 'doc', name: "Parents' Passport Copies", applicantType: 'child', fileTypes: PDF_IMG },
  { kind: 'doc', name: 'NOC from Non-travelling Parent', applicantType: 'child', fileTypes: PDF_IMG, required: false,
    description: 'Only if one parent is travelling with the child' },

  { kind: 'doc', name: 'Personal Bank Statement (6 months)', fileTypes: PDF_IMG },
  { kind: 'doc', name: 'Flight Booking', applicantType: 'both', fileTypes: PDF_IMG, description: 'Dates must match your travel dates' },
  { kind: 'doc', name: 'Hotel Booking', applicantType: 'both', fileTypes: PDF_IMG, description: 'Covering every night of the stay' },
  { kind: 'doc', name: 'Travel Insurance', applicantType: 'both', fileTypes: PDF_IMG, description: 'Schengen-wide cover of at least EUR 30,000' },
];

async function seedFrancePreset() {
  await connectDB();
  const formFields: object[] = [];
  const documentRequirements: object[] = [];
  rows.forEach((row, order) => {
    if (row.kind === 'field') {
      formFields.push({ label: row.label, fieldName: row.fieldName, type: row.type, options: row.options || [],
        required: row.required ?? true, placeholder: '', applicantType: row.applicantType || 'adult', subFields: [], order });
    } else {
      documentRequirements.push({ name: row.name, description: row.description || '', required: row.required ?? true,
        applicantType: row.applicantType || 'adult', docType: row.docType || 'custom',
        ocrEnabled: row.docType === 'passport_front' || row.docType === 'passport_back',
        fileTypes: row.fileTypes || [], maxSizeMb: row.maxSizeMb, showWhen: row.showWhen || null, order });
    }
  });

  await FormPreset.updateOne(
    { name: NAME },
    { $set: { description: 'Employment and marital status decide the supporting documents.', formFields, documentRequirements } },
    { upsert: true },
  );
  console.log(`Saved preset "${NAME}": ${formFields.length} questions, ${documentRequirements.length} documents`);
  process.exit(0);
}

seedFrancePreset().catch((err) => {
  console.error(err);
  process.exit(1);
});
