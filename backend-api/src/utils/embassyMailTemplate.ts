import { IApplication } from '../models/Application';
import { IDocument } from '../models/Document';

/**
 * Fills the saved embassy-mail template with one application's data.
 *
 * The result is plain text and lands in the composer for the admin to edit before
 * sending, so everything here is written to be readable as-is, the mail that goes out
 * is exactly the text they approved, rendered with its line breaks preserved.
 *
 * Unknown placeholders are deliberately left untouched: a typo like {{referenceID}}
 * then shows up in the draft, where it can still be fixed, rather than silently
 * vanishing from a mail already on its way to an embassy.
 */

export interface Placeholder {
  token: string;
  description: string;
}

/** Advertised to the config page, so the documented tokens are always the working ones. */
export const PLACEHOLDERS: Placeholder[] = [
  { token: 'referenceId', description: 'Application number, e.g. PRS-GEN-1234' },
  { token: 'applicantName', description: 'Name on the account that applied' },
  { token: 'applicantEmail', description: 'Applicant email address' },
  { token: 'applicantPhone', description: 'Applicant phone number' },
  { token: 'country', description: 'Destination country' },
  { token: 'visaType', description: 'Visa type applied for' },
  { token: 'travellers', description: 'e.g. 2 adults, 1 child' },
  { token: 'travelDates', description: 'Travel date, or the date range if both were given' },
  { token: 'travelDate', description: 'Travel start date only' },
  { token: 'travelEndDate', description: 'Travel end date only' },
  { token: 'adults', description: 'Number of adults' },
  { token: 'children', description: 'Number of children' },
  { token: 'embassyName', description: 'Embassy name recorded on the application' },
  { token: 'processingReference', description: 'Embassy reference number, once entered' },
  { token: 'submissionDate', description: 'Date submitted to the embassy' },
  { token: 'expectedDate', description: 'Expected decision date' },
  { token: 'formData', description: 'Only the form details ticked in the composer, grouped per traveller' },
  { token: 'documentList', description: 'The documents attached to this mail' },
  { token: 'companyName', description: 'Your company name, from Receipt Config' },
  { token: 'status', description: 'Current application status' },
  { token: 'today', description: "Today's date" },
];

const TRAVELER_RE = /^(Adult \d+|Child \d+)\s*[-–—]\s*/i;

/** "Adult 1, Full Name" → "Adult 1"; empty for answers that belong to the trip. */
function travelerOf(key: string): string {
  const m = key.match(TRAVELER_RE);
  return m ? m[1] : '';
}

function stripTraveler(key: string): string {
  return key.replace(TRAVELER_RE, '');
}

function sortTravelers(a: string, b: string): number {
  const aAdult = a.toLowerCase().startsWith('adult');
  const bAdult = b.toLowerCase().startsWith('adult');
  if (aAdult !== bAdult) return aAdult ? -1 : 1;
  return Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0);
}

/** One answer from the form, offered to the composer as its own tickable line. */
export interface FormDetail {
  /** The original formResponses key, what the composer ticks and untickss by. */
  key: string;
  /** "Adult 1", "Child 1", or empty for answers that belong to the trip as a whole. */
  group: string;
  /** The key with its traveller prefix removed, e.g. "Passport Number". */
  label: string;
  value: string;
  /**
   * Whether the draft opens with this detail in it. Trip-wide answers are, since they
   * describe the application itself; each traveller's personal answers are not, so a
   * passport number only reaches an embassy because someone chose to send it.
   */
  selected: boolean;
}

/** Every answer on the application, trip-wide first, then adults, then children. */
export function listFormDetails(application: IApplication): FormDetail[] {
  const responses = application.formResponses instanceof Map
    ? Array.from(application.formResponses.entries())
    : Object.entries((application.formResponses || {}) as Record<string, string>);

  return responses
    .map(([key, value]) => {
      const group = travelerOf(key);
      return { key, group, label: stripTraveler(key), value: String(value ?? ''), selected: !group };
    })
    .sort((a, b) => {
      if (!a.group !== !b.group) return a.group ? 1 : -1;
      return a.group ? sortTravelers(a.group, b.group) : 0;
    });
}

/**
 * The chosen details as an indented block, one group per traveller.
 *
 * Takes an already-filtered list rather than the application, so the column width lines
 * up with what is actually going out instead of with answers that were left behind.
 */
export function formatFormData(details: FormDetail[]): string {
  if (details.length === 0) return '(no details included)';

  const labelWidth = Math.max(...details.map((d) => d.label.length));

  const groups = new Map<string, FormDetail[]>();
  for (const detail of details) {
    if (!groups.has(detail.group)) groups.set(detail.group, []);
    groups.get(detail.group)!.push(detail);
  }

  return Array.from(groups.entries())
    .map(([group, rows]) => {
      const lines = rows
        .map((d) => `  ${d.label.padEnd(labelWidth)} : ${d.value}`)
        .join('\n');
      return group ? `${group}\n${lines}` : lines;
    })
    .join('\n\n');
}

/** The documents going out with this mail, in the order they will be attached. */
export function formatDocumentList(documents: IDocument[]): string {
  if (documents.length === 0) return '(no documents attached)';
  return documents.map((d) => `  - ${d.requirementName}`).join('\n');
}

export function renderTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : whole
  );
}
