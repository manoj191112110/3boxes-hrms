import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export async function GET() {
  try {
    const now = new Date();

    // Active trials (approved/active and not expired)
    const activeTrials = await db.trialRegistration.count({
      where: {
        status: { in: ['approved', 'active'] },
        trialEnd: { gte: now },
      },
    });

    // Evaluating companies (approved/active regardless of expiry)
    const evaluatingCompanies = await db.trialRegistration.count({
      where: {
        status: { in: ['approved', 'active'] },
      },
    });

    // Onboarded companies (tenants that are active/paid — not trial status)
    const onboardedCompanies = await db.tenant.count({
      where: {
        status: { notIn: ['trial'] },
      },
    });

    // Not onboarded (expired trials that didn't convert)
    const notOnboarded = await db.trialRegistration.count({
      where: {
        OR: [
          { status: 'expired' },
          {
            status: { in: ['approved', 'active'] },
            trialEnd: { lt: now },
          },
        ],
      },
    });

    // Pending registrations
    const pendingRegistrations = await db.trialRegistration.count({
      where: { status: 'pending' },
    });

    // All registrations with enriched data
    const registrations = await db.trialRegistration.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyName: true,
        companyCode: true,
        companyEmail: true,
        contactName: true,
        contactEmail: true,
        industry: true,
        country: true,
        employeeCount: true,
        status: true,
        trialDays: true,
        trialStart: true,
        trialEnd: true,
        tempPassword: true,
        tenantId: true,
        createdAt: true,
        selectedModules: true,
        companyLogo: true,
      },
    });

    // Enrich with isExpired and daysRemaining
    const enriched = registrations.map((reg: any) => {
      const isExpired = reg.trialEnd && new Date(reg.trialEnd) < now && ['approved', 'active'].includes(reg.status);
      const daysRemaining = reg.trialEnd
        ? Math.max(0, Math.ceil((new Date(reg.trialEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;
      return { ...reg, isExpired, daysRemaining };
    });

    // All tenants for tenant switching
    const tenants = await db.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        domain: true,
        logo: true,
        createdAt: true,
        companyGroups: {
          select: {
            companies: {
              select: {
                id: true,
                name: true,
                code: true,
                _count: { select: { employees: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich tenants with total employee count
    const enrichedTenants = tenants.map((t: any) => {
      const totalEmployees = t.companyGroups?.reduce(
        (sum: number, cg: any) => sum + cg.companies?.reduce(
          (cSum: number, c: any) => cSum + (c._count?.employees || 0), 0
        ) || 0, 0
      ) || 0;
      const totalCompanies = t.companyGroups?.reduce(
        (sum: number, cg: any) => sum + (cg.companies?.length || 0), 0
      ) || 0;
      return { ...t, totalEmployees, totalCompanies };
    });

    return NextResponse.json({
      stats: {
        activeTrials,
        evaluatingCompanies,
        onboardedCompanies,
        notOnboarded,
        pendingRegistrations,
      },
      registrations: enriched,
      tenants: enrichedTenants,
    });
  } catch (error: any) {
    console.error('[Trial Stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trial stats', details: error.message },
      { status: 500 }
    );
  }
}
