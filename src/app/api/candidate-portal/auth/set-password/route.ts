/**
 * Candidate Portal — Set Password (after first OTP login)
 *
 * POST /api/candidate-portal/auth/set-password
 *   body: { token, newPassword }
 *     - token: candidate JWT issued by verify-otp (proves the user just OTP'd)
 *     - newPassword: the password to set (≥ 8 chars)
 *
 * Sets passwordHash + passwordSetAt on the CandidatePortalUser.
 * Future logins can then use the password endpoint instead of OTP.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { hashPassword, verifyToken } from '@/lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'token and newPassword are required' }, { status: 400, headers: CORS });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400, headers: CORS });
    }

    // Verify the JWT — must be a candidate token from a fresh OTP/magic-link login
    const payload = await verifyToken(token);
    if (!payload || payload.kind !== 'candidate' || !payload.email) {
      return NextResponse.json({ error: 'Invalid or expired session — please log in again' }, { status: 401, headers: CORS });
    }

    const email = String(payload.email).toLowerCase();

    const user = await db.candidatePortalUser.findUnique({
      where: { candidateEmail: email },
    });
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404, headers: CORS });
    }

    const passwordHash = await hashPassword(newPassword);
    await db.candidatePortalUser.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordSetAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'Password set successfully — you can now log in with your email and password.',
    }, { headers: CORS });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500, headers: CORS });
  }
}
