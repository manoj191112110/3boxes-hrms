import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * REQ-SEC-REC-03 — Tenant PII Masking Policy PATCH/DELETE.
 *
 * Auth: tenant admins + super_admin only.
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

const VALID_STRATEGIES = new Set(['full', 'partial', 'hidden', 'hash']);
const ADMIN_ROLES = new Set(['super_admin', 'tenant_admin', 'admin']);

async function requireAuth(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token) return { error: NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() }), user: null };
  const decoded = await verifyToken(token);
  if (!decoded) return { error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() }), user: null };
  return { error: null, user: decoded };
}

function normalizeRolesArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).map(r => r.trim());
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeRolesArray(parsed);
    } catch {
      /* fallthrough */
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const { error, user } = await requireAuth(request);
    if (error || !user) return error;

    const role = (user.role as string) || '';
    if (role !== 'super_admin' && !ADMIN_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'Only tenant admins / HR admins can modify PII policies' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const data: Record<string, unknown> = { updatedBy: user.userId as string | undefined };
    if (typeof body.maskingStrategy === 'string') {
      if (!VALID_STRATEGIES.has(body.maskingStrategy)) {
        return NextResponse.json(
          { error: `Invalid maskingStrategy. Must be one of: ${Array.from(VALID_STRATEGIES).join(', ')}` },
          { status: 400, headers: corsHeaders() }
        );
      }
      data.maskingStrategy = body.maskingStrategy;
    }
    if (body.visibleToRoles !== undefined) {
      const roles = normalizeRolesArray(body.visibleToRoles);
      data.visibleToRoles = JSON.stringify(roles);
    }

    const policy = await db.candidatePiiPolicy.update({
      where: { id },
      data,
    });

    return NextResponse.json(
      {
        policy: {
          ...policy,
          visibleToRoles: normalizeRolesArray(policy.visibleToRoles),
        },
        ok: true,
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('PII Policy PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error', ok: false },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const { error, user } = await requireAuth(request);
    if (error || !user) return error;

    const role = (user.role as string) || '';
    if (role !== 'super_admin' && !ADMIN_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'Only tenant admins / HR admins can delete PII policies' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const { id } = await params;
    await db.candidatePiiPolicy.delete({ where: { id } });

    return NextResponse.json(
      { ok: true },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('PII Policy DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error', ok: false },
      { status: 500, headers: corsHeaders() }
    );
  }
}
