/**
 * Candidate Portal — Reset Password / Magic Link Verify (REQ-CAND-06)
 *
 * POST /api/candidate-portal/auth/reset-password
 *   body: { email, token, newPassword? }
 *
 * Verifies the magic-link token (bcrypt compare against stored hash).
 * If valid:
 *   - Marks the token as used (one-shot)
 *   - If newPassword is provided, sets it on the CandidatePortalUser (future
 *     password-based login). Currently candidates use OTP, so newPassword is
 *     optional — if omitted, the candidate is simply logged in via JWT.
 *   - Issues a candidate JWT (same as verify-otp)
 *
 * Returns 401 for invalid/expired/used tokens.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyPassword, hashPassword, createToken } from '@/lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const token = String(body.token || '').trim();
  const newPassword = body.newPassword ? String(body.newPassword) : null;

  if (!email || !token) {
    return NextResponse.json({ error: 'email and token are required' }, { status: 400, headers: CORS });
  }

  // Find the most recent unused, non-expired token for this email
  const resetRecord = await db.candidatePasswordReset.findFirst({
    where: {
      candidateEmail: email,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!resetRecord) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: CORS });
  }

  const okToken = await verifyPassword(token, resetRecord.tokenHash);
  if (!okToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
  }

  // Mark the token as used (one-shot — can never be reused)
  await db.candidatePasswordReset.update({
    where: { id: resetRecord.id },
    data: { usedAt: new Date() },
  });

  // Look up the candidate portal user
  const user = await db.candidatePortalUser.findUnique({
    where: { candidateEmail: email },
  });
  if (!user) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404, headers: CORS });
  }

  // Update last login
  await db.candidatePortalUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Issue candidate JWT (same shape as verify-otp)
  const jwt = await createToken({
    kind: 'candidate',
    email: user.candidateEmail,
    name: user.candidateName,
  });

  return NextResponse.json({
    ok: true,
    token: jwt,
    user: { email: user.candidateEmail, name: user.candidateName },
    message: 'You are now logged in.',
  }, { headers: CORS });
}
