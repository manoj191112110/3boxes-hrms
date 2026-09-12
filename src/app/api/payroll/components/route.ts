import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { getCompanyFilter, getAuthInfo } from '@/lib/companyScope';
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
    const authInfo = await getAuthInfo(request);
    if (!authInfo) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    // ─── Company-scoped data visibility ───
    // PayrollComponent may or may not have a companyId field.
    // If it does, use getCompanyFilter. If not, return all (these are typically
    // global definitions that apply across companies within a tenant).
    const companyFilter = await getCompanyFilter(request);
    if (companyFilter === null) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get('countryCode');
    const componentType = searchParams.get('componentType');
    const componentCategory = searchParams.get('componentCategory');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};
    // Apply company filter if the PayrollComponent model has a companyId field
    // and a specific company is in scope. For global definitions (no companyId),
    // this won't filter anything.
    if (Object.keys(companyFilter).length > 0) {
      where.OR = [
        companyFilter,  // Components scoped to a specific company
        { companyId: null },  // Global components shared across companies
      ];
    }
    if (countryCode) where.countryCode = countryCode;
    if (componentType) where.componentType = componentType;
    if (componentCategory) where.componentCategory = componentCategory;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';

    const data = await db.payrollComponent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching payroll components:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const authInfo = await getAuthInfo(request);
    if (!authInfo) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    // Only admins can create payroll components
    if (!['super_admin', 'tenant_admin', 'admin'].includes(authInfo.role)) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json();

    // Ensure companyId is set for the component — use the admin's effective company
    // if not explicitly provided
    if (!body.companyId && authInfo.role !== 'super_admin') {
      // Try to resolve from the admin's employee record
      const adminEmployee = await db.employee.findFirst({
        where: { userId: authInfo.userId, status: 'active' },
        select: { companyId: true },
      });
      if (adminEmployee?.companyId) {
        body.companyId = adminEmployee.companyId;
      }
    }

    const data = await db.payrollComponent.create({ data: body });

    return Response.json({ data, message: 'Payroll component created successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error creating payroll component:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
