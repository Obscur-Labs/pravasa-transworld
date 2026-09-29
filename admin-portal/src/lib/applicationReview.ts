import { mergeFormItems } from '@/types';
import type { Application, Document, DocumentRequirement } from '@/types';

/**
 * Rebuilds the applicant's submitted form as a single ordered review list.
 *
 * Uploads and answers are authored as one interleaved sequence (see mergeFormItems),
 * and the applicant filled them in that order, so the reviewer reads them back in
 * that same order instead of hunting across a documents list and a separate answers
 * list for the same person.
 */
export type ReviewRow =
  | { kind: 'doc'; id: string; label: string; doc: Document }
  | { kind: 'missing'; id: string; label: string }
  | { kind: 'answer'; id: string; label: string; value: string };

const TRAVELER_RE = /^(Adult \d+|Child \d+)\s*[-–—]\s*/i;

/** "Adult 1, Full Name" → "Adult 1"; empty for application-wide keys. */
export function travelerOf(key: string): string {
  const m = key.match(TRAVELER_RE);
  return m ? m[1] : '';
}

export function stripTraveler(key: string): string {
  return key.replace(TRAVELER_RE, '');
}

// Response keys are written with dots stripped (Mongo Map keys can't hold them) and
// whitespace collapsed, so config labels only match after the same treatment.
const norm = (s: string) => s.replace(/\./g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// The apply form prepends an implicit Passport upload when a visa authors none.
// Mirrored here (order -1) so those front/back scans lead the review, exactly as
// they led the form, instead of falling to the bottom as unrecognised extras.
const DEFAULT_PASSPORT: DocumentRequirement = {
  name: 'Passport', description: '', required: true, applicantType: 'both', docType: 'passport', order: -1,
};

function withDefaultPassport(docs: DocumentRequirement[]): DocumentRequirement[] {
  const has = docs.some((d) => d.docType?.startsWith('passport') || d.name.toLowerCase().includes('passport'));
  return has ? docs : [DEFAULT_PASSPORT, ...docs];
}

const appliesTo = (applicantType: string | undefined, type: 'adult' | 'child') => {
  const t = applicantType || 'adult';
  return t === 'both' || t === type;
};

/** Traveller tabs present in the submission, adults first, then children, in number order. */
export function travelerTabs(application: Application | null, documents: Document[]): string[] {
  const set = new Set<string>();
  for (const d of documents) {
    const t = travelerOf(d.requirementName);
    if (t) set.add(t);
  }
  for (const k of Object.keys(application?.formResponses || {})) {
    const t = travelerOf(k);
    if (t) set.add(t);
  }
  return Array.from(set).sort((a, b) => {
    const aAdult = a.toLowerCase().startsWith('adult');
    const bAdult = b.toLowerCase().startsWith('adult');
    if (aAdult !== bAdult) return aAdult ? -1 : 1;
    return Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0);
  });
}

/** Answers belonging to the application as a whole (travel dates, …) rather than one traveller. */
export function generalAnswers(application: Application | null): [string, string][] {
  return Object.entries(application?.formResponses || {}).filter(([k]) => !travelerOf(k));
}

/**
 * Builds the ordered review list for one traveller. Pass '' for legacy applications
 * whose documents and answers carry no traveller prefix, everything then lands in
 * that single list.
 */
export function buildReviewRows(
  traveler: string,
  application: Application | null,
  documents: Document[],
): ReviewRow[] {
  if (!application) return [];

  const trType = traveler.toLowerCase().startsWith('child') ? 'child' : 'adult';
  const travDocs = documents.filter((d) => travelerOf(d.requirementName) === traveler);
  const travAnswers = Object.entries(application.formResponses || {})
    .filter(([k]) => travelerOf(k) === traveler)
    .map(([k, v]) => ({ label: stripTraveler(k), value: String(v) }));

  // Passport OCR values are shown under the scan they came from, and were also copied
  // into the answers at submit time. Drop that copy so each value is read once.
  const ocrKeys = new Set<string>();
  for (const d of travDocs) for (const k of Object.keys(d.extractedData || {})) ocrKeys.add(norm(k));

  const fields = (application.visaType?.formFields || []).filter((f) => appliesTo(f.applicantType, trType));
  const reqs = withDefaultPassport(application.visaType?.documentRequirements || [])
    .filter((d) => appliesTo(d.applicantType, trType));

  const usedDocs = new Set<string>();
  const usedAnswers = new Set<number>();
  const rows: ReviewRow[] = [];

  for (const item of mergeFormItems(fields, reqs)) {
    if (item.kind === 'document') {
      // A passport requirement yields two uploads ("… (Front)" / "… (Back)"), both of
      // which belong at this position.
      const name = norm(item.doc.name);
      const matches = travDocs.filter((d) => {
        if (usedDocs.has(d._id)) return false;
        const s = norm(stripTraveler(d.requirementName));
        return s === name || s.startsWith(`${name} (`);
      });
      for (const d of matches) {
        usedDocs.add(d._id);
        rows.push({ kind: 'doc', id: d._id, label: stripTraveler(d.requirementName), doc: d });
      }
      if (matches.length === 0 && item.doc.required) {
        rows.push({ kind: 'missing', id: `missing:${item.doc.name}`, label: item.doc.name });
      }
    } else {
      for (const q of [item.field, ...(item.field.subFields || [])]) {
        const label = norm(q.label || q.fieldName);
        const idx = travAnswers.findIndex((a, i) => !usedAnswers.has(i) && norm(a.label) === label);
        if (idx >= 0) {
          usedAnswers.add(idx);
          rows.push({ kind: 'answer', id: `a:${idx}`, label: travAnswers[idx].label, value: travAnswers[idx].value });
        }
      }
    }
  }

  // Uploads and answers the visa config no longer describes (extra documents the
  // applicant added, questions since removed) still have to be reviewable.
  for (const d of travDocs) {
    if (!usedDocs.has(d._id)) rows.push({ kind: 'doc', id: d._id, label: stripTraveler(d.requirementName), doc: d });
  }
  travAnswers.forEach((a, i) => {
    if (usedAnswers.has(i) || ocrKeys.has(norm(a.label))) return;
    rows.push({ kind: 'answer', id: `a:${i}`, label: a.label, value: a.value });
  });

  return rows;
}
