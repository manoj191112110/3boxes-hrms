/**
 * SMTP Email Sending Utility
 *
 * Sends emails via configured SMTP server or Resend API.
 * Reads credentials from CollaborationSettings (per-tenant).
 *
 * Supported providers:
 *   - smtp:  nodemailer with custom SMTP (Gmail, Office365, Mailgun, etc.)
 *   - resend: Resend API (https://resend.com)
 *   - google: Gmail SMTP (smtp.gmail.com:587 with app password)
 *   - outlook: Office365 SMTP (smtp.office365.com:587)
 */

import nodemailer from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'tls' | 'ssl' | 'none';
  fromName?: string;
  fromAddress?: string;
  replyTo?: string;
}

interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromAddress?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

/** Build nodemailer transport from SMTP config */
function createSmtpTransport(config: SmtpConfig) {
  const secure = config.encryption === 'ssl' || config.port === 465;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
    // TLS options for STARTTLS
    tls: config.encryption === 'tls' ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: 10000, // 10s
    greetingTimeout: 10000,
    socketTimeout: 30000,
  } as nodemailer.SendMailOptions);
}

/** Send via custom SMTP */
async function sendViaSmtp(config: SmtpConfig, params: SendEmailParams): Promise<SendResult> {
  const transport = createSmtpTransport(config);

  try {
    const from = params.fromAddress
      ? `"${params.fromName || config.fromName || ''}" <${params.fromAddress}>`
      : `"${config.fromName || params.fromName || ''}" <${config.fromAddress || config.username}>`;

    const result = await transport.sendMail({
      from,
      to: params.to.join(', '),
      cc: params.cc?.join(', '),
      bcc: params.bcc?.join(', '),
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo || config.replyTo,
      attachments: params.attachments,
    });

    transport.close();
    return { success: true, messageId: result.messageId, provider: 'smtp' };
  } catch (error: any) {
    transport.close();
    return { success: false, error: error.message || String(error), provider: 'smtp' };
  }
}

/** Send via Resend API */
async function sendViaResend(apiKey: string, fromAddress: string, params: SendEmailParams): Promise<SendResult> {
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const from = params.fromName
      ? `${params.fromName} <${fromAddress}>`
      : fromAddress;

    const result = await resend.emails.send({
      from,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo,
      attachments: params.attachments?.map(a => ({
        filename: a.filename,
        content: a.content?.toString(),
      })),
    });

    if (result.error) {
      return { success: false, error: result.error.message, provider: 'resend' };
    }

    return { success: true, messageId: result.data?.id, provider: 'resend' };
  } catch (error: any) {
    return { success: false, error: error.message || String(error), provider: 'resend' };
  }
}

/**
 * Main send function — routes to the appropriate provider based on settings.
 *
 * @param settings - CollaborationSettings record from the database
 * @param params - Email parameters (to, subject, body, etc.)
 */
export async function sendEmail(
  settings: {
    emailProvider: string;
    emailIntegrationEnabled: boolean;
    smtpHost?: string | null;
    smtpPort?: number;
    smtpUsername?: string | null;
    smtpPassword?: string | null;
    smtpEncryption?: string;
    smtpFromName?: string | null;
    smtpFromAddress?: string | null;
    smtpReplyTo?: string | null;
    resendApiKey?: string | null;
    resendFromAddress?: string | null;
  },
  params: SendEmailParams,
): Promise<SendResult> {
  if (!settings.emailIntegrationEnabled) {
    return { success: false, error: 'Email integration is not enabled. Enable it in Collaboration Settings.', provider: settings.emailProvider };
  }

  const provider = settings.emailProvider;

  // ─── Resend ───
  if (provider === 'resend') {
    if (!settings.resendApiKey || !settings.resendFromAddress) {
      return { success: false, error: 'Resend API key and from address are required. Configure them in SMTP settings.', provider: 'resend' };
    }
    return sendViaResend(settings.resendApiKey, settings.resendFromAddress, params);
  }

  // ─── Google (Gmail SMTP) ───
  if (provider === 'google') {
    if (!settings.smtpUsername || !settings.smtpPassword) {
      return { success: false, error: 'Gmail SMTP credentials (email + app password) are required. Configure them in SMTP settings.', provider: 'google' };
    }
    return sendViaSmtp({
      host: 'smtp.gmail.com',
      port: 587,
      username: settings.smtpUsername,
      password: settings.smtpPassword,
      encryption: 'tls',
      fromName: settings.smtpFromName || undefined,
      fromAddress: settings.smtpFromAddress || settings.smtpUsername,
      replyTo: settings.smtpReplyTo || undefined,
    }, params);
  }

  // ─── Outlook (Office365 SMTP) ───
  if (provider === 'outlook') {
    if (!settings.smtpUsername || !settings.smtpPassword) {
      return { success: false, error: 'Outlook SMTP credentials (email + password) are required. Configure them in SMTP settings.', provider: 'outlook' };
    }
    return sendViaSmtp({
      host: 'smtp.office365.com',
      port: 587,
      username: settings.smtpUsername,
      password: settings.smtpPassword,
      encryption: 'tls',
      fromName: settings.smtpFromName || undefined,
      fromAddress: settings.smtpFromAddress || settings.smtpUsername,
      replyTo: settings.smtpReplyTo || undefined,
    }, params);
  }

  // ─── Custom SMTP ───
  if (provider === 'smtp') {
    if (!settings.smtpHost || !settings.smtpUsername || !settings.smtpPassword) {
      return { success: false, error: 'SMTP host, username, and password are required. Configure them in SMTP settings.', provider: 'smtp' };
    }
    return sendViaSmtp({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      username: settings.smtpUsername,
      password: settings.smtpPassword,
      encryption: (settings.smtpEncryption as 'tls' | 'ssl' | 'none') || 'tls',
      fromName: settings.smtpFromName || undefined,
      fromAddress: settings.smtpFromAddress || settings.smtpUsername,
      replyTo: settings.smtpReplyTo || undefined,
    }, params);
  }

  return { success: false, error: `Unknown email provider: ${provider}`, provider };
}

/**
 * Verify SMTP connection — tests that credentials work without sending an email.
 */
export async function verifySmtpConnection(config: SmtpConfig): Promise<{ success: boolean; error?: string }> {
  const transport = createSmtpTransport(config);
  try {
    await transport.verify();
    transport.close();
    return { success: true };
  } catch (error: any) {
    transport.close();
    return { success: false, error: error.message || String(error) };
  }
}
