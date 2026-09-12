import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getCompanyFilter, getAuthInfo, resolveCompanyScope } from '@/lib/companyScope';

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

// GET: List all leave types (company-scoped)
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    // Employee self-service ('self' scope): restrict the list to the types of
    // the employee's OWN company. getCompanyFilter returns {} for employees,
    // which made the apply dropdown show every company's leave types — and
    // submitting one from another company is rejected by the leave POST
    // validation. (2026-09-09)
    const scope = await resolveCompanyScope(req);
    if (scope && scope.scope === 'self' && !scope.companyId) {
      const own = await db.employee.findFirst({
        where: { userId: scope.userId, status: 'active' },
        select: { companyId: true },
      });
      if (own?.companyId) {
        companyFilter.companyId = own.companyId;
      }
    }

    const leaveTypes = await db.leaveType.findMany({
      where: { status: 'active', ...companyFilter },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: leaveTypes }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Leave types GET error:', error);
    return NextResponse.json({ data: [] }, { headers: corsHeaders() });
  }
}

// POST: Create a new leave type
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json();
    const { name, code, description, defaultDays, isPaid, carryForward, maxCarryForward, companyId,
            employmentType, employeeStatus, probationRestricted, sandwichRuleEnabled } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400, headers: corsHeaders() });
    }

    // ─── Validate name format (letters and spaces only, 2-50 chars) ───
    if (!/^[A-Za-z][A-Za-z\s'-]{1,49}$/.test(name)) {
      return NextResponse.json({ error: 'Name must be 2–50 characters and contain only letters, spaces, hyphens, or apostrophes' }, { status: 400, headers: corsHeaders() });
    }

    // ─── Validate code format (2-10 uppercase letters) ───
    const upperCode = code.toUpperCase();
    if (!/^[A-Z]{2,10}$/.test(upperCode)) {
      return NextResponse.json({ error: 'Code must be 2–10 uppercase letters (A–Z) only' }, { status: 400, headers: corsHeaders() });
    }

    // ─── Validate defaultDays ───
    const dd = Number(defaultDays ?? 0);
    if (isNaN(dd) || dd < 0 || dd > 366) {
      return NextResponse.json({ error: 'Annual quota (defaultDays) must be a number between 0 and 366' }, { status: 400, headers: corsHeaders() });
    }

    // Resolve companyId: from body, from user's scope, or from ownCompanyId
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId) {
      const companyFilter = await getCompanyFilter(req);
      if (companyFilter && 'companyId' in companyFilter) {
        resolvedCompanyId = companyFilter.companyId as string;
      }
    }
    if (!resolvedCompanyId) {
      const scope = await resolveCompanyScope(req);
      if (scope?.ownCompanyId) {
        resolvedCompanyId = scope.ownCompanyId;
      }
    }

    if (!resolvedCompanyId) {
      return NextResponse.json({ error: 'Company ID is required. Please select a company from the switcher.' }, { status: 400, headers: corsHeaders() });
    }

    // ─── Check for duplicate code within the same company ───
    const existingByCode = await db.leaveType.findFirst({
      where: { code: upperCode, companyId: resolvedCompanyId },
      select: { id: true, name: true },
    });
    if (existingByCode) {
      return NextResponse.json({ error: `A leave type with code "${upperCode}" already exists for this company` }, { status: 409, headers: corsHeaders() });
    }

    // ─── Check for duplicate name within the same company ───
    const existingByName = await db.leaveType.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, companyId: resolvedCompanyId },
      select: { id: true, code: true },
    });
    if (existingByName) {
      return NextResponse.json({ error: `A leave type with name "${name}" already exists for this company` }, { status: 409, headers: corsHeaders() });
    }

    const leaveType = await db.leaveType.create({
      data: {
        name,
        code: upperCode,
        description: description || null,
        defaultDays: dd,
        isPaid: isPaid ?? true,
        carryForward: carryForward ?? false,
        maxCarryForward: maxCarryForward ?? 0,
        status: 'active',
        companyId: resolvedCompanyId,
        // Employee scope (new — rules mapped to leave types)
        employmentType: ['all', 'full-time', 'part-time', 'contract', 'internship'].includes(String(employmentType))
          ? String(employmentType) : 'all',
        employeeStatus: ['all', 'active', 'on_leave', 'inactive'].includes(String(employeeStatus))
          ? String(employeeStatus) : 'all',
        probationRestricted: probationRestricted ?? false,
        sandwichRuleEnabled: sandwichRuleEnabled ?? true,
      },
    });

    return NextResponse.json({ leaveType }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Leave types POST error:', error);
    return NextResponse.json({ error: 'Failed to create leave type' }, { status: 500, headers: corsHeaders() });
  }
}
