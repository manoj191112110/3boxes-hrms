/**
 * Client Portal — Verify OTP and issue JWT (REQ-CLT-06/07, REQ-SEC-CV-03 MFA)
 *
 * POST /api/client-portal/auth/verify-otp
 *   body: { email, otp }
 *
 * Returns { token, user } where token is a JWT with
 * { kind: 'client_portal', portalUserId, clientId, email, name }
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
    const user = await db.clientPortalUser.findFirst({
      where: { email, status: 'active' },
    });
    if (!user || !user.otpSecret) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401, headers: CORS });
    }
    // 10-minute OTP TTL
    const updatedRecently = (Date.now() - user.updatedAt.getTime()) < 10 * 60 * 1000;
    if (!updatedRecently) {
      return NextResponse.json({ error: 'OTP has expired — please request a new one' }, { status: 401, headers: CORS });
    }
    const ok = await verifyPassword(otp, user.otpSecret);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401, headers: CORS });
    }
    // Clear OTP
    await db.clientPortalUser.update({
      where: { id: user.id },
      data: { otpSecret: null, lastLoginAt: new Date() },
    });
    const token = await createToken({
      kind: 'client_portal',
      portalUserId: user.id,
      clientId: user.clientId,
      email: user.email,
      name: user.name,
    });
    return NextResponse.json({
      token,
      user: { id: user.id, clientId: user.clientId, email: user.email, name: user.name, preferredLanguage: user.preferredLanguage },
    }, { headers: CORS });
  } catch (e) {
    console.error('client-portal verify-otp error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}
