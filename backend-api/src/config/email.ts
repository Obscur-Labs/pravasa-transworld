import { BrevoClient } from '@getbrevo/brevo';

export const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY || '' });

/** Brevo's own error text, falling back to the generic message. */
export const brevoErrorDetail = (err: any) => err?.body?.message ?? err?.message ?? err;

// Two senders, because the two kinds of mail are not the same kind of message.
//
// Notifications (OTP, status updates, document decisions) are automated, go to customers,
// and end with "do not reply", a no-reply identity is correct for them.
//
// Embassy mail is written by a person, sent to a mission, and the whole point is that the
// mission replies. It goes out under its own identity so those replies land in a mailbox
// somebody actually reads, and so an embassy never sees "noreply@" on a letter asking for
// a response. Falls back to the notification sender when unset, so nothing breaks if the
// second address was never configured.
export const MAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Pravasa Transworld';
export const MAIL_FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || '';

export const EMBASSY_FROM_NAME = process.env.EMBASSY_EMAIL_FROM_NAME || MAIL_FROM_NAME;
export const EMBASSY_FROM_EMAIL = process.env.EMBASSY_EMAIL_FROM_ADDRESS || MAIL_FROM_EMAIL;

/** True when the embassy mail is riding on the notification sender rather than its own. */
export const EMBASSY_SENDER_IS_SHARED =
  EMBASSY_FROM_EMAIL.toLowerCase() === MAIL_FROM_EMAIL.toLowerCase();

export async function verifyMailConnection(): Promise<void> {
  console.log('[EMAIL] Verifying Brevo API connection...');
  console.log(`[EMAIL] Notifications from: ${MAIL_FROM_NAME} <${MAIL_FROM_EMAIL}>`);
  console.log(
    `[EMAIL] Embassy mail from  : ${EMBASSY_FROM_NAME} <${EMBASSY_FROM_EMAIL}>` +
      (EMBASSY_SENDER_IS_SHARED ? ' (shared; set EMBASSY_EMAIL_FROM_ADDRESS to separate them)' : '')
  );

  try {
    const account = await brevo.account.getAccount();
    console.log(`[EMAIL] Brevo connected, account: ${account.email} | plan: ${account.plan?.[0]?.type}`);
  } catch (err: any) {
    console.error('[EMAIL] Brevo API verification FAILED:', brevoErrorDetail(err));
    console.error('[EMAIL] Check BREVO_API_KEY in your env.');
    return;
  }

  // Brevo accepts a send from an unverified address (201 + messageId) and only rejects it
  // later, at the sending stage, so nothing in the request path can catch this. Every mail
  // then vanishes with no error anywhere but the Brevo event log. Check it once at boot.
  try {
    const { senders = [] } = await brevo.senders.getSenders();
    const known = senders.map((s) => s.email).join(', ') || '(none)';

    const checks: { label: string; envVar: string; address: string }[] = [
      { label: 'Notification sender', envVar: 'EMAIL_FROM_ADDRESS', address: MAIL_FROM_EMAIL },
    ];
    if (!EMBASSY_SENDER_IS_SHARED) {
      checks.push({ label: 'Embassy sender', envVar: 'EMBASSY_EMAIL_FROM_ADDRESS', address: EMBASSY_FROM_EMAIL });
    }

    for (const { label, envVar, address } of checks) {
      const match = senders.find((s) => s.email?.toLowerCase() === address.toLowerCase());
      if (!match) {
        console.error(`[EMAIL] ⚠ ${label} "${address}" is NOT a verified Brevo sender; those emails will be silently rejected.`);
        console.error(`[EMAIL] ⚠ Verified senders: ${known}`);
        console.error(`[EMAIL] ⚠ Fix ${envVar}, or verify this sender/domain in Brevo.`);
      } else if (!match.active) {
        console.error(`[EMAIL] ⚠ ${label} "${address}" exists but is not active in Brevo; sends will be rejected.`);
      } else {
        console.log(`[EMAIL] ${label} "${address}" is verified and active.`);
      }
    }
  } catch (err: any) {
    console.error('[EMAIL] Could not check verified senders:', brevoErrorDetail(err));
  }
}
