import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenant, getDbForTenantById } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { getCompanyFilter } from '@/lib/companyScope';
import { withRouteCache } from '@/lib/api-route-cache';
import { isServerLiveSite } from '@/lib/tenant-filter';

const CACHE_MS = 120_000;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

async function resolveQueryDb(req: NextRequest, jwtRole: string) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenantId');
  const queryCompanyId = url.searchParams.get('companyId');
  let db = await getDb(req);

  if (jwtRole === 'super_admin') {
    if (tenantId) {
      db = await getDbForTenantById(tenantId);
    } else if (queryCompanyId) {
      let company = await db.company.findUnique({ where: { id: queryCompanyId }, select: { companyGroupId: true } }).catch(() => null);
      if (!company) {
        company = await getPlatformDb().company.findUnique({ where: { id: queryCompanyId }, select: { companyGroupId: true } }).catch(() => null);
      }
      if (company?.companyGroupId) {
        let group = await db.companyGroup.findUnique({ where: { id: company.companyGroupId }, select: { tenantId: true } }).catch(() => null);
        if (!group) {
          group = await getPlatformDb().companyGroup.findUnique({ where: { id: company.companyGroupId }, select: { tenantId: true } }).catch(() => null);
        }
        if (group?.tenantId) {
          db = await getDbForTenantById(group.tenantId);
        }
      }
    }
  }

  return { db, tenantId, queryCompanyId };
}

/**
 * GET /api/master-data
 * Single BFF for dropdown/master data — replaces 7 parallel API calls.
 */
export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromHeaders(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    }

    const jwtRole = (decoded.role as string) || 'employee';
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenantId') || '';
    const groupId = url.searchParams.get('groupId') || '';
    const companyId = url.searchParams.get('companyId') || '';

    if (jwtRole === 'super_admin' && !tenantId && !companyId && isServerLiveSite(req)) {
      return NextResponse.json(
        { companies: [], branches: [], departments: [], designations: [], shifts: [], holidays: [], policies: [] },
        { headers: corsHeaders() },
      );
    }

    const companyFilter = await getCompanyFilter(req);
    if (companyFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const cacheKey = `master-data:${jwtRole}:${tenantId}:${groupId}:${companyId}:${JSON.stringify(companyFilter)}`;

    const payload = await withRouteCache(cacheKey, CACHE_MS, async () => {
      const { db } = await resolveQueryDb(req, jwtRole);

      const branchWhere: Record<string, unknown> = { status: 'active', ...companyFilter };
      const deptWhere: Record<string, unknown> = { status: 'active', ...companyFilter };
      const desigWhere: Record<string, unknown> = { status: 'active' };
      const shiftWhere: Record<string, unknown> = { status: 'active', ...companyFilter };
      const holidayWhere: Record<string, unknown> = { ...companyFilter };
      const policyWhere: Record<string, unknown> = { status: 'active', ...companyFilter };

      if (companyId) {
        desigWhere.department = { companyId };
      } else if (companyFilter.companyId) {
        desigWhere.department = { companyId: companyFilter.companyId };
      }

      const companiesWhere: Record<string, unknown> = {};
      if (groupId) {
        companiesWhere.companyGroupId = groupId;
      } else if (tenantId && jwtRole === 'super_admin') {
        const groups = await db.companyGroup.findMany({
          where: { tenantId },
          select: { id: true },
        });
        companiesWhere.companyGroupId = { in: groups.map((g) => g.id) };
      } else if (companyId) {
        companiesWhere.id = companyId;
      }

      const [companies, branches, departments, designations, shifts, holidays, policies] = await Promise.all([
        db.company.findMany({
          where: companiesWhere,
          select: {
            id: true, name: true, code: true, city: true, state: true, country: true,
            status: true, taxId: true, phone: true, email: true, website: true,
            address: true, zipCode: true, currency: true, timezone: true,
            companyGroup: { select: { id: true, name: true, tenantId: true } },
          },
          orderBy: { name: 'asc' },
          take: 200,
        }),
        db.branch.findMany({
          where: branchWhere,
          select: {
            id: true, name: true, code: true, companyId: true, city: true, state: true,
            country: true, address: true, zipCode: true, phone: true, email: true, status: true,
            company: { select: { id: true, name: true, code: true } },
          },
          orderBy: { name: 'asc' },
          take: 100,
        }),
        db.department.findMany({
          where: deptWhere,
          select: {
            id: true, name: true, code: true, companyId: true, status: true,
            company: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
          },
          orderBy: { name: 'asc' },
          take: 100,
        }),
        db.designation.findMany({
          where: desigWhere,
          select: {
            id: true, title: true, departmentId: true, level: true,
            minSalary: true, maxSalary: true, status: true,
            department: { select: { id: true, name: true } },
          },
          orderBy: { title: 'asc' },
          take: 100,
        }),
        db.shift.findMany({
          where: shiftWhere,
          select: {
            id: true, name: true, startTime: true, endTime: true,
            breakDuration: true, breakMinutes: true, graceTime: true, status: true,
          },
          orderBy: { name: 'asc' },
          take: 100,
        }),
        db.holiday.findMany({
          where: holidayWhere,
          select: { id: true, name: true, date: true, type: true, country: true, description: true },
          orderBy: { date: 'asc' },
          take: 100,
        }),
        db.policy.findMany({
          where: policyWhere,
          select: {
            id: true, title: true, category: true, description: true,
            version: true, status: true, effectiveDate: true, expiryDate: true,
          },
          orderBy: { title: 'asc' },
          take: 100,
        }),
      ]);

      return {
        companies,
        branches,
        departments,
        designations,
        shifts: shifts.map((s) => ({
          ...s,
          breakDuration: s.breakDuration ?? s.breakMinutes ?? 60,
          graceTime: s.graceTime ?? 15,
        })),
        holidays,
        policies,
      };
    });

    return NextResponse.json(payload, { headers: corsHeaders() });
  } catch (error) {
    console.error('[master-data] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
