import Groq from 'groq-sdk';
import Country from '../models/Country';
import VisaType from '../models/VisaType';
import VisaConfigOption from '../models/VisaConfigOption';

// Separate key from OCR so content generation can't exhaust the passport-scanning quota.
const apiKey = () => process.env.GROQ_CONTENT_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim() || '';
const MODEL = process.env.GROQ_CONTENT_MODEL || 'openai/gpt-oss-120b';

let client: Groq | null = null;
const groq = () => (client ??= new Groq({ apiKey: apiKey() }));

export const isAiConfigured = () => !!apiKey();

type Length = 'tagline' | 'short' | 'medium';

interface Purpose {
  what: string;
  length: Length;
  format: string;
}

// Every field the admin portal can generate for, with what the text is for and how it is
// displayed. Kept server-side so the prompts can't be steered from the browser.
export const PURPOSES: Record<string, Purpose> = {
  'country.description': {
    what: 'a short description of this destination for the country list in the admin portal and website',
    length: 'short', format: 'One or two plain sentences.',
  },
  'country.heroTagline': {
    what: 'the hero tagline shown under the country name on its public visa page',
    length: 'tagline', format: 'A single evocative phrase about the destination, no full stop, no quotes.',
  },
  'country.overview': {
    what: 'the Overview card on the public country visa page: the destination and what applying for its visa with us is like',
    length: 'medium', format: 'One flowing paragraph, no line breaks, no bullets.',
  },
  'country.requirements': {
    what: 'the Visa Requirements card on the public country visa page: the documents and eligibility applicants generally need',
    length: 'medium', format: 'One short intro line, then 5 to 7 lines each starting with "• ". No headings.',
  },
  'country.processingInfo': {
    what: 'the Processing Information card on the public country visa page: timeline and stages the applicant goes through',
    length: 'medium', format: 'One short intro line, then 4 to 6 lines each starting with "• ". No headings.',
  },
  'country.tips': {
    what: 'the Tips for Applicants card on the public country visa page: practical advice and common mistakes to avoid',
    length: 'medium', format: '5 to 6 lines each starting with "• ". No intro, no headings.',
  },
  'country.faqAnswer': {
    what: 'the answer to one FAQ question on the public country visa page (the question is in the context)',
    length: 'short', format: 'Two to four plain sentences that directly answer the question.',
  },
  'visaType.description': {
    what: 'the short description of this visa type shown on its card and summary',
    length: 'short', format: 'One or two plain sentences.',
  },
  'visaType.additionalNotes': {
    what: 'the Additional Notes applicants read before applying for this visa type',
    length: 'medium', format: 'Short paragraphs or lines starting with "• " where a list reads better. No headings.',
  },
};

const LENGTH_RULE: Record<Length, string> = {
  tagline: 'At most 10 words.',
  short: 'Between 20 and 45 words.',
  medium: 'Between 90 and 150 words.',
};

const SYSTEM_PROMPT = `You write website and admin content for Pravasa Transworld, an Indian visa and immigration services company whose customers are mostly Indian travellers.

Rules:
- Use only the facts in the provided context. Never invent fees, prices, processing times, validity, document lists, embassy rules, success rates or guarantees. If a detail is not given, write around it generally (e.g. "processing times vary") instead of guessing.
- Never state a rule, permission or restriction that is not in the context, even if it is commonly true: for example whether a visa can be extended or converted, passport validity requirements, arrival or immigration procedures, work or study rights. If the text needs such a point, say applicants should confirm it with the Pravasa Transworld team.
- Visa rules differ by country and change often, so prefer "usually" or "check with our team" over absolute statements about anything the context does not say.
- Do not mention prices or amounts; they change and are shown elsewhere.
- Clear, warm, professional Indian English. Plain text only: no markdown, no asterisks, no headings, no emojis, no hashtags.
- Do not start with the field name or a title, and do not wrap the answer in quotes.
- If current text is provided, improve and rewrite it, keeping any facts it states.
- Output only the content itself.`;

type Context = Record<string, unknown>;

/** Facts the page doesn't hold itself: the country's live visa types, with readable labels. */
async function countryFacts(countryId: string): Promise<Context> {
  const [country, visaTypes, options] = await Promise.all([
    Country.findById(countryId).select('name description').lean<{ name: string; description?: string }>(),
    VisaType.find({ country: countryId, isActive: true })
      .select('name visaCategory visaSubType processingTime validity stayDuration entry description')
      .sort({ order: 1 })
      .lean(),
    VisaConfigOption.find({ isActive: true }).select('category value label').lean(),
  ]);
  if (!country) return {};
  const label = (category: string, value?: string) =>
    options.find((o) => o.category === category && o.value === value)?.label || value;

  return {
    country: country.name,
    countryDescription: country.description,
    visaTypesOffered: visaTypes.map((v) => ({
      name: v.name,
      category: label('visaCategory', v.visaCategory),
      type: label('visaSubType', v.visaSubType),
      processingTime: v.processingTime,
      validity: v.validity,
      stayDuration: v.stayDuration,
      entry: (v.entry || []).map((e: string) => label('entryType', e)),
    })),
  };
}

/** Drops empty values so the model isn't handed blanks to fill in. */
function compact(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(compact).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Context)
      .map(([k, v]) => [k, compact(v)] as const)
      .filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (typeof value === 'string') return value.trim() ? value.trim().slice(0, 2000) : undefined;
  return value ?? undefined;
}

function clean(text: string, length: Length): string {
  let out = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .trim();
  out = out
    .replace(/[‐‑‒]/g, '-') // typographic hyphens
    .replace(/\s+[–—]\s+/g, ', ') // dashes used as punctuation; the house style avoids them
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[ \t]+$/gm, '');
  if (/^["'“].*["'”]$/s.test(out)) out = out.slice(1, -1).trim();
  if (length === 'tagline') out = out.replace(/[.\s]+$/, '');
  return out;
}

export async function generateContent(opts: {
  purpose: string;
  context: Context;
  currentText?: string;
  countryId?: string;
}): Promise<string> {
  const purpose = PURPOSES[opts.purpose];
  if (!purpose) throw Object.assign(new Error('Unknown content field'), { status: 400 });

  const facts = opts.countryId ? await countryFacts(opts.countryId) : {};
  const context = compact({ ...facts, ...opts.context }) || {};
  const current = opts.currentText?.trim();

  const userPrompt = [
    `Write ${purpose.what}.`,
    `Length: ${LENGTH_RULE[purpose.length]}`,
    `Format: ${purpose.format}`,
    `Context (JSON):\n${JSON.stringify(context, null, 2)}`,
    current ? `Current text to improve:\n${current.slice(0, 3000)}` : '',
  ].filter(Boolean).join('\n\n');

  const response = await groq().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.6,
    max_completion_tokens: 2048,
    // gpt-oss reasons before answering; low effort keeps it quick for short copy.
    ...(MODEL.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
  } as any);

  const text = clean(response.choices[0]?.message?.content || '', purpose.length);
  if (!text) throw Object.assign(new Error('The AI returned an empty answer. Please try again.'), { status: 502 });
  return text;
}
