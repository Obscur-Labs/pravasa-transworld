/** Fills a traveller's form questions from the passport scan, and checks passport validity. */

/** "21/03/1990" (the OCR's DD/MM/YYYY) or "1990-03-21" to a local Date. */
export function parsePassportDate(value: string | undefined): Date | null {
  const s = String(value || '').trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Question label patterns, most specific first, and the passport value each takes.
const RULES: { re: RegExp; value: (pv: Record<string, string>) => string | undefined; date?: boolean }[] = [
  { re: /passport\s*(no|num)/i, value: (pv) => pv['Passport No.'] },
  { re: /(expiry|expiration)/i, value: (pv) => pv['Date of Expiry'], date: true },
  { re: /(date of issue|issue date|issued on)/i, value: (pv) => pv['Date of Issue'], date: true },
  { re: /place of issue/i, value: (pv) => pv['Place of Issue'] },
  { re: /(date of birth|birth date|\bdob\b)/i, value: (pv) => pv['Date of Birth'], date: true },
  { re: /place of birth/i, value: (pv) => pv['Place of Birth'] },
  { re: /(surname|last name|family name)/i, value: (pv) => pv['Surname'] },
  { re: /(given name|first name)/i, value: (pv) => pv['Given Name(s)'] },
  { re: /(full name|name as (per|in|on) passport|^name$|applicant name)/i,
    value: (pv) => [pv['Given Name(s)'], pv['Surname']].filter(Boolean).join(' ') },
  { re: /nationality/i, value: (pv) => pv['Nationality'] },
  { re: /(father|guardian)/i, value: (pv) => pv['Father / Legal Guardian'] },
  { re: /mother/i, value: (pv) => pv['Mother'] },
  { re: /spouse/i, value: (pv) => pv['Spouse'] },
  { re: /address/i, value: (pv) => pv['Address'] },
  { re: /(gender|\bsex\b)/i, value: (pv) => ({ M: 'Male', F: 'Female' } as Record<string, string>)[String(pv['Sex'] || '').trim().toUpperCase()[0]] || pv['Sex'] },
];

interface Question { fieldName: string; label: string; type: string; options?: string[] }

/** Answers for the traveller's still-empty questions that the passport can fill. */
export function passportPrefill(questions: Question[], pv: Record<string, string>, answered: (fieldName: string) => boolean) {
  const fills: Record<string, string> = {};
  for (const q of questions) {
    if (answered(q.fieldName) || q.type === 'file') continue;
    const rule = RULES.find((r) => r.re.test(q.label));
    let value = rule?.value(pv)?.trim();
    if (!rule || !value) continue;
    if (rule.date && q.type === 'date') {
      const d = parsePassportDate(value);
      if (!d) continue;
      value = iso(d);
    }
    if (q.type === 'select' || q.type === 'radio') {
      const match = (q.options || []).find((o) => o.toLowerCase() === value!.toLowerCase());
      if (!match) continue;
      value = match;
    }
    fills[q.fieldName] = value;
  }
  return fills;
}

/** Passport must stay valid for 3 months (Schengen) or 6 months (others) after the return date. */
export function passportValidityProblem(expiry: string | undefined, returnDate: string, schengen: boolean): string {
  const exp = parsePassportDate(expiry);
  const back = parsePassportDate(returnDate);
  if (!exp || !back) return '';
  const months = schengen ? 3 : 6;
  const needed = new Date(back);
  needed.setMonth(needed.getMonth() + months);
  if (exp >= needed) return '';
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `Passport expires ${fmt(exp)}. It must be valid until at least ${fmt(needed)} (${months} months after you return). Renew it before applying.`;
}

const SCHENGEN = ['austria', 'belgium', 'bulgaria', 'croatia', 'czech', 'denmark', 'estonia', 'finland', 'france', 'germany', 'greece',
  'hungary', 'iceland', 'italy', 'latvia', 'liechtenstein', 'lithuania', 'luxembourg', 'malta', 'netherlands', 'norway', 'poland',
  'portugal', 'romania', 'slovakia', 'slovenia', 'spain', 'sweden', 'switzerland', 'schengen'];
export const isSchengen = (countryName = '', visaName = '') =>
  SCHENGEN.some((c) => countryName.toLowerCase().includes(c) || visaName.toLowerCase().includes('schengen'));
