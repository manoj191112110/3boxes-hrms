import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

/**
 * /api/fix-tenant
 *
 * Historically this endpoint force-renamed every tenant to "Marq AI Tech Pvt Ltd" and
 * merged all extra tenants into a single one — that was a branding-lockdown
 * tool from the early single-tenant era of the app.
 *
 * The app now supports TRUE multi-tenancy: super admins can create multiple
 * tenants with their own custom names, each with their own admins, group
 * companies, companies and employees. The old branding guard would destroy
 * that setup every time it ran, so this endpoint has been neutralised.
 *
 * Calling it now just returns a harmless status report — it does NOT mutate
 * any tenant records.
 */
export async function GET() {
  try {
    const tenants = await getPlatformDb().tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
        maxCompaniesAllowed: true,
        _count: { select: { companyGroups: true, users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      message:
        'Multi-tenant mode is enabled. Tenant branding is no longer force-locked — each tenant keeps its own name.',
      multiTenantEnabled: true,
      tenantsCount: tenants.length,
      tenants,
    });
  } catch (error) {
    console.error('[FixTenant] Error:', error);
    return NextResponse.json(
      { error: 'Fix tenant failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Also support POST for convenience
export async function POST() {
  return GET();
}
