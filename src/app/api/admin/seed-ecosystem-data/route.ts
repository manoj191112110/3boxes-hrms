/**
 * Admin-only Ecosystem sample-data seeder.
 *
 * POST /api/admin/seed-ecosystem-data
 *   Body: { module?: "clients" | "vendors" | "marketplace" | "wellness" | "collaboration" | "all" }
 *
 * Idempotent — uses findFirst-then-create / where-unique upserts so re-running
 * the same module won't create duplicate rows. Backed by the full Prisma
 * schema for Client/Vendor/Marketplace/Wellness/Collaboration (SRS §8 + §9 + §7).
 *
 * All seeding logic lives in /src/lib/ecosystem/seeder.ts so it can be shared
 * with the public auto-seed endpoint (/api/auto-seed-demo).
 *
 * ⚠️ LIVE MODE GUARD: This endpoint is BLOCKED on the production platform.
 * Only works on the demo domain (nexus-hrms-mu.vercel.app).
 */
import { requireUser, isAdminRole, ok, fail, OPTIONS, parseBody } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { isLiveMode } from '@/lib/site-mode';
import {
  seedClients,
  seedVendors,
  seedMarketplace,
  seedWellness,
  seedCollaboration,
  type SeedEmployee,
} from '@/lib/ecosystem/seeder';

export { OPTIONS };

export async function POST(request: Request) {
  // ─── LIVE MODE GUARD ───
  // Ecosystem sample data seeding is STRICTLY PROHIBITED on the live platform.
  if (isLiveMode(request)) {
    return fail('Ecosystem data seeding is disabled on the live platform. This feature is only available on the demo site (nexus-hrms-mu.vercel.app).', 403);
  }

  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);

  const body = await parseBody(request);
  const module = body?.module || 'all';

  const results: Record<string, { created: number; skipped: number; note?: string }> = {};

  try {
    // Pick a stable anchor company (first company in the tenant)
    const company = await db.company.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!company) return fail('No companies found — run the base seed first.', 400);

    const employees = await db.employee.findMany({
      where: { status: 'active' },
      take: 20,
      orderBy: { createdAt: 'asc' },
      select: { id: true, firstName: true, lastName: true, email: true, companyId: true, dateOfJoining: true },
    });
    if (employees.length === 0) return fail('No active employees found — run the base seed first.', 400);

    // Pre-fetch projects that SOWs/POs/margins can reference
    const projects = await db.project.findMany({
      where: { companyId: company.id },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    const emp: SeedEmployee[] = employees as unknown as SeedEmployee[];

    if (module === 'all' || module === 'clients') {
      results.clients = await seedClients(company.id, projects, emp);
    }
    if (module === 'all' || module === 'vendors') {
      results.vendors = await seedVendors(company.id, projects, emp);
    }
    if (module === 'all' || module === 'marketplace') {
      results.marketplace = await seedMarketplace(company.id, emp);
    }
    if (module === 'all' || module === 'wellness') {
      results.wellness = await seedWellness(company.id, emp);
    }
    if (module === 'all' || module === 'collaboration') {
      results.collaboration = await seedCollaboration(company.id, emp);
    }

    return ok({
      results,
      seededFor: { company: company.name, employeesAvailable: employees.length },
    });
  } catch (e: unknown) {
    console.error('Ecosystem seed error:', e);
    return fail(e instanceof Error ? e.message : 'Seed failed', 500);
  }
}
