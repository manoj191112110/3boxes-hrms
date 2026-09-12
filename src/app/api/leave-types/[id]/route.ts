/**
 * Leave Type detail API — update + delete
 *   PATCH /api/leave-types/[id] — update a leave type (admin only)
 *   DELETE /api/leave-types/[id] — delete a leave type (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getAuthInfo } from '@/lib/companyScope';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth || !['super_admin', 'tenant_admin', 'admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: corsHeaders() });
    }
    const { id } = await params;
    const body = await req.json();
    const { name, code, description, defaultDays, isPaid, carryForward, maxCarryForward,
            employmentType, employeeStatus, probationRestricted, sandwichRuleEnabled, status } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!/^[A-Za-z][A-Za-z\s'-]{1,49}$/.test(name)) {
        return NextResponse.json({ error: 'Name must be 2–50 characters, letters/spaces only' }, { status: 400, headers: corsHeaders() });
      }
      data.name = name;
    }
    if (code !== undefined) {
      const upperCode = String(code).toUpperCase();
      if (!/^[A-Z]{2,10}$/.test(upperCode)) {
        return NextResponse.json({ error: 'Code must be 2–10 uppercase letters' }, { status: 400, headers: corsHeaders() });
      }
      data.code = upperCode;
    }
    if (description !== undefined) data.description = description || null;
    if (defaultDays !== undefined) {
      const dd = Number(defaultDays);
      if (isNaN(dd) || dd < 0 || dd > 366) {
        return NextResponse.json({ error: 'Annual quota must be 0–366' }, { status: 400, headers: corsHeaders() });
      }
      data.defaultDays = dd;
    }
    if (isPaid !== undefined) data.isPaid = !!isPaid;
    if (carryForward !== undefined) data.carryForward = !!carryForward;
    if (maxCarryForward !== undefined) data.maxCarryForward = Math.max(0, Number(maxCarryForward) || 0);
    if (status !== undefined) data.status = status;
    // Scope fields
    if (employmentType !== undefined) {
      data.employmentType = ['all', 'full-time', 'part-time', 'contract', 'internship'].includes(String(employmentType))
        ? String(employmentType) : 'all';
    }
    if (employeeStatus !== undefined) {
      data.employeeStatus = ['all', 'active', 'on_leave', 'inactive'].includes(String(employeeStatus))
        ? String(employeeStatus) : 'all';
    }
    if (probationRestricted !== undefined) data.probationRestricted = !!probationRestricted;
    if (sandwichRuleEnabled !== undefined) data.sandwichRuleEnabled = !!sandwichRuleEnabled;

    const updated = await db.leaveType.update({ where: { id }, data });
    return NextResponse.json({ leaveType: updated }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Leave type PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update leave type' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth || !['super_admin', 'tenant_admin', 'admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: corsHeaders() });
    }
    const { id } = await params;
    // Soft-delete by setting status='inactive' rather than hard-delete
    // (preserves historical leave requests that reference this type)
    await db.leaveType.update({ where: { id }, data: { status: 'inactive' } });
    return NextResponse.json({ message: 'Leave type deactivated' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Leave type DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete leave type' }, { status: 500, headers: corsHeaders() });
  }
}
