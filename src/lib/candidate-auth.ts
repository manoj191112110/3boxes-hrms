/**
 * Shared helpers for candidate-portal API routes.
 *
 * Candidates authenticate via a JWT with `kind: 'candidate'` issued by
 * /api/candidate-portal/auth/verify-otp or /api/candidate-portal/auth/reset-password.
 *
 * The candidate JWT payload is { kind, email, name } — there is no tenantId
 * because a candidate is a platform-level entity (per the spec) and may have
 * applied to multiple sub-companies across tenants.
 */
import { NextResponse } from 'next/server';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: CORS });
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export interface CandidateUser {
  email: string;
  name: string;
}

/**
 * Authenticate a candidate-portal request.
 * Returns the candidate's email + name, or a 401 response.
 */
export async function requireCandidate(request: Request): Promise<{
  candidate: CandidateUser | null;
  response: Response | null;
}> {
  const token = getTokenFromHeaders(request);
  if (!token) return { candidate: null, response: fail('No token provided', 401) };
  const decoded = await verifyToken(token);
  if (!decoded) return { candidate: null, response: fail('Invalid or expired token', 401) };
  // Verify this is actually a candidate token, not an employee token
  if (decoded.kind !== 'candidate') {
    return { candidate: null, response: fail('This endpoint requires a candidate token', 403) };
  }
  return {
    candidate: {
      email: String(decoded.email || ''),
      name: String(decoded.name || ''),
    },
    response: null,
  };
}

/** Get client IP + UA for audit logging. */
export function getRequestMeta(request: Request): { ip: string | null; ua: string | null } {
  return {
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
    ua: request.headers.get('user-agent') || null,
  };
}

/** Parse a JSON body safely. */
export async function parseBody(request: Request): Promise<Record<string, any> | null> {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return null;
  }
}
