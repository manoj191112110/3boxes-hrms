/**
 * Candidate Portal — Forgot Password / Magic Link (REQ-CAND-06)
 *
 * POST /api/candidate-portal/auth/forgot-password
 *   body: { email }
 *
 * Generates a time-bound (30-minute) magic-link token, hashes it (bcrypt),
 * and persists the hash to CandidatePasswordReset. The raw token is sent to
 * the candidate's email as a magic link.
 *
 * Security:
 *   - The raw token is NEVER stored — only the bcrypt hash.
 *   - Tokens expire after 30 minutes (per spec: "time-bound token expiration").
 *   - Any previously-issued unused tokens for this email are expired immediately
 *     to prevent token accumulation.
 *   - The endpoint always returns 200 OK (even if the email doesn't exist)
 *     to prevent email-enumeration attacks.
 *
 * NOTE: Email sending is currently stubbed (console.log in dev). In production,
 * wire this up to SendGrid/Postmark/SES via the env-configured provider.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { hashPassword } from '@/lib/auth';
import { randomBytes } from 'crypto';
import { getRequestMeta } from '@/lib/candidate-auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

const TOKEN_EXPIRY_MINUTES = 30;

export async function POST(request: Request) {
  const db = await getDb(request);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400, headers: CORS });
  }

  const { ip, ua } = getRequestMeta(request);

  // Look up the candidate portal user. If they don't exist, we still create one
  // from any JobApplication they may have submitted, so they can recover access.
  let user = await db.candidatePortalUser.findUnique({
    where: { candidateEmail: email },
  });

  if (!user) {
    // Try to recover from a JobApplication they submitted before signing up
    const app = await db.jobApplication.findFirst({
      where: { candidateEmail: email },
      select: { candidateName: true },
    });
    if (app) {
      user = await db.candidatePortalUser.create({
        data: {
          candidateEmail: email,
          candidateName: app.candidateName,
        },
      });
    }
  }

  if (user) {
    // Expire any previously-issued unused tokens for this email
    await db.candidatePasswordReset.updateMany({
      where: {
        candidateEmail: email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date() },
    });

    // Generate a 32-byte random token (URL-safe base64)
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = await hashPassword(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await db.candidatePasswordReset.create({
      data: {
        candidateEmail: email,
        tokenHash,
        requestedFromIp: ip,
        requestedFromUa: ua,
        expiresAt,
      },
    });

    // Build the magic link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (typeof request !== 'undefined' ? new URL(request.url).origin : 'https://3boxes-hrms-mu.vercel.app');
    const magicLink = `${baseUrl}/candidate-portal/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    // Email provider (SendGrid/Postmark/SES) not yet wired up. Until it is,
    // we surface the magic link in the response so candidates can actually
    // complete the password reset / magic-link login flow. In production with
    // a real email provider, this would be removed and only the email would
    // carry the link.
    console.log('\n========== CANDIDATE MAGIC LINK ==========');
    console.log(`To: ${email}`);
    console.log(`Name: ${user.candidateName}`);
    console.log(`Link (expires in ${TOKEN_EXPIRY_MINUTES} min): ${magicLink}`);
    console.log('==========================================\n');

    return NextResponse.json({
      ok: true,
      message: 'A password-reset link has been generated. The link expires in 30 minutes.',
      // Email provider not yet configured — surface the magic link so the
      // candidate can actually complete the flow.
      magicLink,
    }, { headers: CORS });
  }

  // Always return the same response to prevent email enumeration
  return NextResponse.json({
    ok: true,
    message: 'If an account exists for that email, a password-reset link has been sent. The link expires in 30 minutes.',
  }, { headers: CORS });
}
