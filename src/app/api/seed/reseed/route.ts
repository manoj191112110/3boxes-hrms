import { NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { isLiveMode } from '@/lib/site-mode';

async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(12);
  return bcryptjs.hash(password, salt);
}

export async function POST(request: Request) {
  // ─── LIVE MODE GUARD ───
  // Reseed is BLOCKED on the live production platform.
  if (isLiveMode(request)) {
    return NextResponse.json({
      error: 'Reseeding is disabled on the live platform. This feature is only available on the demo site.',
      code: 'LIVE_MODE_BLOCKED',
    }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { secret } = body;

    if (secret !== '3boxes-reseed-2025') {
      return NextResponse.json({ error: 'Invalid reseed secret' }, { status: 403 });
    }

    console.log('[Reseed] Starting database reseed...');

    // BRANDING GUARD: After any reseed operation, ALWAYS force the tenant name
    // to "Marq AI Tech Pvt Ltd" to prevent eh2r or any other wrong branding from showing.
    // This is a critical business requirement.

    // Create a PrismaClient that works with whatever DB is available
    const { PrismaClient } = await import('@/generated/prisma/client');
    const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

    let prisma: InstanceType<typeof PrismaClient>;

    if (connectionString && connectionString.startsWith('postgres')) {
      // Use Neon adapter for PostgreSQL
      try {
        const { PrismaNeon } = await import('@prisma/adapter-neon');
        const adapter = new PrismaNeon({ connectionString });
        prisma = new PrismaClient({ adapter }) as InstanceType<typeof PrismaClient>;
      } catch {
        // Fallback to regular client
        prisma = new PrismaClient({ datasourceUrl: connectionString }) as InstanceType<typeof PrismaClient>;
      }
    } else {
      // Use regular PrismaClient for SQLite or other databases
      prisma = new PrismaClient(connectionString ? { datasourceUrl: connectionString } : {}) as InstanceType<typeof PrismaClient>;
    }

    try {
      // ============================================================
      // STEP 1: Fix any existing tenant(s) — rename EH2R or any
      // non-3-Boxes tenant to "Marq AI Tech Pvt Ltd"
      // ============================================================
      const allTenants = await prisma.tenant.findMany();
      console.log('[Reseed] Found', allTenants.length, 'tenant(s):', allTenants.map(t => `${t.name} (${t.slug})`));

      let tenant = allTenants.find((t: any) => t.slug === '3boxes-corp' || t.slug === '3boxes-hrms-demo');

      if (tenant) {
        // Update existing 3Boxes tenant to correct name
        tenant = await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            name: 'Marq AI Tech Pvt Ltd',
            domain: '3boxeshrms.com',
          },
        });
        console.log('[Reseed] Updated existing 3Boxes tenant:', tenant.id, tenant.name);
      } else if (allTenants.length > 0) {
        // Take the first existing tenant (could be EH2R or anything else) and rebrand it
        const existingTenant = allTenants[0];
        tenant = await prisma.tenant.update({
          where: { id: existingTenant.id },
          data: {
            name: 'Marq AI Tech Pvt Ltd',
            slug: '3boxes-corp',
            domain: '3boxeshrms.com',
            plan: 'enterprise',
            status: 'active',
          },
        });
        console.log('[Reseed] Rebranded existing tenant to Marq AI Tech Pvt Ltd:', tenant.id, '(was:', existingTenant.name, ')');
      } else {
        // No tenants exist — create one
        tenant = await prisma.tenant.create({
          data: {
            name: 'Marq AI Tech Pvt Ltd',
            slug: '3boxes-corp',
            domain: '3boxeshrms.com',
            plan: 'enterprise',
            status: 'active',
            country: 'US',
            currency: 'USD',
            timezone: 'America/New_York',
          },
        });
        console.log('[Reseed] Created new tenant:', tenant.id);
      }

      // Also rename any OTHER tenants that have EH2R or wrong names
      for (const otherTenant of allTenants) {
        if (otherTenant.id !== tenant.id) {
          const nameLower = otherTenant.name.toLowerCase();
          if (nameLower.includes('eh2r') || nameLower.includes('ehhr') || nameLower.includes('nexus') || !nameLower.includes('3 boxes')) {
            // Move all users from this tenant to the main 3Boxes tenant
            const movedCount = await prisma.user.updateMany({
              where: { tenantId: otherTenant.id },
              data: { tenantId: tenant.id },
            });
            console.log(`[Reseed] Moved ${movedCount.count} users from "${otherTenant.name}" to "Marq AI Tech Pvt Ltd"`);

            // Delete the old tenant
            await prisma.tenant.delete({ where: { id: otherTenant.id } });
            console.log(`[Reseed] Deleted old tenant: "${otherTenant.name}" (${otherTenant.id})`);
          }
        }
      }

      // ============================================================
      // STEP 2: Ensure the main tenant has correct details
      // ============================================================
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          name: 'Marq AI Tech Pvt Ltd',
          slug: '3boxes-corp',
          domain: '3boxeshrms.com',
          plan: 'enterprise',
          status: 'active',
          country: 'US',
          currency: 'USD',
          timezone: 'America/New_York',
        },
      });

      // ============================================================
      // STEP 3: Hash passwords and upsert demo users
      // ============================================================
      const passwordHashes = await Promise.all([
        hashPassword('admin123'),
        hashPassword('hr123'),
        hashPassword('manager123'),
        hashPassword('employee123'),
        hashPassword('recruiter123'),
        hashPassword('candidate123'),
      ]);

      const demoUsers = [
        { email: 'admin@3boxeshrms.com', name: 'Admin 3Boxes', role: 'super_admin', password: passwordHashes[0] },
        { email: 'hr@3boxeshrms.com', name: 'Sarah Johnson', role: 'admin', password: passwordHashes[1] },
        { email: 'manager@3boxeshrms.com', name: 'Priya Sharma', role: 'admin', password: passwordHashes[2] },
        { email: 'employee@3boxeshrms.com', name: 'Raj Patel', role: 'admin', password: passwordHashes[3] },
      ];

      const upsertedUsers = [];
      for (const userData of demoUsers) {
        try {
          const user = await prisma.user.upsert({
            where: { email: userData.email },
            update: {
              password: userData.password,
              name: userData.name,
              role: userData.role,
              status: 'active',
              tenantId: tenant.id,
            },
            create: {
              email: userData.email,
              password: userData.password,
              name: userData.name,
              role: userData.role,
              status: 'active',
              tenantId: tenant.id,
            },
          });
          upsertedUsers.push(user);
        } catch (err) {
          console.error('[Reseed] Error upserting user:', userData.email, err);
        }
      }

      console.log('[Reseed] Upserted', upsertedUsers.length, 'demo users');

      // ============================================================
      // STEP 4: Fix any users still linked to wrong tenant
      // ============================================================
      const wrongTenantUsers = await prisma.user.findMany({
        where: { NOT: { tenantId: tenant.id } },
      });
      if (wrongTenantUsers.length > 0) {
        const fixResult = await prisma.user.updateMany({
          where: { NOT: { tenantId: tenant.id } },
          data: { tenantId: tenant.id },
        });
        console.log(`[Reseed] Fixed ${fixResult.count} users linked to wrong tenant`);
      }

      // Verify password works
      let verifiedCount = 0;
      const plainPasswords = ['admin123', 'hr123', 'manager123', 'employee123', 'recruiter123', 'candidate123'];
      for (let i = 0; i < upsertedUsers.length; i++) {
        try {
          const match = await bcryptjs.compare(plainPasswords[i], upsertedUsers[i].password);
          if (match) verifiedCount++;
        } catch {
          // skip
        }
      }

      return NextResponse.json({
        success: true,
        message: `Reseeded ${upsertedUsers.length} users. ${verifiedCount}/${upsertedUsers.length} passwords verified. All tenants rebranded to "Marq AI Tech Pvt Ltd".`,
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        users: upsertedUsers.map((u: any) => ({ id: u.id, email: u.email, role: u.role, status: u.status })),
      });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('[Reseed] Error:', error);
    return NextResponse.json(
      { error: 'Reseed failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
