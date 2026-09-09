import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * POST /api/audit/context-swap
 *
 * SRS REQ-SA-10: "Audit log entry automatically generated whenever Super Admin
 * swaps contexts (to prevent unauthorized snooping)."
 *
 * SRS REQ-SEC-06: "Log every Context Swap action (Who swapped into which
 * company and when)."
 *
 * Body: {
 *   fromTenantId?:  string | null,
 *   fromCompanyId?: string | null,
 *   toTenantId?:    string | null,
 *   toCompanyId?:   string | null,
 *   toTenantName?:  string | null,   // for human-readable details
 *   toCompanyName?: string | null,
 *   reason?:        string | null,   // optional reason for the swap
 * }
 *
 * Non-blocking — returns 200 even if the audit row fails to insert, because
 * we never want to block a user's context swap because of a logging issue.
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() },
      );
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() },
      );
    }

    const userId = decoded.userId as string;
    const role = (decoded.role as string) || 'employee';
    const body = await request.json().catch(() => ({}));

    const fromTenantId  = body.fromTenantId  ?? null;
    const fromCompanyId = body.fromCompanyId ?? null;
    const toTenantId    = body.toTenantId    ?? null;
    const toCompanyId   = body.toCompanyId   ?? null;
    const toTenantName  = body.toTenantName  ?? null;
    const toCompanyName = body.toCompanyName ?? null;
    const reason        = body.reason        ?? null;

    // Don't log no-op swaps (user picked the same context they were already on)
    if (fromTenantId === toTenantId && fromCompanyId === toCompanyId) {
      return NextResponse.json(
        { message: 'No context change — audit log not written.', logged: false },
        { headers: corsHeaders() },
      );
    }

    const fromLabel = [fromTenantId ? `tenant:${fromTenantId}` : null, fromCompanyId ? `company:${fromCompanyId}` : null]
      .filter(Boolean).join(' → ') || 'global';
    const toLabel = [
      toTenantName || (toTenantId ? `tenant:${toTenantId}` : null),
      toCompanyName || (toCompanyId ? `company:${toCompanyId}` : null),
    ].filter(Boolean).join(' / ') || 'global';

    const details = reason
      ? `Context swap: ${fromLabel} → ${toLabel}. Reason: ${reason}`
      : `Context swap: ${fromLabel} → ${toLabel}.`;

    try {
      await db.auditLog.create({
        data: {
          userId,
          action: 'CONTEXT_SWAP',
          module: 'context_swap',
          details,
          ip: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (logErr) {
      // Logging is best-effort — never block the swap.
      console.error('[audit/context-swap] Failed to write audit log:', logErr);
    }

    return NextResponse.json(
      { message: 'Context swap logged.', logged: true, role },
      { headers: corsHeaders() },
    );
  } catch (error) {
    console.error('[audit/context-swap] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
