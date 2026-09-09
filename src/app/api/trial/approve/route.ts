import { NextRequest, NextResponse } from 'next/server';
import { getPlatformDb } from '@/lib/tenant-db';
import { requireSuperAdmin } from '@/lib/superAdminGuard';
import {
  provisionDedicatedTenantDatabase,
  rollbackFailedTrialProvision,
  sanitizeTenantDatabaseName,
  type TrialRegistrationRecord,
} from '@/lib/tenant-provision';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const TRANSACTION_OPTS = { maxWait: 15_000, timeout: 30_000 };

// Neon create + schema sync can take 60–120s on Vercel
export const maxDuration = 300;

/**
 * POST /api/trial/approve
 * Super admin approves a trial registration.
 *
 * 1. Creates Tenant + User in the platform DB (auth registry).
 * 2. Provisions a dedicated Neon database (tenant_<slug>).
 * 3. Seeds company/employee/roles into the tenant DB.
 * 4. Registers the TenantDatabase link for routing.
 */
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { error: 'Only super admins can approve trial registrations' },
      { status: 403 }
    );
  }

  const platformDb = getPlatformDb();

  try {
    const body = await request.json();
    const { registrationId, trialDays, reviewedBy } = body;

    if (!registrationId) {
      return NextResponse.json({ error: 'registrationId is required' }, { status: 400 });
    }

    const registration = await platformDb.trialRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (registration.status !== 'pending') {
      return NextResponse.json(
        { error: `Registration is already ${registration.status}` },
        { status: 400 }
      );
    }

    const existingTenant = await platformDb.tenant.findUnique({
      where: { slug: registration.companyCode },
      select: { id: true },
    });
    if (existingTenant) {
      return NextResponse.json(
        { error: `A tenant with code "${registration.companyCode}" already exists` },
        { status: 409 }
      );
    }

    const days = trialDays || registration.trialDays || 15;
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + days);

    const tempPassword = crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const reviewerId = reviewedBy || admin.userId || null;

    // Phase 1: minimal platform records (registry + login lookup)
    const result = await platformDb.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: registration.companyName,
          slug: registration.companyCode,
          domain: `${registration.companyCode}.3boxeshrms.com`,
          plan: 'starter',
          status: 'trial',
          country: registration.country,
          currency: registration.currency || 'INR',
          language: 'en',
          subscriptionSeats: 10,
        },
      });

      const user = await tx.user.create({
        data: {
          email: registration.contactEmail,
          password: hashedPassword,
          name: registration.contactName,
          tenantId: tenant.id,
          role: 'tenant_admin',
          status: 'active',
        },
      });

      await tx.trialRegistration.update({
        where: { id: registrationId },
        data: {
          status: 'approved',
          trialDays: days,
          trialStart: now,
          trialEnd: trialEnd,
          tempPassword,
          reviewedBy: reviewerId,
          reviewedAt: now,
          tenantId: tenant.id,
        },
      });

      return { tenant, user, companyCode: registration.companyCode };
    }, TRANSACTION_OPTS);

    const databaseName = sanitizeTenantDatabaseName(result.tenant.slug);
    const registrationRecord: TrialRegistrationRecord = {
      id: registration.id,
      companyName: registration.companyName,
      companyCode: registration.companyCode,
      country: registration.country,
      currency: registration.currency,
      companyEmail: registration.companyEmail,
      companyPhone: registration.companyPhone,
      companyWebsite: registration.companyWebsite,
      address: registration.address,
      city: registration.city,
      state: registration.state,
      zipCode: registration.zipCode,
      contactEmail: registration.contactEmail,
      contactName: registration.contactName,
      contactPhone: registration.contactPhone,
      employeeCount: registration.employeeCount,
    };

    // Phase 2: dedicated Neon DB (outside transaction — can take 30–90s)
    try {
      const provision = await provisionDedicatedTenantDatabase({
        tenant: result.tenant,
        user: result.user,
        registration: registrationRecord,
        hashedPassword,
        reviewedBy: reviewerId,
        now,
      });

      return NextResponse.json(
        {
          message: 'Trial approved. Dedicated tenant database provisioned.',
          tenantId: result.tenant.id,
          databaseName: provision.databaseName,
          loginEmail: registration.contactEmail,
          tempPassword,
          loginUrl: `https://3boxeshrms.com/login?tenant=${result.companyCode}`,
          brandedLoginUrl: `https://${result.companyCode}.3boxeshrms.com/login`,
          trialDays: days,
          trialEnd: trialEnd.toISOString(),
        },
        { status: 200 }
      );
    } catch (provisionError: unknown) {
      const message =
        provisionError instanceof Error ? provisionError.message : String(provisionError);
      console.error('[Trial Approve] Provisioning failed, rolling back:', provisionError);

      await rollbackFailedTrialProvision({
        registrationId,
        tenantId: result.tenant.id,
        databaseName,
      });

      return NextResponse.json(
        {
          error: 'Failed to provision dedicated tenant database',
          details: message,
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Trial Approve] Error:', error);
    return NextResponse.json(
      { error: 'Failed to approve trial. Please try again.', details: message },
      { status: 500 }
    );
  }
}
