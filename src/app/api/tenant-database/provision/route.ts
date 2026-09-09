import { NextResponse } from 'next/server';
import { getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { registerTenantDatabase } from '@/lib/tenant-db';

/**
 * POST /api/tenant-database/provision
 *
 * Provisions a new Neon database for a tenant.
 * Only super_admin can call this.
 *
 * Body:
 *   tenantId: string        - The tenant to provision a DB for
 *   neonApiKey: string      - Neon API key for creating the database
 *   neonProjectId?: string  - Existing Neon project ID (creates new if not provided)
 *
 * The flow:
 *   1. Validate super_admin access
 *   2. Create a new Neon database (or use existing project)
 *   3. Run schema migrations on the new database
 *   4. Register the database in TenantDatabase table
 *   5. Migrate relevant data from shared DB to tenant DB (optional)
 */
export async function POST(request: Request) {
  try {
    // Verify super_admin access
    const token = getTokenFromHeaders(request);
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can provision tenant databases' }, { status: 403 });
    }

    const body = await request.json();
    const { tenantId, connectionString, databaseName, neonProjectId, neonBranchId } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Verify tenant exists
    const platformDb = getPlatformDb();
    const tenant = await platformDb.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // For now, we accept a connection string directly.
    // In production, this would integrate with the Neon API to create the database.
    if (!connectionString) {
      return NextResponse.json(
        { error: 'connectionString is required. Use the Neon API to create a database first, then provide its connection string.' },
        { status: 400 }
      );
    }

    if (!databaseName) {
      return NextResponse.json({ error: 'databaseName is required' }, { status: 400 });
    }

    // Register the tenant database
    const tenantDb = await registerTenantDatabase({
      tenantId,
      connectionString,
      databaseName,
      neonProjectId,
      neonBranchId,
    });

    return NextResponse.json({
      message: `Database provisioned for tenant "${tenant.name}"`,
      tenantDatabase: {
        id: tenantDb.id,
        tenantId: tenantDb.tenantId,
        databaseName: tenantDb.databaseName,
        isActive: tenantDb.isActive,
        provisionedAt: tenantDb.provisionedAt,
      },
    });
  } catch (error) {
    console.error('Tenant database provision error:', error);
    return NextResponse.json(
      { error: 'Failed to provision tenant database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
