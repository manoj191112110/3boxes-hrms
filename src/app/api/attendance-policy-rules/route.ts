/**
 * Attendance Policy Rules API — Scoped rules by employee type, branch, department
 * GET  — list all rules for the company
 * POST — create a new rule (admin only)
 * PUT  — update a rule (admin only)
 * DELETE — delete a rule (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getCompanyFilter, getAuthInfo } from '@/lib/companyScope';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// GET: List attendance policy rules (company-scoped)
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const rules = await db.attendancePolicyRule.findMany({
      where: { status: 'active', ...companyFilter },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: rules }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Attendance policy rules GET error:', error);
    return NextResponse.json({ data: [] }, { headers: corsHeaders() });
  }
}

// POST: Create a new attendance policy rule
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth || !['super_admin', 'tenant_admin', 'admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const {
      name, policyId, companyId, employmentType, branchId, departmentId,
      shiftStartDefault, shiftEndDefault, breakDurationMinutes,
      lateGraceMinutes, earlyGraceMinutes,
      lateMarkAllowancePerMonth, lateMarkHalfDayOnExceed, halfDayAfterMinutes, lateMarkNotApplicableOnTour,
      autoOvertimeEnabled, overtimeThresholdMinutes,
      gatePassMaxPerMonth, gatePassHalfDayOnExceed, gatePassHalfDayNextDay, gatePassEarlyHours,
      priority, status,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Rule name is required' }, { status: 400, headers: corsHeaders() });
    }

    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId) {
      const companyFilter = await getCompanyFilter(req);
      if (companyFilter && 'companyId' in companyFilter) {
        resolvedCompanyId = companyFilter.companyId as string;
      }
    }
    if (!resolvedCompanyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400, headers: corsHeaders() });
    }

    const rule = await db.attendancePolicyRule.create({
      data: {
        name,
        policyId: policyId || null,
        companyId: resolvedCompanyId,
        employmentType: employmentType || 'all',
        branchId: branchId || null,
        departmentId: departmentId || null,
        shiftStartDefault: shiftStartDefault || '09:00',
        shiftEndDefault: shiftEndDefault || '17:30',
        breakDurationMinutes: breakDurationMinutes ?? 30,
        lateGraceMinutes: lateGraceMinutes ?? 15,
        earlyGraceMinutes: earlyGraceMinutes ?? 10,
        lateMarkAllowancePerMonth: lateMarkAllowancePerMonth ?? 4,
        lateMarkHalfDayOnExceed: lateMarkHalfDayOnExceed ?? true,
        halfDayAfterMinutes: halfDayAfterMinutes ?? 21,
        lateMarkNotApplicableOnTour: lateMarkNotApplicableOnTour ?? true,
        autoOvertimeEnabled: autoOvertimeEnabled ?? true,
        overtimeThresholdMinutes: overtimeThresholdMinutes ?? 480,
        gatePassMaxPerMonth: gatePassMaxPerMonth ?? 1,
        gatePassHalfDayOnExceed: gatePassHalfDayOnExceed ?? true,
        gatePassHalfDayNextDay: gatePassHalfDayNextDay ?? true,
        gatePassEarlyHours: gatePassEarlyHours ?? 1,
        priority: priority ?? 0,
        status: status || 'active',
      },
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ rule }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Attendance policy rules POST error:', error);
    return NextResponse.json({ error: 'Failed to create attendance policy rule' }, { status: 500, headers: corsHeaders() });
  }
}

// PUT: Update an attendance policy rule
export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth || !['super_admin', 'tenant_admin', 'admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400, headers: corsHeaders() });
    }

    const rule = await db.attendancePolicyRule.update({
      where: { id },
      data: updateData,
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ rule }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Attendance policy rules PUT error:', error);
    return NextResponse.json({ error: 'Failed to update attendance policy rule' }, { status: 500, headers: corsHeaders() });
  }
}

// DELETE: Delete an attendance policy rule
export async function DELETE(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth || !['super_admin', 'tenant_admin', 'admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400, headers: corsHeaders() });
    }

    await db.attendancePolicyRule.delete({ where: { id } });
    return NextResponse.json({ message: 'Rule deleted' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Attendance policy rules DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete attendance policy rule' }, { status: 500, headers: corsHeaders() });
  }
}
