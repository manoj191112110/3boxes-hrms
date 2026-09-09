import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders, hashPassword } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';
import { isLiveMode } from '@/lib/site-mode';
import { getServerHiddenSlugs, LIVE_HIDDEN_SLUGS, DEMO_HIDDEN_SLUGS, PLATFORM_PLACEHOLDER_NAME } from '@/lib/tenant-filter';

// ─── Hidden Tenant Slugs (GOLDEN RULE — FOOLPROOF) ──────────────────
function getHiddenSlugsForRequest(request: Request): string[] {
  const foolproof = getServerHiddenSlugs(request);
  const siteMode = isLiveMode(request) ? LIVE_HIDDEN_SLUGS : DEMO_HIDDEN_SLUGS;
  return [...new Set([...foolproof, ...siteMode])];
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const userRole = decoded.role as string;
    if (userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can list all tenants' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    // BIDIRECTIONAL FILTERING (GOLDEN RULE — FOOLPROOF):
    //   LIVE mode (3boxeshrms.com):  Hide demo tenant + placeholder tenant
    //     - '3boxes-hrms-demo' (demo tenant)
    //     - '3boxeshrms' (Marq AI Tech Pvt Ltd — platform placeholder, not a real tenant)
    //   DEMO mode (nexus-hrms-mu.vercel.app):  Hide live tenant
    //     - 'marqaitechgroup' (MarqAI Tech Group — real/live tenant, not for demo)
    // FOOLPROOF: Use tenant-filter.ts as PRIMARY (direct hostname check),
    // then ALSO check isLiveMode() as SECONDARY. Union both.
    const hiddenSlugs = getHiddenSlugsForRequest(request);
    where.slug = { notIn: hiddenSlugs };
    // Also exclude tenants whose NAME matches the placeholder name
    // (catches stray tenants like '3boxes-corp' created by older seed scripts)
    // Use NOT at top level instead of not: { contains: ... } which Prisma doesn't support
    where.NOT = { name: { contains: PLATFORM_PLACEHOLDER_NAME } };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      getPlatformDb().tenant.findMany({
        where,
        include: {
          _count: { select: { users: true, companyGroups: true, subscriptions: true } },
          subscriptions: {
            where: { status: 'active' },
            take: 1,
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      getPlatformDb().tenant.count({ where }),
    ]);

    return NextResponse.json(
      { tenants, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get tenants error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const userRole = decoded.role as string;
    if (userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can create tenants' }, { status: 403, headers: corsHeaders() });
    }

    // Ensure the production DB has the new SRS columns before we try to write
    // to the Tenant table. Idempotent + cached for 10 minutes in-process.
    await ensureSchemaSynced();

    const body = await request.json();
    const {
      name, slug, domain, plan, country, currency, timezone, logo,
      adminName, adminEmail, adminPassword,
      maxCompaniesAllowed,
    } = body;

    if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug, adminName, adminEmail, adminPassword' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Check for duplicate slug
    const existingTenant = await getPlatformDb().tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      return NextResponse.json({ error: 'Tenant slug already exists' }, { status: 409, headers: corsHeaders() });
    }

    // Check for duplicate admin email
    const existingUser = await db.user.findUnique({ where: { email: adminEmail } });
    if (existingUser) {
      return NextResponse.json({ error: 'Admin email already exists' }, { status: 409, headers: corsHeaders() });
    }

    const hashedPassword = await hashPassword(adminPassword);

    const tenant = await getPlatformDb().tenant.create({
      data: {
        name,
        slug,
        domain,
        plan: plan || 'starter',
        country,
        currency: currency || 'INR',
        timezone: timezone || 'UTC',
        logo,
        // When a super admin creates a tenant directly, it's active immediately
        // (no approval step needed — the super admin IS the approver).
        // Previously this was 'pending_approval', which caused newly-created
        // tenants to be filtered out by /api/me/context (which only lists
        // active tenants) — meaning the super admin's header dropdown would
        // never show the tenant they just created.
        status: 'active',
        // Quota: how many companies the tenant_admin can create (0 = unlimited)
        maxCompaniesAllowed: typeof maxCompaniesAllowed === 'number' && maxCompaniesAllowed >= 0 ? maxCompaniesAllowed : 0,
        users: {
          create: {
            email: adminEmail,
            password: hashedPassword,
            name: adminName,
            role: 'tenant_admin',
            status: 'active',
          },
        },
      },
      include: {
        users: true,
      },
    });

    // ─── Per user's clarified hierarchy: "the group company name and parent
    // tenant are same". So whenever a Tenant is created, we auto-create a
    // single Group Company under it that shares the tenant's name. This is
    // the default cluster the tenant_admin will induct their companies into.
    // (Idempotent — if a group with the same name already exists under this
    // tenant, we skip the create.)
    try {
      const existingGroup = await db.companyGroup.findFirst({
        where: { tenantId: tenant.id, name },
      });
      if (!existingGroup) {
        await db.companyGroup.create({
          data: {
            name, // SAME name as the tenant — this is intentional
            tenantId: tenant.id,
            employeeLimitMode: 'group_total',
            maxEmployees: null, // no cap by default — tenant_admin can set one
            maxCompanies: null,
            notes: `Default group company auto-created for tenant "${name}". Shares the tenant name per the parent/child identity rule.`,
          },
        });
      }
    } catch (groupErr) {
      // Don't fail the tenant creation if the group auto-create fails —
      // log it and continue. The tenant_admin can still create groups
      // manually via the Group Companies page.
      console.error('[Tenants/Create] Auto-group-create failed (non-fatal):', groupErr);
    }

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_TENANT',
        module: 'tenants',
        details: `Created tenant ${name} (${slug}) with admin ${adminEmail}. Auto-created a matching group company "${name}".`,
      },
    });

    return NextResponse.json({ tenant }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create tenant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
