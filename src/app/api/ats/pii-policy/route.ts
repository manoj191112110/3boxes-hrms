import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * REQ-SEC-REC-03 — Tenant PII Masking Policy CRUD.
 *
 * Fields (exact strings):
 *   dob | gender | photo | address | phone | email | aadhaar | ssn | sin
 *
 * Masking strategies:
 *   full | partial | hidden | hash
 *
 * Auth: tenant admins + super_admin only. Recruiters may read (so they can
 * pass policies into maskCandidateFields) but cannot mutate.
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

const VALID_FIELDS = new Set([
  'dob',
  'gender',
  'photo',
  'address',
  'phone',
  'email',
  'aadhaar',
  'ssn',
  'sin',
]);

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
      // fallthrough — treat as comma-separated
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/* ───────────────────────────────────────────── GET ───────────────────────────────────────────── */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const { error, user } = await requireAuth(request);
    if (error || !user) return error;

    const tenantId = (user.tenantId as string) || ((user as { tenant?: { id?: string } }).tenant?.id as string) || undefined;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Authenticated user has no tenantId', policies: [] },
        { status: 400, headers: corsHeaders() }
      );
    }

    const policies = await db.candidatePiiPolicy.findMany({
      where: { tenantId },
      orderBy: { field: 'asc' },
    });

    // Hydrate the visibleToRoles JSON-string into a real array on the way out
    const hydrated = (policies || []).map(p => ({
      ...p,
      visibleToRoles: normalizeRolesArray(p.visibleToRoles),
    }));

    return NextResponse.json(
      { policies: hydrated || [] },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('PII Policy GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', policies: [] },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/* ───────────────────────────────────────────── POST (upsert) ─────────────────────────────────── */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const { error, user } = await requireAuth(request);
    if (error || !user) return error;

    const role = (user.role as string) || '';
    const isSuperAdmin = role === 'super_admin';
    if (!isSuperAdmin && !ADMIN_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'Only tenant admins / HR admins can configure PII policies' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const tenantId = (user.tenantId as string) || ((user as { tenant?: { id?: string } }).tenant?.id as string) || undefined;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Authenticated user has no tenantId' },
        { status: 400, headers: corsHeaders() }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const field = typeof body.field === 'string' ? body.field.trim() : '';
    if (!VALID_FIELDS.has(field)) {
      return NextResponse.json(
        { error: `Invalid field. Must be one of: ${Array.from(VALID_FIELDS).join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    const maskingStrategy = typeof body.maskingStrategy === 'string' ? body.maskingStrategy : 'hidden';
    if (!VALID_STRATEGIES.has(maskingStrategy)) {
      return NextResponse.json(
        { error: `Invalid maskingStrategy. Must be one of: ${Array.from(VALID_STRATEGIES).join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    const visibleToRolesArr = normalizeRolesArray(body.visibleToRoles);
    const visibleToRolesJson = JSON.stringify(visibleToRolesArr);

    const policy = await db.candidatePiiPolicy.upsert({
      where: { tenantId_field: { tenantId, field } },
      create: {
        tenantId,
        field,
        maskingStrategy,
        visibleToRoles: visibleToRolesJson,
        updatedBy: user.userId as string | undefined,
      },
      update: {
        maskingStrategy,
        visibleToRoles: visibleToRolesJson,
        updatedBy: user.userId as string | undefined,
      },
    });

    return NextResponse.json(
      {
        policy: { ...policy, visibleToRoles: visibleToRolesArr },
        ok: true,
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('PII Policy POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', ok: false },
      { status: 500, headers: corsHeaders() }
    );
  }
}
