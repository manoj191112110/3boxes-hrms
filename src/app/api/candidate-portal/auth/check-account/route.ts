/**
 * Candidate Portal — Check Account
 *
 * GET /api/candidate-portal/auth/check-account?email=foo@bar.com
 *
 * Returns whether the account exists and whether a password is set.
 * The login page uses this to auto-pick the right tab (Password vs OTP).
 *
 * Response:
 *   { exists: boolean, hasPassword: boolean, hasOtp?: boolean }
 *
 * Never leaks anything beyond what's needed for UX routing.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const url = new URL(request.url);
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400, headers: CORS });
    }

    const user = await db.candidatePortalUser.findUnique({
      where: { candidateEmail: email },
      select: {
        passwordHash: true,
        currentOtpHash: true,
        otpExpiresAt: true,
        oauthProvider: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        exists: false,
        hasPassword: false,
        hasOtp: false,
        hasOAuth: false,
      }, { headers: CORS });
    }

    const hasOtp = !!(user.currentOtpHash && user.otpExpiresAt && user.otpExpiresAt.getTime() > Date.now());

    return NextResponse.json({
      exists: true,
      hasPassword: !!user.passwordHash,
      hasOtp,
      hasOAuth: !!user.oauthProvider,
    }, { headers: CORS });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500, headers: CORS });
  }
}
