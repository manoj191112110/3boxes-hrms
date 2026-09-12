import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getCompanyFilter, getAuthInfo } from '@/lib/companyScope';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
  });
}

// GET /api/leave-policy-config — Fetch the global leave config for the current company
export async function GET(request: Request) {
  try {
    const db = await getDb(request);
    const companyFilter = await getCompanyFilter(request);
    if (companyFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Look for a LeavePolicyRule with employmentType 'all' as the global config
    const globalConfig = await db.leavePolicyRule.findFirst({
      where: {
        employmentType: 'all',
        status: 'active',
        ...companyFilter,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ config: globalConfig || {} });
  } catch (error) {
    console.error('[leave-policy-config] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/leave-policy-config — Upsert the global leave config
export async function PUT(request: Request) {
  try {
    const db = await getDb(request);
    const companyFilter = await getCompanyFilter(request);
    const authInfo = await getAuthInfo(request);
    if (companyFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      carryForward, maxCarryForward, proRateJoining,
      sandwichRule, minAdvanceNotice, probationRestriction,
      casualLeavePerYear, sickLeavePerYear, earnedLeavePerYear,
      leaveEncashment, probationLeaveQuota,
    } = body;

    const companyId = companyFilter.companyId;

    // Upsert: find existing global config rule or create one
    const existing = await db.leavePolicyRule.findFirst({
      where: { employmentType: 'all', status: 'active', ...companyFilter },
    });

    let result;
    if (existing) {
      result = await db.leavePolicyRule.update({
        where: { id: existing.id },
        data: {
          carryForwardGlobal: carryForward ?? existing.carryForwardGlobal,
          maxCarryForwardDays: maxCarryForward ?? existing.maxCarryForwardDays,
          proRataEnabled: proRateJoining ?? existing.proRataEnabled,
          sandwichRuleEnabled: sandwichRule ?? existing.sandwichRuleEnabled,
          probationRestriction: probationRestriction ?? existing.probationRestriction,
          probationMonths: minAdvanceNotice ?? existing.probationMonths,
          encashmentAllowed: leaveEncashment ?? existing.encashmentAllowed,
          updatedAt: new Date(),
        },
      });
    } else {
      result = await db.leavePolicyRule.create({
        data: {
          name: 'Global Leave Config',
          employmentType: 'all',
          companyId: companyId,
          leaveTypeAllocations: JSON.stringify([
            { leaveTypeName: 'Casual Leave', quota: casualLeavePerYear || 12 },
            { leaveTypeName: 'Sick Leave', quota: sickLeavePerYear || 10 },
            { leaveTypeName: 'Earned Leave', quota: earnedLeavePerYear || 15 },
          ]),
          sandwichRuleEnabled: sandwichRule ?? false,
          proRataEnabled: proRateJoining ?? true,
          probationRestriction: probationRestriction ?? true,
          probationMonths: minAdvanceNotice ?? 6,
          encashmentAllowed: leaveEncashment ?? true,
          carryForwardGlobal: carryForward ?? true,
          maxCarryForwardDays: maxCarryForward ?? 5,
          priority: 0,
          status: 'active',
        },
      });
    }

    return NextResponse.json({ config: result });
  } catch (error) {
    console.error('[leave-policy-config] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
