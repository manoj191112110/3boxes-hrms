/**
 * Policy Acknowledgment API — employees confirm they have read a policy
 *
 *   GET  /api/policies/acknowledgments?policyId=<id>   — admin tracking: who acknowledged / who is pending
 *   GET  /api/policies/acknowledgments?mine=1          — current employee's own acknowledgments
 *   POST /api/policies/acknowledgments                 — acknowledge a policy (self-service)
 *        body: { policyId, comments? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getAuthInfo } from '@/lib/companyScope';
import { sanitizeMultiLineText } from '@/lib/sanitize';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const url = new URL(req.url);

    // ── Current employee's own acknowledgments ──
    if (url.searchParams.get('mine')) {
      const emp = await db.employee.findFirst({ where: { userId: auth.userId }, select: { id: true } });
      if (!emp) return NextResponse.json({ acknowledgments: [] }, { headers: corsHeaders() });
      const acknowledgments = await (db as any).policyAcknowledgment?.findMany({
        where: { employeeId: emp.id },
        orderBy: { acknowledgedAt: 'desc' },
        take: 200,
        select: { id: true, policyId: true, policyVersion: true, method: true, acknowledgedAt: true, comments: true },
      }) || [];
      return NextResponse.json({ acknowledgments }, { headers: corsHeaders() });
    }

    // ── Admin tracking for one policy ──
    const policyId = url.searchParams.get('policyId');
    if (!policyId) return NextResponse.json({ error: 'policyId is required' }, { status: 400, headers: corsHeaders() });

    const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin', 'company_hr_admin'].includes(auth.role);
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });

    const policy = await db.policy.findUnique({ where: { id: policyId }, select: { id: true, title: true, version: true } });
    if (!policy) return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: corsHeaders() });

    const acks = await (db as any).policyAcknowledgment?.findMany({
      where: { policyId },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true, departmentId: true } } },
      orderBy: { acknowledgedAt: 'desc' },
      take: 1000,
    }) || [];

    const ackedByEmployee = new Map<string, { at: Date; method: string; version: string | null }>();
    for (const a of acks) {
      if (a.employee) ackedByEmployee.set(a.employeeId, { at: a.acknowledgedAt, method: a.method, version: a.policyVersion });
    }

    // All active employees = audience for this policy
    const employees = await db.employee.findMany({
      where: { status: 'active' },
      select: { id: true, firstName: true, lastName: true, employeeId: true, email: true, departmentId: true },
      orderBy: { firstName: 'asc' },
      take: 2000,
    });

    const rows = employees.map((e) => {
      const ack = ackedByEmployee.get(e.id);
      return {
        employeeId: e.id,
        employeeCode: e.employeeId,
        name: `${e.firstName} ${e.lastName}`.trim(),
        email: e.email,
        departmentId: e.departmentId,
        acknowledged: !!ack,
        acknowledgedAt: ack?.at || null,
        method: ack?.method || null,
        acknowledgedVersion: ack?.version || null,
      };
    });

    return NextResponse.json({
      policy,
      summary: { total: rows.length, acknowledged: rows.filter((r) => r.acknowledged).length, pending: rows.filter((r) => !r.acknowledged).length },
      rows,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Policy acknowledgments GET error:', error);
    return NextResponse.json({ error: 'Failed to load acknowledgments' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const body = await req.json();
    const { policyId, comments } = body;
    if (!policyId) return NextResponse.json({ error: 'policyId is required' }, { status: 400, headers: corsHeaders() });

    const policy = await db.policy.findUnique({ where: { id: policyId }, select: { id: true, title: true, version: true, status: true } });
    if (!policy) return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: corsHeaders() });

    const emp = await db.employee.findFirst({ where: { userId: auth.userId }, select: { id: true, firstName: true } });
    if (!emp) return NextResponse.json({ error: 'No employee record is linked to your account. Acknowledgments are recorded per-employee.' }, { status: 400, headers: corsHeaders() });

    const existing = await (db as any).policyAcknowledgment?.findFirst({
      where: { policyId, employeeId: emp.id },
    });
    if (existing) {
      return NextResponse.json({ acknowledgment: existing, message: 'Policy already acknowledged' }, { headers: corsHeaders() });
    }

    const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin', 'company_hr_admin'].includes(auth.role);
    const acknowledgment = await (db as any).policyAcknowledgment?.create({
      data: {
        policyId,
        employeeId: emp.id,
        policyVersion: policy.version,
        method: isAdmin ? 'admin_marked' : 'self_service',
        acknowledgedById: auth.userId,
        comments: comments ? sanitizeMultiLineText(comments, 300) : null,
      },
    });

    return NextResponse.json({ acknowledgment, message: 'Policy acknowledged' }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Policy acknowledgment POST error:', error);
    return NextResponse.json({ error: 'Failed to record acknowledgment' }, { status: 500, headers: corsHeaders() });
  }
}
