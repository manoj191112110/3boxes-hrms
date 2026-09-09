import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

/**
 * POST /api/trial/check-domain
 * Public endpoint — checks if a company code/slug is available.
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const body = await request.json();
    const { companyCode } = body;

    if (!companyCode) {
      return NextResponse.json({ error: 'companyCode is required' }, { status: 400 });
    }

    const slug = companyCode
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Check tenants
    const existingTenant = await db.tenant.findFirst({
      where: { slug },
    });

    // Check pending registrations
    const existingRegistration = await db.trialRegistration.findFirst({
      where: { companyCode: slug },
    });

    if (existingTenant) {
      return NextResponse.json({
        available: false,
        slug,
        reason: 'This company code is already taken by an active tenant.',
      }, { status: 200 });
    }

    if (existingRegistration && existingRegistration.status === 'pending') {
      return NextResponse.json({
        available: false,
        slug,
        reason: 'This company code has a pending registration.',
      }, { status: 200 });
    }

    return NextResponse.json({
      available: true,
      slug,
      subdomain: `${slug}.3boxeshrms.com`,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Trial Check Domain] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check domain availability.' },
      { status: 500 }
    );
  }
}
