import { NextRequest, NextResponse } from 'next/server';
import { getPlatformDb } from '@/lib/tenant-db';
import { requireSuperAdmin } from '@/lib/superAdminGuard';

/**
 * POST /api/trial/extend
 * Super admin extends the trial period for an approved/active trial.
 */
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { error: 'Only super admins can extend trial registrations' },
      { status: 403 }
    );
  }

  const db = getPlatformDb();
  try {
    const body = await request.json();
    const { registrationId, additionalDays } = body;

    if (!registrationId || !additionalDays) {
      return NextResponse.json({ error: 'registrationId and additionalDays are required' }, { status: 400 });
    }

    const registration = await db.trialRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (!['approved', 'active'].includes(registration.status)) {
      return NextResponse.json({ error: `Cannot extend a registration with status "${registration.status}"` }, { status: 400 });
    }

    // Calculate new trial end
    const currentEnd = registration.trialEnd || new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setDate(newEnd.getDate() + additionalDays);

    await db.trialRegistration.update({
      where: { id: registrationId },
      data: {
        trialEnd: newEnd,
        trialDays: (registration.trialDays || 15) + additionalDays,
        status: 'active',
        notes: `Trial extended by ${additionalDays} days. New end date: ${newEnd.toISOString()}`,
      },
    });

    // Also update the tenant status if it was about to expire
    if (registration.tenantId) {
      await db.tenant.update({
        where: { id: registration.tenantId },
        data: { status: 'trial' },
      });
    }

    return NextResponse.json({
      message: `Trial extended by ${additionalDays} days.`,
      newTrialEnd: newEnd.toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Trial Extend] Error:', error);
    return NextResponse.json(
      { error: 'Failed to extend trial period.' },
      { status: 500 }
    );
  }
}
