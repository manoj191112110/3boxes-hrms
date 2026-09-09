/**
 * Email service using Resend (https://resend.com)
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  RESEND DOMAIN VERIFICATION — READ THIS BEFORE CONFIGURING EMAILS  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                    ║
 * ║  Resend requires you to VERIFY the domain you send emails from.    ║
 * ║  If you use an unverified domain as the FROM address, the send     ║
 * ║  will fail with a domain verification error.                       ║
 * ║                                                                    ║
 * ║  The sandbox sender (onboarding@resend.dev) works WITHOUT domain   ║
 * ║  verification, but it has a critical limitation: it can ONLY send  ║
 * ║  emails to the email address registered with your Resend account.  ║
 * ║  This means real employees will NOT receive emails sent via the    ║
 * ║  sandbox — only you (the Resend account holder) will.              ║
 * ║                                                                    ║
 * ║  TO FIX EMAIL DELIVERY:                                            ║
 * ║  1. Go to https://resend.com/domains                               ║
 * ║  2. Add and verify your sending domain (e.g. yourcompany.com)      ║
 * ║  3. Set RESEND_FROM_EMAIL=noreply@yourcompany.com in env vars      ║
 * ║  4. Redeploy — emails will now be delivered to any recipient       ║
 * ║                                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Environment variables:
 *  - RESEND_API_KEY        (required) Your Resend API key
 *  - RESEND_FROM_EMAIL     (optional) Verified sending address, e.g. noreply@yourcompany.com
 *                          If set AND the domain is verified in Resend, this takes precedence.
 *                          If not set, defaults to the Resend sandbox sender.
 *  - EMAIL_FROM            (deprecated) Legacy env var — still supported but RESEND_FROM_EMAIL
 *                          takes precedence. Avoid using this for new deployments.
 *
 * FROM address resolution order:
 *  1. Explicit `from` parameter passed to sendEmail()
 *  2. RESEND_FROM_EMAIL env var (if set — admin is responsible for verifying the domain)
 *  3. EMAIL_FROM env var (legacy — same caveat about domain verification)
 *  4. onboarding@resend.dev (Resend sandbox — only sends to the account holder's email)
 */

import { Resend } from 'resend';

/** Resend's default sandbox domain — works without domain verification, but ONLY sends to the account holder's email */
const RESEND_SANDBOX_FROM = 'onboarding@resend.dev';

let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (resend) return resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[EmailService] RESEND_API_KEY not set — emails will be logged only.');
    return null;
  }
  resend = new Resend(apiKey);
  return resend;
}

/**
 * Determine the best FROM address for outgoing emails.
 *
 * Resolution order:
 *  1. RESEND_FROM_EMAIL env var (preferred — admin should set this to a verified domain address)
 *  2. EMAIL_FROM env var (legacy fallback)
 *  3. onboarding@resend.dev (Resend sandbox — CAN ONLY deliver to the Resend account holder's email)
 *
 * IMPORTANT: Using the sandbox sender means real recipients will NOT receive emails.
 * The admin MUST verify a domain in Resend and set RESEND_FROM_EMAIL for production use.
 */
export function getEmailFromAddress(): string {
  // Preferred: admin has explicitly configured a verified sending address
  if (process.env.RESEND_FROM_EMAIL) {
    return process.env.RESEND_FROM_EMAIL;
  }

  // Legacy: EMAIL_FROM was the old env var name — still supported
  if (process.env.EMAIL_FROM) {
    return process.env.EMAIL_FROM;
  }

  // Default: Resend sandbox sender.
  // WARNING: This can ONLY send to the email address registered with the Resend account.
  // Real employees will NOT receive emails from this address.
  return RESEND_SANDBOX_FROM;
}

/**
 * Check if an error is a domain / sender verification error from Resend.
 * These errors occur when the FROM address domain has not been verified in Resend.
 */
function isDomainVerificationError(error: unknown): boolean {
  if (!error) return false;

  // Resend returns errors as objects with a `message` and sometimes `name`
  const err = error as Record<string, unknown> | null;

  if (err?.message && typeof err.message === 'string') {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('domain') ||
      msg.includes('verified') ||
      msg.includes('sender') ||
      msg.includes('not found') ||
      msg.includes('from address') ||
      msg.includes('validation_error')
    ) {
      return true;
    }
  }

  // Some Resend SDK errors expose a `name` field
  if (err?.name && typeof err.name === 'string') {
    const name = err.name.toLowerCase();
    if (name.includes('validation') || name.includes('forbidden')) {
      return true;
    }
  }

  return false;
}

/**
 * Log the full Resend error response for debugging.
 * This helps admins understand exactly why an email failed — e.g. which
 * domain is unverified, what the API responded with, etc.
 */
function logResendError(context: string, error: unknown): void {
  console.error(`[EmailService] ${context}`);
  console.error('[EmailService] Full Resend error response:', JSON.stringify(error, null, 2));

  // Also try to extract the most useful fields for quick scanning
  const err = error as Record<string, unknown> | null;
  if (err?.message) {
    console.error(`[EmailService] Error message: ${err.message}`);
  }
  if (err?.name) {
    console.error(`[EmailService] Error name: ${err.name}`);
  }
  if (err?.statusCode) {
    console.error(`[EmailService] HTTP status: ${err.statusCode}`);
  }
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  /** true if the email was sent using the Resend sandbox (onboarding@resend.dev)
   *  instead of the admin's configured FROM address. This usually means the
   *  admin's domain is not verified in Resend, and the email was ONLY delivered
   *  to the Resend account holder's email — NOT to the intended recipient. */
  usedFallbackFrom: boolean;
  /** If the sandbox sender was used, this is set to warn that the email
   *  was only delivered to the Resend account holder, not the actual recipient. */
  sandboxWarning?: string;
}

/**
 * Send an email via Resend.
 *
 * If the primary FROM address triggers a domain-verification error, the function
 * automatically retries using onboarding@resend.dev and returns
 * { usedFallbackFrom: true, sandboxWarning: "..." } so the caller can inform
 * the admin that the email was only delivered to the Resend account holder.
 */
export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const { to, subject, html, from } = params;

  // Resolve the FROM address: explicit param > RESEND_FROM_EMAIL > EMAIL_FROM > sandbox
  const sender = from || getEmailFromAddress();

  const client = getResendClient();

  if (!client) {
    // Dev mode: no API key — just log the email details so the flow doesn't break
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    console.log(`[EmailService DEV] To: ${recipients} | Subject: ${subject}`);
    console.log(`[EmailService DEV] From: ${sender}`);
    // In dev mode, we consider it "sent" so the UI flow doesn't break.
    // Not a fallback scenario — there's no API key at all.
    return { success: true, usedFallbackFrom: false };
  }

  // If the resolved sender is already the sandbox, skip the primary attempt
  // and go straight to sandbox send (no point trying and failing first).
  if (sender === RESEND_SANDBOX_FROM) {
    return await sendWithSandbox(client, { to, subject, html }, true);
  }

  try {
    const result = await client.emails.send({
      from: sender,
      to,
      subject,
      html,
    });

    // Resend SDK v2+ returns { data, error } — check for API-level errors
    if (result.error) {
      logResendError(`Primary send failed from "${sender}"`, result.error);

      // If this is a domain/sender verification error, retry with sandbox
      if (isDomainVerificationError(result.error)) {
        console.warn(
          `[EmailService] ⚠️  Domain verification failed for "${sender}".`,
        );
        console.warn(
          `[EmailService] ⚠️  ADMIN ACTION REQUIRED: Verify your domain at https://resend.com/domains`,
        );
        console.warn(
          `[EmailService] ⚠️  Then set RESEND_FROM_EMAIL=noreply@your-verified-domain.com`,
        );
        console.warn(
          `[EmailService] Retrying with sandbox sender ${RESEND_SANDBOX_FROM}...`,
        );
        return await sendWithSandbox(client, { to, subject, html }, false);
      }

      const errorMsg =
        (result.error as Record<string, unknown>)?.message?.toString() || 'Resend send failed';
      return { success: false, error: errorMsg, usedFallbackFrom: false };
    }

    const recipients = Array.isArray(to) ? to.join(', ') : to;
    console.log(
      `[EmailService] ✉️  Email sent to ${recipients} — Subject: "${subject}" — From: "${sender}"`,
    );
    return { success: true, usedFallbackFrom: false };
  } catch (err) {
    logResendError(`Exception during primary send from "${sender}"`, err);

    // If this looks like a domain verification error, retry with sandbox
    if (isDomainVerificationError(err)) {
      console.warn(
        `[EmailService] ⚠️  Domain verification exception for "${sender}".`,
      );
      console.warn(
        `[EmailService] ⚠️  ADMIN ACTION REQUIRED: Verify your domain at https://resend.com/domains`,
      );
      console.warn(
        `[EmailService] ⚠️  Then set RESEND_FROM_EMAIL=noreply@your-verified-domain.com`,
      );
      console.warn(
        `[EmailService] Retrying with sandbox sender ${RESEND_SANDBOX_FROM}...`,
      );
      return await sendWithSandbox(client, { to, subject, html }, false);
    }

    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message, usedFallbackFrom: false };
  }
}

/**
 * Internal: attempt to send using the Resend sandbox FROM address.
 *
 * @param isPrimarySandbox - true if the sandbox was the resolved FROM address
 *   from the start (i.e. no RESEND_FROM_EMAIL/EMAIL_FROM was configured),
 *   false if we fell back to sandbox after a domain verification failure.
 */
async function sendWithSandbox(
  client: Resend,
  params: { to: string | string[]; subject: string; html: string },
  isPrimarySandbox: boolean,
): Promise<SendEmailResult> {
  const { to, subject, html } = params;

  const sandboxWarning =
    'Email was sent via Resend sandbox (onboarding@resend.dev). ' +
    'Sandbox emails can ONLY be delivered to the email address registered with your Resend account. ' +
    'The intended recipient likely did NOT receive this email. ' +
    'To fix: verify your domain at https://resend.com/domains and set RESEND_FROM_EMAIL.';

  try {
    const result = await client.emails.send({
      from: RESEND_SANDBOX_FROM,
      to,
      subject,
      html,
    });

    if (result.error) {
      logResendError(`Sandbox send also failed`, result.error);
      const errorMsg =
        (result.error as Record<string, unknown>)?.message?.toString() ||
        'Resend send failed (sandbox retry)';
      return { success: false, error: errorMsg, usedFallbackFrom: true, sandboxWarning };
    }

    const recipients = Array.isArray(to) ? to.join(', ') : to;
    if (isPrimarySandbox) {
      console.warn(
        `[EmailService] ⚠️  Email sent via sandbox (no verified FROM configured) to ${recipients} — Subject: "${subject}"`,
      );
      console.warn(
        `[EmailService] ⚠️  ${sandboxWarning}`,
      );
    } else {
      console.warn(
        `[EmailService] ⚠️  Fallback to sandbox successful — email sent to ${recipients} — Subject: "${subject}"`,
      );
      console.warn(
        `[EmailService] ⚠️  ${sandboxWarning}`,
      );
    }

    return { success: true, usedFallbackFrom: true, sandboxWarning };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logResendError('Exception during sandbox send', err);
    return { success: false, error: message, usedFallbackFrom: true, sandboxWarning };
  }
}
