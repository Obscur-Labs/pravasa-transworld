import * as Brevo from '@getbrevo/brevo';
import {
  emailApi, MAIL_FROM_NAME, MAIL_FROM_EMAIL, EMBASSY_FROM_NAME, EMBASSY_FROM_EMAIL,
} from '../config/email';

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
`;

const header = (title: string) => `
  <div style="background: #0B2E3D; padding: 32px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Pravasa Transworld</h1>
    <p style="color: #DFC29A; margin: 8px 0 0; font-size: 14px;">${title}</p>
  </div>
`;

const footer = () => `
  <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="color: #64748b; font-size: 12px; margin: 0;">
      © ${new Date().getFullYear()} Pravasa Transworld. All rights reserved.<br/>
      This is an automated message, please do not reply.
    </p>
  </div>
`;

/** Extras only the embassy mail needs — the templated notifications never set these. */
interface MailExtras {
  cc?: string[];
  replyTo?: string;
  /** Base64-encoded file contents, as Brevo expects them. */
  attachments?: { name: string; content: string }[];
  /** Overrides the no-reply notification identity. Must be a verified Brevo sender. */
  from?: { name: string; email: string };
}

async function sendMail(to: string, subject: string, html: string, label: string, extras: MailExtras = {}): Promise<void> {
  const sender = extras.from ?? { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL };
  console.log(`[EMAIL:${label}] Preparing to send → ${to} | From: ${sender.email} | Subject: "${subject}"`);

  const email = new Brevo.SendSmtpEmail();
  email.sender = sender;
  email.to = [{ email: to }];
  email.subject = subject;
  email.htmlContent = html;
  if (extras.cc?.length) email.cc = extras.cc.map((address) => ({ email: address }));
  if (extras.replyTo) email.replyTo = { email: extras.replyTo };
  if (extras.attachments?.length) email.attachment = extras.attachments;

  try {
    const { body } = await emailApi.sendTransacEmail(email);
    console.log(`[EMAIL:${label}] Sent successfully → messageId: ${body.messageId}`);
  } catch (err: any) {
    const status = err?.response?.statusCode;
    const detail = err?.response?.body?.message ?? err?.message ?? err;
    console.error(`[EMAIL:${label}] FAILED for ${to}`);
    console.error(`[EMAIL:${label}] Status: ${status} | Detail: ${detail}`);
    throw err;
  }
}

export async function sendOTPEmail(email: string, name: string, otp: string): Promise<void> {
  console.log(`[OTP] Generating OTP email for ${email} (name: ${name})`);
  await sendMail(
    email,
    'Your Pravasa Transworld Login OTP',
    `
      <div style="${baseStyle}">
        ${header('Secure Login')}
        <div style="padding: 40px 32px;">
          <p style="color: #061E27; font-size: 16px; margin: 0 0 16px;">Hi ${name},</p>
          <p style="color: #475569; font-size: 15px; margin: 0 0 32px;">
            Use the OTP below to log into your Pravasa Transworld account. It expires in 10 minutes.
          </p>
          <div style="background: #EFF7FB; border: 2px dashed #165874; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 32px;">
            <p style="color: #165874; font-size: 42px; font-weight: 800; letter-spacing: 12px; margin: 0;">${otp}</p>
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">
            If you didn't request this OTP, please ignore this email.
          </p>
        </div>
        ${footer()}
      </div>
    `,
    'OTP'
  );
}

export async function sendDocumentStatusEmail(
  email: string,
  name: string,
  status: 'approved' | 'rejected',
  reason?: string,
  referenceId?: string
): Promise<void> {
  console.log(`[DOC_STATUS] Sending document ${status} email → ${email} | ref: ${referenceId}`);
  const isApproved = status === 'approved';
  await sendMail(
    email,
    isApproved ? 'Documents Approved - Proceed to Payment' : 'Document Revision Required',
    `
      <div style="${baseStyle}">
        ${header(isApproved ? 'Documents Approved' : 'Document Revision Required')}
        <div style="padding: 40px 32px;">
          <p style="color: #061E27; font-size: 16px; margin: 0 0 16px;">Hi ${name},</p>
          ${isApproved ? `
            <p style="color: #475569; font-size: 15px; margin: 0 0 16px;">
              Great news! Your documents for application <strong>${referenceId}</strong> have been approved.
            </p>
            <p style="color: #475569; font-size: 15px; margin: 0 0 32px;">
              Please log in to complete your payment and continue the visa processing.
            </p>
            <a href="${frontendUrl}/applications" style="display: inline-block; background: #165874; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Make Payment
            </a>
          ` : `
            <p style="color: #475569; font-size: 15px; margin: 0 0 16px;">
              Some documents for application <strong>${referenceId}</strong> need to be re-uploaded.
            </p>
            ${reason ? `<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin: 0 0 24px;">
              <p style="color: #dc2626; font-size: 14px; margin: 0;"><strong>Reason:</strong> ${reason}</p>
            </div>` : ''}
            <a href="${frontendUrl}/applications" style="display: inline-block; background: #165874; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Re-upload Documents
            </a>
          `}
        </div>
        ${footer()}
      </div>
    `,
    'DOC_STATUS'
  );
}

export async function sendStatusUpdateEmail(
  email: string,
  name: string,
  statusLabel: string,
  referenceId: string
): Promise<void> {
  console.log(`[APP_STATUS] Sending status update "${statusLabel}" → ${email} | ref: ${referenceId}`);
  await sendMail(
    email,
    `Application Update: ${statusLabel}`,
    `
      <div style="${baseStyle}">
        ${header('Application Status Update')}
        <div style="padding: 40px 32px;">
          <p style="color: #061E27; font-size: 16px; margin: 0 0 16px;">Hi ${name},</p>
          <p style="color: #475569; font-size: 15px; margin: 0 0 16px;">
            Your visa application <strong>${referenceId}</strong> status has been updated.
          </p>
          <div style="background: #EFF7FB; border-radius: 8px; padding: 20px; margin: 0 0 32px; text-align: center;">
            <p style="color: #165874; font-size: 18px; font-weight: 700; margin: 0;">${statusLabel}</p>
          </div>
          <a href="${frontendUrl}/applications" style="display: inline-block; background: #165874; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            View Application
          </a>
        </div>
        ${footer()}
      </div>
    `,
    'APP_STATUS'
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Forwards an application to an embassy or agency.
 *
 * Unlike the notification mails above, this one is written by a person and read by one:
 * the body goes out exactly as composed (pre-wrap keeps the aligned detail blocks), and
 * the footer invites a reply instead of warning against it, because the reply is the
 * whole point.
 */
export async function sendEmbassyMail(opts: {
  to: string;
  cc?: string[];
  replyTo?: string;
  subject: string;
  body: string;
  attachments?: { name: string; content: string }[];
  companyName?: string;
}): Promise<void> {
  const { to, cc, subject, body, attachments } = opts;
  const companyName = opts.companyName || EMBASSY_FROM_NAME;
  // The mission's reply has to reach a person. Fall back to the embassy sender itself
  // rather than leaving it to the provider's default.
  const replyTo = opts.replyTo || EMBASSY_FROM_EMAIL;
  console.log(`[EMBASSY_MAIL] ${attachments?.length || 0} attachment(s) → ${to} | reply-to: ${replyTo}`);

  await sendMail(
    to,
    subject,
    `
      <div style="${baseStyle}">
        <div style="padding: 32px;">
          <pre style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #061E27; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(body)}</pre>
        </div>
        <div style="background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">
            Sent by ${escapeHtml(companyName)}. Please reply to this email for any clarification.
          </p>
        </div>
      </div>
    `,
    'EMBASSY_MAIL',
    { cc, replyTo, attachments, from: { name: EMBASSY_FROM_NAME, email: EMBASSY_FROM_EMAIL } }
  );
}

export async function sendVisaDeliveredEmail(
  email: string,
  name: string,
  referenceId: string,
  applicationId: string
): Promise<void> {
  // Links to the dashboard, never to the file: an emailed file link outlives its expiry
  // and works for anyone the mail is forwarded to.
  const downloadUrl = `${frontendUrl}/applications/${applicationId}`;
  console.log(`[VISA_DELIVERED] Sending visa ready email → ${email} | ref: ${referenceId}`);
  await sendMail(
    email,
    'Your Visa is Ready for Download!',
    `
      <div style="${baseStyle}">
        ${header('Visa Delivered')}
        <div style="padding: 40px 32px;">
          <p style="color: #061E27; font-size: 16px; margin: 0 0 16px;">Hi ${name},</p>
          <p style="color: #475569; font-size: 15px; margin: 0 0 16px;">
            Congratulations! Your visa for application <strong>${referenceId}</strong> is ready.
          </p>
          <p style="color: #475569; font-size: 15px; margin: 0 0 32px;">
            Sign in to your dashboard to view and download it.
          </p>
          <a href="${downloadUrl}" style="display: inline-block; background: #16a34a; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Download Visa
          </a>
        </div>
        ${footer()}
      </div>
    `,
    'VISA_DELIVERED'
  );
}
