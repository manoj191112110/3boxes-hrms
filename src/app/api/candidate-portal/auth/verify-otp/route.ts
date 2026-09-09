/**
 * Candidate Portal — Verify OTP (REQ-ATS-04)
 *
 * POST /api/candidate-portal/auth/verify-otp
 *   body: { email, otp }
 *
 * Verifies the OTP, clears it (one-shot), and issues a JWT with
 * { kind: 'candidate', email, name } valid for 7 days.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyPassword, createToken } from '@/lib/auth';

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
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const otp = String(body.otp || '').trim();
    if (!email || !otp) {
      return NextResponse.json({ error: 'email and otp are required' }, { status: 400, headers: CORS });
    }

    const user = await db.candidatePortalUser.findUnique({
      where: { candidateEmail: email },
    });
    if (!user || !user.currentOtpHash || !user.otpExpiresAt) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401, headers: CORS });
    }
    if (user.otpExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'OTP has expired — please request a new one' }, { status: 401, headers: CORS });
    }
    const ok = await verifyPassword(otp, user.currentOtpHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401, headers: CORS });
    }

    // Clear the OTP (one-shot) + stamp last login
    await db.candidatePortalUser.update({
      where: { id: user.id },
      data: { currentOtpHash: null, otpExpiresAt: null, lastLoginAt: new Date() },
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
      // Tell the client whether to prompt for password setup after OTP login
      needsPasswordSetup: !user.passwordHash,
    }, { headers: CORS });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500, headers: CORS });
  }
}
