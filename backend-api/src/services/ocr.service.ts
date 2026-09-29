import { withGroq } from './groq.service';

// Groq retires vision models fairly often (llama-4-scout, then qwen3.6-27b), so keep this
// overridable from the environment without a redeploy.
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';

export interface ExtractedDocumentData {
  name?: string;
  dateOfBirth?: string;
  documentNumber?: string;
  nationality?: string;
  expiryDate?: string;
  address?: string;
  fatherName?: string;
  rawText: string;
  confidence: number;
}

export interface PassportExtraction {
  fields: Record<string, string>;
  rawText: string;
  confidence: number;
}

function detectMimeType(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp';
  return 'image/jpeg';
}

async function callGroqVision(imageBuffer: Buffer, prompt: string, temperature = 0): Promise<string> {
  const base64 = imageBuffer.toString('base64');
  const mimeType = detectMimeType(imageBuffer);

  const response = await withGroq('GROQ_VISION_API_KEY', (groq) => groq.chat.completions.create({
    model: VISION_MODEL,
    // Reasoning models burn the token budget on <think> traces and then wrap
    // the answer in prose — turn both off so we get bare JSON back.
    reasoning_effort: 'none',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
    temperature,
    max_tokens: 2048,
  } as any).catch((err: any) => {
    if (err?.status === 404) {
      console.error(`[OCR] Groq vision model "${VISION_MODEL}" is not available (likely retired). Set GROQ_VISION_MODEL to a current Groq vision model.`);
    }
    throw err;
  }));

  return response.choices[0]?.message?.content || '';
}

function extractJSON(text: string): Record<string, any> | null {
  // Strip reasoning traces and markdown fences before hunting for the object.
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  // Walk back from the end so a trailing brace inside a string can't truncate us.
  for (let end = cleaned.lastIndexOf('}'); end > start; end = cleaned.lastIndexOf('}', end - 1)) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      // keep shrinking
    }
  }
  return null;
}

function str(val: unknown): string | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const s = val.trim();
  return s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'n/a' ? s : undefined;
}

function confidenceFromFields(fields: Record<string, string>): number {
  const total = Object.keys(fields).length;
  return total === 0 ? 0 : Math.min(95, 60 + total * 5);
}

// ── General document OCR (Aadhar, PAN, Passport) ─────────────────────────────

const GENERAL_PROMPT = `You are an expert OCR system for Indian identity documents.
Examine this document image carefully and extract all visible information.
The document may be an Aadhar card, PAN card, passport, or similar ID.

Return ONLY a JSON object with these fields (omit any field you cannot read):
{
  "name": "full name as printed",
  "dateOfBirth": "date in DD/MM/YYYY format",
  "documentNumber": "the main ID number (Aadhar: 12 digits, PAN: 10 chars, Passport: letter+7 digits)",
  "nationality": "nationality if printed",
  "expiryDate": "expiry date in DD/MM/YYYY if present",
  "address": "full address if present",
  "fatherName": "father or guardian name if present",
  "rawText": "all readable text from the document concatenated"
}
Return ONLY the JSON, no explanation.`;

export async function extractFromDocument(buffer: Buffer): Promise<ExtractedDocumentData> {
  const raw = await callGroqVision(buffer, GENERAL_PROMPT);
  const json = extractJSON(raw);

  if (!json) {
    return { rawText: raw, confidence: 0 };
  }

  const result: ExtractedDocumentData = {
    rawText: str(json.rawText) || raw,
    confidence: confidenceFromFields(json),
  };

  if (str(json.name)) result.name = json.name.trim();
  if (str(json.dateOfBirth)) result.dateOfBirth = json.dateOfBirth.trim();
  if (str(json.documentNumber)) result.documentNumber = json.documentNumber.trim();
  if (str(json.nationality)) result.nationality = json.nationality.trim();
  if (str(json.expiryDate)) result.expiryDate = json.expiryDate.trim();
  if (str(json.address)) result.address = json.address.trim();
  if (str(json.fatherName)) result.fatherName = json.fatherName.trim();

  return result;
}

// ── Passport-specific OCR ─────────────────────────────────────────────────────

const PASSPORT_FRONT_PROMPT = `You are an expert passport OCR system specialising in Indian passports.

STRICT NAME EXTRACTION RULES — read carefully before extracting any name field:
- Indian passports print all names in CAPITAL LETTERS in English (Latin script).
- Extract ONLY the English printed text. Completely ignore any Hindi/Devanagari script — it appears next to or below the English name and must NOT be included.
- Names contain ONLY the letters A–Z and spaces. No numbers, no punctuation, no country codes, no gender codes (M/F).
- Short name parts are real names and must be kept in full: OM, SAI, RAM, DEV, JAI, ALI and similar.
- If you see stray 1–2 letter uppercase tokens after a name (e.g. "SHARMA FA", "KUMAR AS") that come from the Hindi text beside it, strip them, return only "SHARMA" / "KUMAR". Use MRZ line 1 to tell a real name part from such a fragment: real name parts appear in the MRZ.
- Take name spelling from the printed English text, cross-checked against MRZ line 1; use the MRZ to cross-verify passport number, DOB, expiry, and sex.

Extract the following from the FRONT page and return ONLY a JSON object (no explanation):
{
  "passportNo": "one letter followed by exactly 7 digits as printed (e.g. A1234567) — verify against MRZ line 2",
  "surname": "family name in CAPITAL LETTERS, English only, letters and spaces only",
  "givenNames": "given/first/middle name(s) in CAPITAL LETTERS, English only, letters and spaces only",
  "nationality": "as printed in English (e.g. INDIAN)",
  "dateOfBirth": "DD/MM/YYYY — verify against MRZ",
  "sex": "MALE or FEMALE",
  "placeOfBirth": "city and state of birth in CAPITAL LETTERS, separated by a comma (e.g. MUMBAI, MAHARASHTRA) — include both the city and the state/district as printed",
  "placeOfIssue": "city name in CAPITAL LETTERS",
  "dateOfIssue": "DD/MM/YYYY",
  "dateOfExpiry": "DD/MM/YYYY — verify against MRZ",
  "mrzLine1": "the first MRZ line exactly as printed, including every < character (e.g. P<INDSHARMA<<RAHUL<KUMAR<<<<)",
  "rawText": "all readable English text including both MRZ lines"
}`;

const PASSPORT_BACK_PROMPT = `You are an expert passport OCR system specialising in Indian passports.

STRICT NAME EXTRACTION RULES — read carefully before extracting any name field:
- Indian passports print all names in CAPITAL LETTERS in English (Latin script).
- Extract ONLY the English printed text. Completely ignore any Hindi/Devanagari script that appears near the name — do NOT include it.
- Names contain ONLY the letters A–Z and spaces. No numbers, no codes, no abbreviations.
- If you see stray 1–2 letter uppercase tokens after a name (e.g. "DEVI FA", "LAL AS") those are romanised Hindi fragments — strip them entirely.

Extract the following from the BACK page and return ONLY a JSON object (no explanation):
{
  "fatherName": "father/legal guardian full name — CAPITAL LETTERS, English only, letters and spaces only",
  "motherName": "mother full name — CAPITAL LETTERS, English only, letters and spaces only",
  "spouseName": "spouse name if present — CAPITAL LETTERS, English only, letters and spaces only; omit if not present",
  "address": "full residential address exactly as printed in English, in CAPITAL LETTERS",
  "rawText": "all readable English text from this page"
}`;

// Added when the applicant asks to scan again. The first pass runs at temperature 0, so an
// identical request would repeat the same misreading; this makes the second look different.
const RESCAN_NOTE = `

SECOND READING: a previous reading of this image contained mistakes. Re-read every field character by character.
Check the passport number, dates and names against the MRZ lines where present, and watch for commonly confused characters (0/O, 1/I, 5/S, 8/B, 2/Z).
If a field is genuinely unreadable, omit it rather than guessing.`;

export async function extractPassport(
  buffer: Buffer,
  side: 'front' | 'back',
  opts: { rescan?: boolean } = {}
): Promise<PassportExtraction> {
  const base = side === 'front' ? PASSPORT_FRONT_PROMPT : PASSPORT_BACK_PROMPT;
  const prompt = opts.rescan ? base + RESCAN_NOTE : base;
  const raw = await callGroqVision(buffer, prompt, opts.rescan ? 0.3 : 0);
  const json = extractJSON(raw);

  if (!json) {
    return { fields: {}, rawText: raw, confidence: 0 };
  }

  const fields: Record<string, string> = {};

  if (side === 'front') {
    if (str(json.passportNo)) fields['Passport No.'] = json.passportNo.trim().toUpperCase();
    const mrz = parseMrzNames(str(json.mrzLine1));
    const surname = str(json.surname) ? cleanPassportName(json.surname, mrz?.tokens) : '';
    const surnameFinal = completeFromMrz(surname, mrz?.surname);
    if (surnameFinal) fields['Surname'] = surnameFinal;
    const givenNames = str(json.givenNames) ? cleanPassportName(json.givenNames, mrz?.tokens) : '';
    const givenFinal = completeFromMrz(givenNames, mrz?.givenNames);
    if (givenFinal) fields['Given Name(s)'] = givenFinal;
    if (str(json.nationality)) fields['Nationality'] = json.nationality.trim().toUpperCase();
    if (str(json.dateOfBirth)) fields['Date of Birth'] = json.dateOfBirth.trim();
    if (str(json.sex)) fields['Sex'] = normalizeSex(json.sex);
    if (str(json.placeOfBirth)) fields['Place of Birth'] = json.placeOfBirth.trim().toUpperCase();
    if (str(json.placeOfIssue)) fields['Place of Issue'] = json.placeOfIssue.trim().toUpperCase();
    if (str(json.dateOfIssue)) fields['Date of Issue'] = json.dateOfIssue.trim();
    if (str(json.dateOfExpiry)) fields['Date of Expiry'] = json.dateOfExpiry.trim();
  } else {
    const fatherName = str(json.fatherName) ? cleanPassportName(json.fatherName) : '';
    if (fatherName) fields['Father / Legal Guardian'] = fatherName.toUpperCase();
    const motherName = str(json.motherName) ? cleanPassportName(json.motherName) : '';
    if (motherName) fields['Mother'] = motherName.toUpperCase();
    const spouseName = str(json.spouseName) ? cleanPassportName(json.spouseName) : '';
    if (spouseName) fields['Spouse'] = spouseName.toUpperCase();
    if (str(json.address)) fields['Address'] = json.address.trim().toUpperCase();
  }

  const rawText = str(json.rawText) || raw;
  return { fields, rawText, confidence: confidenceFromFields(fields) };
}

function normalizeSex(s: string): string {
  return /^m/i.test(s.trim()) ? 'MALE' : 'FEMALE';
}

interface MrzNames { surname: string; givenNames: string; tokens: Set<string> }

/**
 * Names from MRZ line 1 ("P<INDSHARMA<<RAHUL<KUMAR<<<<"). They are plain A-Z with no Hindi
 * text beside them, so they settle whether a short token is a real name part. Returns null
 * when the line is missing, malformed or truncated (no trailing filler), since a cut-off
 * MRZ name can't be trusted to be complete.
 */
function parseMrzNames(line?: string): MrzNames | null {
  const m = line?.replace(/\s+/g, '').toUpperCase().match(/^P[A-Z<][A-Z<]{3}([A-Z<]+)$/);
  if (!m || !m[1].endsWith('<')) return null;
  const [surnamePart, ...rest] = m[1].split('<<');
  const surname = surnamePart.replace(/</g, ' ').trim();
  const givenNames = rest.join(' ').replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  if (!surname) return null;
  return { surname, givenNames, tokens: new Set(`${surname} ${givenNames}`.split(' ').filter(Boolean)) };
}

/**
 * Uses the MRZ version when the printed reading dropped words the MRZ has (e.g. "OMKAR"
 * vs "OMKAR SAI"). Only adds missing words; if the two disagree otherwise, the printed
 * reading wins, because the MRZ read can be wrong too.
 */
function completeFromMrz(printed: string, fromMrz?: string): string {
  const p = printed.toUpperCase();
  if (!fromMrz) return p;
  const printedTokens = p.split(' ').filter(Boolean);
  const mrzTokens = fromMrz.split(' ').filter(Boolean);
  const printedIsSubset = printedTokens.every((t) => mrzTokens.includes(t));
  return printedIsSubset && mrzTokens.length > printedTokens.length ? fromMrz : p;
}

// Strips artifacts that commonly appear in Indian passport OCR:
// - Non-ASCII characters (romanised Devanagari fragments, e.g. "ā", "ī")
// - Any character that is not a Latin letter, space, hyphen, or apostrophe
// - Trailing 1–2 letter tokens ("FA", "AS") that are Hindi syllable remnants. Tokens found in
//   the MRZ name are real (OM, JO) and kept. Leading tokens are never stripped: "OM PRAKASH"
//   is a name, not an artifact.
function cleanPassportName(raw: string, keep?: Set<string>): string {
  // Drop non-ASCII (Devanagari leaking through vision model)
  let s = raw.replace(/[^\x00-\x7F]/g, ' ');
  // Keep only valid name characters
  s = s.replace(/[^A-Za-z '\-]/g, ' ');
  // Collapse whitespace
  s = s.trim().replace(/\s+/g, ' ');
  const tokens = s.split(' ');
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1].toUpperCase();
    if (last.length > 2 || keep?.has(last)) break;
    tokens.pop();
  }
  return tokens.join(' ');
}
