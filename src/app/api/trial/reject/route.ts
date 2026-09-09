import { NextRequest, NextResponse } from 'next/server';
import { getPlatformDb } from '@/lib/tenant-db';
import { requireSuperAdmin } from '@/lib/superAdminGuard';

/**
 * POST /api/trial/reject
 * Super admin rejects a trial registration.
 */
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { error: 'Only super admins can reject trial registrations' },
      { status: 403 }
    );
  }

  const db = getPlatformDb();
  try {
    const body = await request.json();
    const { registrationId, rejectionReason, reviewedBy } = body;

    if (!registrationId) {
      return NextResponse.json({ error: 'registrationId is required' }, { status: 400 });
    }

    const registration = await db.trialRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (registration.status !== 'pending') {
      return NextResponse.json({ error: `Registration is already ${registration.status}` }, { status: 400 });
    }

    await db.trialRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'rejected',
        rejectionReason: rejectionReason || 'Not specified',
        reviewedBy: reviewedBy || null,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Trial registration rejected.',
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Trial Reject] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reject trial registration.' },
      { status: 500 }
    );
  }
}
