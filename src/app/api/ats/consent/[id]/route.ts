import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * REQ-SEC-REC-04 — Withdraw a candidate consent by ID.
 *
 * Withdrawing is a soft-delete: we set withdrawnAt = now() and keep the row
 * for the audit trail. The endpoint is open to allow the candidate (data subject)
 * to withdraw their own consent from the public careers portal, but if an
 * admin token is supplied it is validated and used for the audit context.
 *
 * Supports two modes:
 *   1. DELETE /api/ats/consent/[id]              — withdraw by row id
 *   2. DELETE /api/ats/consent/[id]?candidateEmail=...&purpose=...&tenantId=...
 *      (where [id] may be the literal string "by-tuple") — withdraw the active
 *      consent matching the (email, tenantId, purpose) tuple.
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

function safeNormalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
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

    const now = new Date();
    let consent = null;

    if (id === 'by-tuple') {
      const email = safeNormalizeEmail(searchParams.get('candidateEmail'));
      const tenantId = searchParams.get('tenantId') || undefined;
      const purpose = searchParams.get('purpose') || undefined;
      if (!email || !tenantId || !purpose) {
        return NextResponse.json(
          { error: 'When withdrawing by tuple, candidateEmail, tenantId and purpose are all required' },
          { status: 400, headers: corsHeaders() }
        );
      }
      consent = await db.candidateConsent.updateMany({
        where: {
          candidateEmail: email,
          tenantId,
          purpose,
          withdrawnAt: null,
        },
        data: { withdrawnAt: now },
      });
    } else {
      // Withdraw by row id
      const existing = await db.candidateConsent.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: 'Consent record not found' },
          { status: 404, headers: corsHeaders() }
        );
      }
      consent = await db.candidateConsent.update({
        where: { id },
        data: { withdrawnAt: now },
      });
    }

    return NextResponse.json(
      { ok: true, consent, withdrawnAt: now.toISOString() },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Consent DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error', ok: false },
      { status: 500, headers: corsHeaders() }
    );
  }
}
