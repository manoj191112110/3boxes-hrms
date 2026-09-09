import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { resolveCompanyScope } from '@/lib/companyScope';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const inputType = searchParams.get('inputType');
    const approvalStatus = searchParams.get('approvalStatus');
    const payrollRunId = searchParams.get('payrollRunId');

    // ─── Resolve scope (employee = own, manager = own + reports, admin = all/company) ───
    const scope = await resolveCompanyScope(request);
    if (!scope) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const where: Record<string, unknown> = {};

    // Apply data-scope filtering (unless employeeId override is allowed for admins/managers)
    if (scope.scope === 'self' && scope.ownEmployeeId) {
      // Employee: only their own payroll inputs
      where.employeeId = scope.ownEmployeeId;
    } else if (scope.scope === 'team' && scope.visibleEmployeeIds.length > 0) {
      // Manager: own + direct reports' payroll inputs
      where.employeeId = { in: scope.visibleEmployeeIds };
    } else if (scope.scope === 'all' && scope.companyId) {
      // Admin with company selected
      where.employee = { companyId: scope.companyId };
    }

    // Allow employeeId override for admins/managers
    if (employeeId && scope.scope !== 'self') {
      // For managers, validate the requested employeeId is in their visible list
      if (scope.scope === 'team' && !scope.visibleEmployeeIds.includes(employeeId)) {
        return Response.json({ error: 'Access denied: not your direct report' }, { status: 403, headers: corsHeaders });
      }
      where.employeeId = employeeId;
    }
    if (inputType) where.inputType = inputType;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (payrollRunId) where.payrollRunId = payrollRunId;

    let data;
    try {
      data = await db.payrollInput.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    } catch (dbError: unknown) {
      console.error('PayrollInput table not available:', dbError);
      data = [];
    }

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching payroll inputs:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    let data;
    try {
      data = await db.payrollInput.create({
        data: { ...body, createdBy: body.createdBy || (decoded.userId as string) },
      });
    } catch (dbError: unknown) {
      console.error('PayrollInput table not available:', dbError);
      return Response.json({ error: 'PayrollInput table is not available' }, { status: 503, headers: corsHeaders });
    }

    return Response.json({ data, message: 'Payroll input created successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error creating payroll input:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
