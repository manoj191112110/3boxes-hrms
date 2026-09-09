import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * REQ-SEC-REC-04 — Candidate Consent Management API
 *
 * Lifecycle:
 *   POST /api/ats/consent          — record a grant (or re-grant) of consent for a purpose
 *   GET  /api/ats/consent          — list consents for a candidateEmail (+ optional tenantId)
 *   DELETE /api/ats/consent/[id]   — withdraw a single consent by setting withdrawnAt
 *
 * Purposes (exact strings, see WAVE2-A spec):
 *   resume_processing | background_check | ai_evaluation | video_recording
 *   data_retention    | marketing
 *
 * Sources: careers_portal | candidate_portal | email_link
 *
 * Auth model:
 *   - Candidates hitting the careers portal are NOT logged in. POST is open and
 *     captures IP + User-Agent for the audit trail. The caller MUST supply
 *     candidateEmail + tenantId + purpose.
 *   - GET is open for the same reason (candidate portal needs to read its own
 *     consents by email), but accepts a Bearer token for admin/tenant callers.
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

const VALID_PURPOSES = new Set([
  'resume_processing',
  'background_check',
  'ai_evaluation',
  'video_recording',
  'data_retention',
  'marketing',
]);

const VALID_SOURCES = new Set([
  'careers_portal',
  'candidate_portal',
  'email_link',
]);

function getClientIp(request: Request): string | null {
  // Vercel proxies the original client IP via x-forwarded-for (first entry).
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('remote-address') ||
    null
  );
}

function safeNormalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

/* ───────────────────────────────────────────── GET ───────────────────────────────────────────── */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const { searchParams } = new URL(request.url);
    const email = safeNormalizeEmail(searchParams.get('candidateEmail'));
    if (!email) {
      return NextResponse.json(
        { error: 'candidateEmail query parameter is required' },
        { status: 400, headers: corsHeaders() }
      );
    }
    const tenantId = searchParams.get('tenantId') || undefined;
    const purpose = searchParams.get('purpose') || undefined;
    const includeWithdrawn = searchParams.get('includeWithdrawn') === 'true';

    // Optional admin auth — if a token is provided, validate it but do not require it.
    const token = getTokenFromHeaders(request);
    if (token) {
      const decoded = await verifyToken(token);
      if (!decoded) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401, headers: corsHeaders() }
        );
      }
    }

    const where: Record<string, unknown> = { candidateEmail: email };
    if (tenantId) where.tenantId = tenantId;
    if (purpose) where.purpose = purpose;
    if (!includeWithdrawn) {
      where.withdrawnAt = null;
    }

    const consents = await db.candidateConsent.findMany({
      where,
      orderBy: { grantedAt: 'desc' },
      take: 200,
    });

    return NextResponse.json(
      { consents: consents || [] },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Consent GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', consents: [] },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/* ───────────────────────────────────────────── POST ──────────────────────────────────────────── */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const candidateEmail = safeNormalizeEmail(body.candidateEmail);
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
    const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : '';
    const source = typeof body.source === 'string' ? body.source.trim() : 'careers_portal';
    const version = typeof body.version === 'string' ? body.version : '1.0';

    if (!candidateEmail) {
      return NextResponse.json(
        { error: 'A valid candidateEmail is required' },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (!VALID_PURPOSES.has(purpose)) {
      return NextResponse.json(
        { error: `Invalid purpose. Must be one of: ${Array.from(VALID_PURPOSES).join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (!VALID_SOURCES.has(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${Array.from(VALID_SOURCES).join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || null;

    // If a previously-granted, not-yet-withdrawn consent exists for the same
    // (email, tenantId, purpose) tuple, treat this as a re-grant (no-op).
    // Otherwise insert a new row. Either way, return the active consent.
    const existing = await db.candidateConsent.findFirst({
      where: {
        candidateEmail,
        tenantId,
        purpose,
        withdrawnAt: null,
      },
      orderBy: { grantedAt: 'desc' },
    });

    let consent;
    if (existing) {
      consent = existing;
    } else {
      consent = await db.candidateConsent.create({
        data: {
          candidateEmail,
          tenantId,
          purpose,
          source,
          version,
          ipAddress,
          userAgent,
        },
      });
    }

    return NextResponse.json(
      { consent, ok: true },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Consent POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', ok: false },
      { status: 500, headers: corsHeaders() }
    );
  }
}
