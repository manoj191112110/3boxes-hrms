import { NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenantById } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { checkTenantStatusOrBlock } from '@/lib/tenant-guard';

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

/**
 * PATCH /api/company-groups/[id]
 *
 * Update a group company's name, employee-strength barriers, or notes.
 *
 * Super admin can update any group. Tenant admin can only update groups under
 * their own tenant.
 *
 * Body (any subset):
 *  - name: string
 *  - employeeLimitMode: 'per_company' | 'group_total'
 *  - maxEmployees: number | null
 *  - maxCompanies: number | null
 *  - notes: string | null
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    // ─── Tenant status guard: block writes for suspended/inactive tenants ───
    const tenantBlock = await checkTenantStatusOrBlock(request, corsHeaders);
    if (tenantBlock) return tenantBlock;

    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const role = (decoded.role as string) || 'employee';
    const callerTenantId = decoded.tenantId as string;

    // ─── PERMISSION RULE ───
    // Only SUPER ADMIN can update group companies. Tenant admins can NOT
    // modify group companies — they can only create companies under existing
    // groups via /api/companies.
    if (role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can update group companies. If you need a change, please contact your super admin.' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const { id } = await params;

    // FIX: Try to find the group using tenant-specific DBs
    let existing = await db.companyGroup.findUnique({ where: { id } });
    let patchDb = db;
    if (!existing && callerTenantId) {
      // Fallback to tenant-specific DB
      const tenantDb = await getDbForTenantById(callerTenantId);
      existing = await tenantDb.companyGroup.findUnique({ where: { id } });
      if (existing) patchDb = tenantDb;
    }
    if (!existing) {
      return NextResponse.json({ error: 'Group company not found' }, { status: 404, headers: corsHeaders() });
    }

    // If we found it on the platform DB, switch to the tenant-specific DB for writes
    if (existing && patchDb === db && existing.tenantId) {
      patchDb = await getDbForTenantById(existing.tenantId);
    }

    // (callerTenantId kept for audit logging below — no longer used for authz
    // since only super admin can reach this point.)
    void callerTenantId;

    const body = await request.json();
    const { name, employeeLimitMode, maxEmployees, maxCompanies, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!String(name).trim()) {
        return NextResponse.json({ error: 'Group name cannot be empty' }, { status: 400, headers: corsHeaders() });
      }
      updateData.name = String(name).trim();
    }
    if (employeeLimitMode !== undefined) {
      updateData.employeeLimitMode = employeeLimitMode === 'per_company' ? 'per_company' : 'group_total';
    }
    if (maxEmployees !== undefined) {
      updateData.maxEmployees = typeof maxEmployees === 'number' && maxEmployees >= 0 ? maxEmployees : null;
    }
    if (maxCompanies !== undefined) {
      updateData.maxCompanies = typeof maxCompanies === 'number' && maxCompanies >= 0 ? maxCompanies : null;
    }
    if (notes !== undefined) {
      updateData.notes = notes ? String(notes) : null;
    }

    const group = await patchDb.companyGroup.update({
      where: { id },
      data: updateData,
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        _count: { select: { companies: true } },
      },
    });

    await patchDb.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_COMPANY_GROUP',
        module: 'company-groups',
        details: `Updated group company ${id}: ${JSON.stringify(updateData)}`,
      },
    });

    return NextResponse.json({ group }, { headers: corsHeaders() });
  } catch (error) {
    console.error('PATCH /api/company-groups/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update group company' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * DELETE /api/company-groups/[id]
 *
 * Delete a group company. Will fail if the group still has companies under it
 * (those need to be deleted or moved first).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const role = (decoded.role as string) || 'employee';
    const callerTenantId = decoded.tenantId as string;

    // ─── PERMISSION RULE ───
    // Only SUPER ADMIN can delete group companies.
    if (role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can delete group companies. If you need a group removed, please contact your super admin.' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const { id } = await params;

    // FIX: Try to find the group using tenant-specific DBs
    let existing = await db.companyGroup.findUnique({
      where: { id },
      include: { _count: { select: { companies: true } } },
    });
    let deleteDb = db;
    if (!existing && callerTenantId) {
      const tenantDb = await getDbForTenantById(callerTenantId);
      existing = await tenantDb.companyGroup.findUnique({
        where: { id },
        include: { _count: { select: { companies: true } } },
      });
      if (existing) deleteDb = tenantDb;
    }
    if (!existing) {
      return NextResponse.json({ error: 'Group company not found' }, { status: 404, headers: corsHeaders() });
    }

    // Switch to tenant-specific DB for writes
    if (existing && deleteDb === db && existing.tenantId) {
      deleteDb = await getDbForTenantById(existing.tenantId);
    }

    void callerTenantId;

    if (existing._count?.companies && existing._count.companies > 0) {
      return NextResponse.json(
        { error: `Cannot delete group company "${existing.name}" — it still has ${existing._count.companies} compan(y/ies) attached. Delete or move them first.` },
        { status: 409, headers: corsHeaders() }
      );
    }

    await deleteDb.companyGroup.delete({ where: { id } });

    await deleteDb.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_COMPANY_GROUP',
        module: 'company-groups',
        details: `Deleted group company ${existing.name} (${id})`,
      },
    });

    return NextResponse.json({ message: 'Group company deleted' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('DELETE /api/company-groups/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete group company' }, { status: 500, headers: corsHeaders() });
  }
}
