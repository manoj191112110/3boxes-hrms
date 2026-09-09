/**
 * Candidate Portal — Password Login
 *
 * POST /api/candidate-portal/auth/login-password
 *   body: { email, password }
 *
 * Looks up CandidatePortalUser by email. If passwordHash is set and
 * bcrypt.compare matches, issues a candidate JWT (same shape as verify-otp).
 *
 * If passwordHash is NOT set, returns 403 with { needsPasswordSetup: true }
 * so the client can redirect the user to OTP login first.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyPassword, createToken } from '@/lib/auth';

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
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400, headers: CORS });
    }

    const user = await db.candidatePortalUser.findUnique({
      where: { candidateEmail: email },
    });
    if (!user) {
      // Don't leak whether the email exists — same error as wrong password
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: CORS });
    }

    if (!user.passwordHash) {
      // User has not set a password yet — needs to OTP first
      return NextResponse.json({
        error: 'You have not set a password yet. Please log in with OTP first to set up your password.',
        needsPasswordSetup: true,
      }, { status: 403, headers: CORS });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: CORS });
    }

    // Stamp last login
    await db.candidatePortalUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await createToken({
      kind: 'candidate',
      email: user.candidateEmail,
      name: user.candidateName,
    });

    return NextResponse.json({
      ok: true,
      token,
      user: { email: user.candidateEmail, name: user.candidateName },
    }, { headers: CORS });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500, headers: CORS });
  }
}
