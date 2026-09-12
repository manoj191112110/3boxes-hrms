import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

/**
 * GET /api/trial/list
 * Super admin lists all trial registrations.
 * Supports filtering by status: ?status=pending|approved|rejected|active|expired
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const registrations = await db.trialRegistration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyName: true,
        companyCode: true,
        companyEmail: true,
        companyPhone: true,
        companyWebsite: true,
        industry: true,
        country: true,
        currency: true,
        employeeCount: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        designation: true,
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
      },
    });

    // Mark expired trials
    const now = new Date();
    const enriched = registrations.map((reg: any) => {
      const isExpired = reg.trialEnd && new Date(reg.trialEnd) < now && ['approved', 'active'].includes(reg.status);
      return {
        ...reg,
        isExpired,
        daysRemaining: reg.trialEnd
          ? Math.max(0, Math.ceil((new Date(reg.trialEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : null,
      };
    });

    return NextResponse.json({ registrations: enriched }, { status: 200 });

  } catch (error: any) {
    console.error('[Trial List] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trial registrations.' },
      { status: 500 }
    );
  }
}
