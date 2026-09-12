import { NextResponse } from 'next/server';
import { getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/admin/register-tenant-dbs
 *
 * Registers the TenantDatabase records for:
 * 1. Demo tenant (3boxes-hrms-demo) → tenant_demo database
 * 2. MarqAI tenant (marqaitechgroup) → tenant_marqaitechgroup database
 *
 * This is CRITICAL for the Golden Rule: each link must have a SEPARATE database.
 *   - 3boxeshrms.com (super admin) → neondb (platform DB)
 *   - nexus-hrms-mu.vercel.app (demo) → tenant_demo
 *   - marqaitechgroup.3boxeshrms.com (tenant) → tenant_marqaitechgroup
 *
 * Without these records, getDbForTenant() falls back to the platform DB,
 * causing all three links to share the SAME database — violating the Golden Rule.
 *
 * This endpoint:
 *   1. Finds the tenant by slug
 *   2. Creates/updates the TenantDatabase record with the correct connection string
 *   3. Returns a summary of what was registered
 *
 * Only super_admin can call this endpoint.
 */

// Neon connection details (same host, different database names)
const NEON_POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech';
const NEON_DIRECT_HOST = 'ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech';
const NEON_USER = 'neondb_owner';
const NEON_PASSWORD = 'npg_pxZd8woKe4WB';

function buildConnectionString(dbName: string, pooled = true): string {
  const host = pooled ? NEON_POOLER_HOST : NEON_DIRECT_HOST;
  return `postgresql://${NEON_USER}:${NEON_PASSWORD}@${host}/${dbName}?sslmode=require&connect_timeout=10`;
}

export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only super_admin can register tenant DBs
    if (decoded.role !== 'super_admin') {
      return NextResponse.json({
        error: 'Only super admin can register tenant databases',
      }, { status: 403 });
    }

    const platformDb = getPlatformDb();
    const results: Array<{ slug: string; tenantName: string; dbName: string; status: string }> = [];

    // ─── Register Demo tenant DB ───
    const demoTenant = await platformDb.tenant.findUnique({
      where: { slug: '3boxes-hrms-demo' },
      select: { id: true, name: true },
    });

    if (demoTenant) {
      const demoConnString = buildConnectionString('tenant_demo');
      const demoDirectUrl = buildConnectionString('tenant_demo', false);

      await platformDb.tenantDatabase.upsert({
        where: { tenantId: demoTenant.id },
        update: {
          connectionString: demoConnString,
          directUrl: demoDirectUrl,
          databaseName: 'tenant_demo',
          isActive: true,
        },
        create: {
          tenantId: demoTenant.id,
          connectionString: demoConnString,
          directUrl: demoDirectUrl,
          databaseName: 'tenant_demo',
          isActive: true,
        },
      });

      results.push({
        slug: '3boxes-hrms-demo',
        tenantName: demoTenant.name,
        dbName: 'tenant_demo',
        status: 'registered',
      });
      console.log(`[RegisterTenantDBs] Registered demo tenant DB: tenant_demo`);
    } else {
      results.push({
        slug: '3boxes-hrms-demo',
        tenantName: 'NOT FOUND',
        dbName: 'tenant_demo',
        status: 'tenant_not_found',
      });
    }

    // ─── Register MarqAI tenant DB ───
    const marqaiTenant = await platformDb.tenant.findUnique({
      where: { slug: 'marqaitechgroup' },
      select: { id: true, name: true },
    });

    if (marqaiTenant) {
      const marqaiConnString = buildConnectionString('tenant_marqaitechgroup');
      const marqaiDirectUrl = buildConnectionString('tenant_marqaitechgroup', false);

      await platformDb.tenantDatabase.upsert({
        where: { tenantId: marqaiTenant.id },
        update: {
          connectionString: marqaiConnString,
          directUrl: marqaiDirectUrl,
          databaseName: 'tenant_marqaitechgroup',
          isActive: true,
        },
        create: {
          tenantId: marqaiTenant.id,
          connectionString: marqaiConnString,
          directUrl: marqaiDirectUrl,
          databaseName: 'tenant_marqaitechgroup',
          isActive: true,
        },
      });

      results.push({
        slug: 'marqaitechgroup',
        tenantName: marqaiTenant.name,
        dbName: 'tenant_marqaitechgroup',
        status: 'registered',
      });
      console.log(`[RegisterTenantDBs] Registered MarqAI tenant DB: tenant_marqaitechgroup`);
    } else {
      results.push({
        slug: 'marqaitechgroup',
        tenantName: 'NOT FOUND',
        dbName: 'tenant_marqaitechgroup',
        status: 'tenant_not_found',
      });
    }

    // ─── Summary ───
    const allTenantDbs = await platformDb.tenantDatabase.findMany({
      include: {
        tenant: { select: { slug: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Registered ${results.filter(r => r.status === 'registered').length} tenant database(s). Each link now has a SEPARATE database.`,
      results,
      goldenRule: {
        '3boxeshrms.com (Super Admin)': 'neondb (platform DB)',
        'nexus-hrms-mu.vercel.app (Demo)': 'tenant_demo (separate DB)',
        'marqaitechgroup.3boxeshrms.com (Tenant)': 'tenant_marqaitechgroup (separate DB)',
      },
      allRegisteredDbs: allTenantDbs.map(td => ({
        tenantSlug: td.tenant?.slug,
        tenantName: td.tenant?.name,
        databaseName: td.databaseName,
        isActive: td.isActive,
      })),
    });
  } catch (error) {
    console.error('[RegisterTenantDBs] Error:', error);
    return NextResponse.json({
      error: 'Failed to register tenant databases',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}

/**
 * GET — returns the current TenantDatabase registration status.
 * Useful for verifying the setup.
 */
export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const platformDb = getPlatformDb();
    const allTenantDbs = await platformDb.tenantDatabase.findMany({
      include: {
        tenant: { select: { slug: true, name: true } },
      },
    });

    return NextResponse.json({
      registeredDatabases: allTenantDbs.map(td => ({
        tenantSlug: td.tenant?.slug,
        tenantName: td.tenant?.name,
        databaseName: td.databaseName,
        isActive: td.isActive,
        connectionString: td.connectionString?.substring(0, 50) + '...',
      })),
      goldenRule: {
        '3boxeshrms.com (Super Admin)': {
          database: 'neondb (platform DB)',
          separate: true,
        },
        'nexus-hrms-mu.vercel.app (Demo)': {
          database: 'tenant_demo (separate DB)',
          separate: allTenantDbs.some(td => td.tenant?.slug === '3boxes-hrms-demo' && td.isActive),
        },
        'marqaitechgroup.3boxeshrms.com (Tenant)': {
          database: 'tenant_marqaitechgroup (separate DB)',
          separate: allTenantDbs.some(td => td.tenant?.slug === 'marqaitechgroup' && td.isActive),
        },
      },
    });
  } catch (error) {
    console.error('[RegisterTenantDBs GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch tenant DB status' }, { status: 500 });
  }
}
