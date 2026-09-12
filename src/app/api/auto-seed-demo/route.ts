/**
 * Public auto-seed endpoint — any authenticated user can trigger.
 *
 * GET /api/auto-seed-demo?module=marketplace
 * GET /api/auto-seed-demo?module=wellness
 * GET /api/auto-seed-demo?module=collaboration
 * GET /api/auto-seed-demo?module=all
 *
 * Idempotent: each seed function checks for existing rows before creating.
 * This endpoint is intended to be called silently by client-side hooks on
 * first page load (useAutoSeedDemo) so that demo data is always visible on
 * the Vercel deployment without requiring an admin to click "Seed Data".
 *
 * Auth: requires a valid JWT (any role). This prevents anonymous abuse while
 * still allowing the demo experience to work for any logged-in user.
 *
 * ⚠️ LIVE MODE GUARD: This endpoint is BLOCKED on the production platform
 * (3boxeshrms.com and tenant subdomains). Dummy/sample data must NEVER
 * be auto-seeded into live tenant databases. This endpoint only works on
 * the demo domain (nexus-hrms-mu.vercel.app).
 */
import { NextResponse } from 'next/server';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

/** Quick existence check — only counts, never returns rows. */
async function isEmpty(model: string, where: any = {}): Promise<boolean> {
  try {
    const count = await (prisma as any)[model].count({ where });
    return count === 0;
  } catch {
    // If the table doesn't exist (schema-sync hasn't run yet), treat as empty.
    return true;
  }
}

export async function GET(request: Request) {
  // ─── LIVE MODE GUARD ───
  // Auto-seeding is STRICTLY PROHIBITED on the live production platform.
  // Only the demo site (nexus-hrms-mu.vercel.app) may auto-seed data.
  if (isLiveMode(request)) {
    return NextResponse.json({
      ok: false,
      reason: 'live_mode_blocked',
      message: 'Auto-seeding is disabled on the live platform. Dummy data is only available on the demo site (nexus-hrms-mu.vercel.app).',
    }, { status: 403, headers: CORS });
  }

  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: CORS });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: CORS });
    }

    const { searchParams } = new URL(request.url);
    const module = (searchParams.get('module') || 'all') as
      | 'clients' | 'vendors' | 'marketplace' | 'wellness' | 'collaboration' | 'all';

    // Anchor company + employees — same as admin endpoint
    const company = await db.company.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!company) {
      return NextResponse.json({
        ok: false,
        reason: 'no_company',
        message: 'No companies found. Run the base seed first.',
      }, { headers: CORS });
    }

    const employees = await db.employee.findMany({
      where: { status: 'active' },
      take: 20,
      orderBy: { createdAt: 'asc' },
      select: { id: true, firstName: true, lastName: true, email: true, dateOfJoining: true },
    });
    if (employees.length === 0) {
      return NextResponse.json({
        ok: false,
        reason: 'no_employees',
        message: 'No active employees found.',
      }, { headers: CORS });
    }

    const projects = await db.project.findMany({
      where: { companyId: company.id },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    const emp: SeedEmployee[] = employees as unknown as SeedEmployee[];
    const results: Record<string, any> = {};

    // Only seed a module if it's currently empty — this keeps the auto-seed
    // call cheap on subsequent visits (no DB writes, no duplicate rows).
    if ((module === 'all' || module === 'clients') && await isEmpty('client')) {
      results.clients = await seedClients(company.id, projects, emp);
    }
    if ((module === 'all' || module === 'vendors') && await isEmpty('vendor')) {
      results.vendors = await seedVendors(company.id, projects, emp);
    }
    if ((module === 'all' || module === 'marketplace') && await isEmpty('marketplaceProduct')) {
      results.marketplace = await seedMarketplace(company.id, emp);
    }
    if ((module === 'all' || module === 'wellness') && await isEmpty('insurancePolicy')) {
      results.wellness = await seedWellness(company.id, emp);
    }
    if ((module === 'all' || module === 'collaboration') && await isEmpty('chatRoom', { companyId: company.id })) {
      results.collaboration = await seedCollaboration(company.id, emp);
    }

    return NextResponse.json({
      ok: true,
      module,
      results,
      seededFor: { company: company.name, employeesAvailable: employees.length },
    }, { headers: CORS });
  } catch (e: unknown) {
    console.error('Auto-seed error:', e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Auto-seed failed',
    }, { status: 500, headers: CORS });
  }
}

// Also accept POST for callers that prefer POST (e.g. SeedEcosystemButton-style).
export async function POST(request: Request) {
  const db = await getDb(request);
  // Reuse GET logic — body is ignored, query string is read from URL
  return GET(request);
}
