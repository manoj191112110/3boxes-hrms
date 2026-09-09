import { NextResponse } from 'next/server';
import { getPlatformDb } from '@/lib/tenant-db';

export async function GET() {
  const db = getPlatformDb();
  try {
    const now = new Date();

    const activeTrials = await db.trialRegistration.count({
      where: {
        status: { in: ['approved', 'active'] },
        trialEnd: { gte: now },
      },
    });

    const evaluatingCompanies = await db.trialRegistration.count({
      where: {
        status: { in: ['approved', 'active'] },
      },
    });

    const onboardedCompanies = await db.tenant.count({
      where: {
        status: { notIn: ['trial'] },
      },
    });

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

    const pendingRegistrations = await db.trialRegistration.count({
      where: { status: 'pending' },
    });

    const registrations = await db.trialRegistration.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyName: true,
        companyCode: true,
        companyEmail: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        industry: true,
        country: true,
        currency: true,
        employeeCount: true,
        status: true,
        trialDays: true,
        trialStart: true,
        trialEnd: true,
        tempPassword: true,
        rejectionReason: true,
        notes: true,
        tenantId: true,
        createdAt: true,
        reviewedAt: true,
        selectedModules: true,
        companyLogo: true,
      },
    });

    const enriched = registrations.map((reg) => {
      const isExpired = reg.trialEnd && new Date(reg.trialEnd) < now && ['approved', 'active'].includes(reg.status);
      const daysRemaining = reg.trialEnd
        ? Math.max(0, Math.ceil((new Date(reg.trialEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;
      return { ...reg, isExpired, daysRemaining };
    });

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

    const enrichedTenants = tenants.map((t) => {
      const totalEmployees = t.companyGroups?.reduce(
        (sum, cg) => sum + cg.companies?.reduce(
          (cSum, c) => cSum + (c._count?.employees || 0), 0
        ) || 0, 0
      ) || 0;
      const totalCompanies = t.companyGroups?.reduce(
        (sum, cg) => sum + (cg.companies?.length || 0), 0
      ) || 0;
      return { ...t, totalEmployees, totalCompanies };
    });

    // Flat shape expected by super-admin Trials tab (activeTrials at top level)
    return NextResponse.json({
      activeTrials,
      evaluatingCompanies,
      onboardedCompanies,
      notOnboarded,
      pendingRegistrations,
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
