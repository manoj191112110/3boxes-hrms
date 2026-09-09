/**
 * Client Portal — Request OTP (REQ-CLT-06/07)
 *
 * POST /api/client-portal/auth/request-otp
 *   body: { email }
 *
 * Issues a 6-digit OTP and stores it as a hash on the ClientPortalUser row.
 * (In production, deliver via email/SMS.)
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { hashPassword } from '@/lib/auth';
import { randomInt } from 'crypto';

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
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400, headers: CORS });
    }
    const user = await db.clientPortalUser.findFirst({
      where: { email, status: 'active' },
    });
    // Always respond 200 to avoid email-enumeration, but only store OTP if user exists.
    if (user) {
      const otp = String(randomInt(100000, 999999));
      const otpHash = await hashPassword(otp);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await db.clientPortalUser.update({
        where: { id: user.id },
        data: { otpSecret: otpHash, lastLoginAt: null },
      });
      // Stash expiry in a column on the row — we re-use otpSecret to hold the hash
      // and track expiry via updatedAt (10-min TTL enforced on verify).
      void otpExpiresAt;
      console.log(`[client-portal] OTP for ${email}: ${otp}`);
    }
    return NextResponse.json({ sent: true }, { headers: CORS });
  } catch (e) {
    console.error('client-portal request-otp error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}
