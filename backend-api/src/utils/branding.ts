import ReceiptConfig from '../models/ReceiptConfig';

export interface Branding {
  logoUrl: string;
  primary: string;
  accent: string;
  font: string;
}

export const DEFAULT_BRANDING: Branding = { logoUrl: '', primary: '#0B2E3D', accent: '#9F7437', font: 'Inter' };
export const BRAND_FONTS = ['Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'];
export const HEX_RE = /^#[0-9a-f]{6}$/i;

// Emails and receipts read this on every send, so it is cached briefly and dropped on save.
let cached: { at: number; value: Branding } | null = null;

export async function getBranding(): Promise<Branding> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const c = await ReceiptConfig.findOne().select('logoUrl brandPrimary brandAccent brandFont').lean();
  const value: Branding = {
    logoUrl: c?.logoUrl || '',
    primary: HEX_RE.test(c?.brandPrimary || '') ? c!.brandPrimary : DEFAULT_BRANDING.primary,
    accent: HEX_RE.test(c?.brandAccent || '') ? c!.brandAccent : DEFAULT_BRANDING.accent,
    font: BRAND_FONTS.includes(c?.brandFont || '') ? c!.brandFont : DEFAULT_BRANDING.font,
  };
  cached = { at: Date.now(), value };
  return value;
}

export const clearBrandingCache = () => { cached = null; };

/**
 * Templates are written in the default navy and gold; this swaps in the saved colours and
 * font, and puts the logo in the header in place of the plain wordmark.
 */
export function applyBrandingToHtml(html: string, b: Branding): string {
  let out = html
    .replace(/#0B2E3D|#165874/gi, b.primary)
    .replace(/#DFC29A|#9F7437/gi, b.accent)
    .replace(/font-family: -apple-system/g, `font-family: '${b.font}', -apple-system`);
  if (b.logoUrl) {
    out = out.replace(
      /<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Pravasa Transworld<\/h1>/,
      `<img src="${b.logoUrl}" alt="Pravasa Transworld" style="max-height: 56px; max-width: 240px; background: #ffffff; border-radius: 8px; padding: 6px 10px;" />`,
    );
  }
  return out;
}
