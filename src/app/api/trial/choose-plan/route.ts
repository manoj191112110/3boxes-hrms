import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

/**
 * POST /api/trial/choose-plan
 * Records the user's plan choice after confirming trial.
 * Updates tenant plan and TrialRegistration.planConfirmed.
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const body = await request.json();
    const { plan, tenantSlug, email } = body;

    if (!plan || !tenantSlug) {
      return NextResponse.json({ error: 'plan and tenantSlug are required' }, { status: 400 });
    }

    // Find the tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Update tenant plan
    await db.tenant.update({
      where: { id: tenant.id },
      data: { plan: plan.toLowerCase() },
    });

    // Mark the trial registration plan as confirmed
    const registration = await db.trialRegistration.findFirst({
      where: { tenantId: tenant.id },
    });

    if (registration) {
      await db.trialRegistration.update({
        where: { id: registration.id },
        data: { planConfirmed: true },
      });
    }

    return NextResponse.json({
      message: 'Plan selection recorded successfully.',
      plan: plan.toLowerCase(),
      redirectUrl: `https://${tenantSlug}.3boxeshrms.com/login`,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Choose Plan] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save plan selection.' },
      { status: 500 }
    );
  }
}
