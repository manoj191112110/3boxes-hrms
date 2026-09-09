/**
 * REQ-VEN-06 — Limited contractor onboarding.
 *
 * POST /api/contractors/onboard
 *   Body: { vendorId, vendorStaffId?, projectId?, role, billRate, costRate,
 *           currency?, startDate, endDate?, email, name }
 *
 * Creates:
 *   1. A scoped User account (role='contractor') — limited RBAC permissions
 *      (Collaboration + Projects + Timesheets only; NO HRIS, NO Payroll)
 *   2. A Contractor record linking vendor + project + user
 *   3. An AuditLog entry
 *
 * The contractor can log in, view project tasks, submit timesheets, and use
 * the Collaboration Hub — but cannot see Payroll, HRIS, or other employees'
 * PII.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders, hashPassword } from '@/lib/auth';
import { assertEcosystemAccess, CORS } from '@/lib/ecosystem-access';

function corsHeaders() { return CORS; }

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

const DEFAULT_CONTRACTOR_PASSWORD = 'Contractor@2026'; // force password reset on first login

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (vendorId) where.vendorId = vendorId;
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const contractors = await db.contractor.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        project: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, email: true, name: true, lastLogin: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ contractors }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get contractors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { vendorId, vendorStaffId, projectId, role, billRate, costRate, currency, startDate, endDate, email, name } = body;

    if (!vendorId || !role || !email || !name) {
      return NextResponse.json({ error: 'Missing required fields: vendorId, role, email, name' }, { status: 400, headers: corsHeaders() });
    }

    // REQ-SEC-CV-01: IDOR protection — verify caller's tenant owns this vendor
    const guard = await assertEcosystemAccess(request, 'vendor', vendorId);
    if (guard.deny) return guard.response;
    const vendor = guard.record;
    // Resolve the tenant from the vendor's company hierarchy
    const vendorTenantId = vendor.company?.companyGroup?.tenantId as string | undefined;
    if (!vendorTenantId) {
      return NextResponse.json({ error: 'Could not resolve tenant for vendor' }, { status: 500, headers: corsHeaders() });
    }

    // 1. Create scoped User account (role='contractor')
    const existingUser = await db.user.findUnique({ where: { email } });
    let user = existingUser;
    if (!existingUser) {
      const passwordHash = await hashPassword(DEFAULT_CONTRACTOR_PASSWORD);
      user = await db.user.create({
        data: {
          email,
          name,
          password: passwordHash,
          role: 'contractor',  // limited-scope role — see roleAccess.ts for enforcement
          status: 'active',
          tenantId: vendorTenantId,
        },
      });
    }

    // 2. Create the Contractor record
    const contractor = await db.contractor.create({
      data: {
        userId: user!.id,
        vendorId,
        vendorStaffId: vendorStaffId || null,
        projectId: projectId || null,
        role,
        billRate: billRate || 0,
        costRate: costRate || 0,
        currency: currency || 'INR',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        scopeFlags: 'collaboration,projects,timesheets',  // REQ-VEN-06: limited scope — NO HRIS, NO Payroll
        ndaSigned: false,
        bgvStatus: 'pending',
        status: 'onboarding',
      },
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        project: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, email: true, name: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: (decoded as any).userId as string,
        action: 'CONTRACTOR_ONBOARDED',
        module: 'vendors',
        details: `Onboarded contractor ${name} (${email}) for vendor ${vendorId} on project ${projectId || 'N/A'}. Scoped to: collaboration, projects, timesheets only.`,
      },
    });

    return NextResponse.json({
      contractor,
      defaultPassword: existingUser ? null : DEFAULT_CONTRACTOR_PASSWORD,
      notice: 'Contractor has access to Collaboration Hub, Projects, and Timesheets only. HRIS and Payroll are blocked by RBAC.',
    }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Onboard contractor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
