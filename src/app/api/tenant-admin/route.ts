import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders, hashPassword } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

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

// GET /api/tenant-admin - Get tenant dashboard data for the logged-in tenant_admin
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

    const tenantId = decoded.tenantId as string;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant associated with user' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || 'overview';

    // Get tenant with full data
    const tenant = await getPlatformDb().tenant.findUnique({
      where: { id: tenantId },
      include: {
        companyGroups: {
          include: {
            companies: {
              include: {
                // Company has no `employees` Prisma relation — count branches+departments only
                _count: { select: { departments: true, branches: true } },
                departments: { where: { status: 'active' } },
                branches: { where: { status: 'active' } },
              },
            },
          },
        },
        users: {
          select: { id: true, email: true, name: true, role: true, status: true, lastLogin: true, avatar: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { users: true, notifications: true } },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404, headers: corsHeaders() });
    }

    // Get employee counts
    const totalEmployees = await db.employee.count({ where: { status: 'active' } });
    const activeUsers = await db.user.count({ where: { tenantId, status: 'active' } });

    // Get recent audit logs for the tenant
    const tenantUserIds = tenant.users.map(u => u.id);
    const recentActivity = await db.auditLog.findMany({
      where: { userId: { in: tenantUserIds } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Get all designations across companies
    const designations = await db.designation.findMany({
      where: { status: 'active' },
      include: { department: { select: { name: true, companyId: true } } },
      orderBy: { title: 'asc' },
    });

    // Get holidays
    const holidays = await withSchemaSync(() => db.holiday.findMany({
      orderBy: { date: 'asc' },
      take: 20,
    }));

    if (section === 'overview') {
      // Current active subscription
      const activeSub = tenant.subscriptions.find(s => s.status === 'active');
      const plan = activeSub?.plan;

      return NextResponse.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          domain: tenant.domain,
          plan: tenant.plan,
          status: tenant.status,
          logo: tenant.logo,
          country: tenant.country,
          currency: tenant.currency,
          timezone: tenant.timezone,
          createdAt: tenant.createdAt,
        },
        stats: {
          totalEmployees,
          activeUsers,
          storageUsed: Math.round(Math.random() * 800 + 200), // MB - simulated
          storageLimit: plan?.storageLimit || 1000,
          aiCreditsUsed: Math.round(Math.random() * 80 + 10),
          aiCreditsLimit: plan?.aiChatbotLimit || 100,
          activeSubscriptions: tenant.subscriptions.filter(s => s.status === 'active').length,
        },
        subscription: activeSub ? {
          id: activeSub.id,
          planName: plan?.name || 'Unknown',
          planType: plan?.planType || 'starter',
          status: activeSub.status,
          startDate: activeSub.startDate,
          endDate: activeSub.endDate,
          amount: activeSub.amount,
          billingCycle: activeSub.billingCycle,
          autoRenew: activeSub.autoRenew,
          employeeLimit: plan?.employeeLimit || 50,
          companyLimit: plan?.companyLimit || 1,
          branchLimit: plan?.branchLimit || 5,
        } : null,
        recentActivity,
        companyGroups: tenant.companyGroups,
      }, { headers: corsHeaders() });
    }

    if (section === 'company-settings') {
      // Flatten companies, departments, branches, designations
      const companies = tenant.companyGroups.flatMap(cg =>
        cg.companies.map(c => ({
          ...c,
          companyGroupName: cg.name,
        }))
      );
      const allDepartments = companies.flatMap(c => c.departments);
      const allBranches = companies.flatMap(c => c.branches);

      return NextResponse.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          domain: tenant.domain,
          plan: tenant.plan,
          status: tenant.status,
          logo: tenant.logo,
          country: tenant.country,
          currency: tenant.currency,
          timezone: tenant.timezone,
        },
        companies,
        departments: allDepartments,
        branches: allBranches,
        designations,
        holidays,
      }, { headers: corsHeaders() });
    }

    if (section === 'billing') {
      return NextResponse.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          plan: tenant.plan,
          currency: tenant.currency,
        },
        subscriptions: tenant.subscriptions.map(s => ({
          id: s.id,
          planName: s.plan.name,
          planType: s.plan.planType,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          amount: s.amount,
          billingCycle: s.billingCycle,
          paymentStatus: s.paymentStatus,
          autoRenew: s.autoRenew,
        })),
        availablePlans: await getPlatformDb().subscriptionPlan.findMany({
          where: { status: 'active' },
          orderBy: { monthlyPrice: 'asc' },
        }),
      }, { headers: corsHeaders() });
    }

    if (section === 'users') {
      return NextResponse.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
        },
        users: tenant.users,
        totalUsers: tenant.users.length,
        activeUsers: tenant.users.filter(u => u.status === 'active').length,
      }, { headers: corsHeaders() });
    }

    if (section === 'configuration') {
      return NextResponse.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          domain: tenant.domain,
          logo: tenant.logo,
          country: tenant.country,
          currency: tenant.currency,
          timezone: tenant.timezone,
        },
        workflows: await db.workflowDefinition.findMany({
          where: { status: 'active' },
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
        policies: await db.policy.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Invalid section' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('Tenant admin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// PATCH /api/tenant-admin - Update tenant settings
export async function PATCH(request: Request) {
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
    const tenantId = decoded.tenantId as string;

    if (userRole !== 'tenant_admin' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only tenant admins can update tenant settings' }, { status: 403, headers: corsHeaders() });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant associated with user' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { name, domain, country, currency, timezone, logo } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (domain !== undefined) updateData.domain = domain;
    if (country !== undefined) updateData.country = country;
    if (currency !== undefined) updateData.currency = currency;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (logo !== undefined) updateData.logo = logo;

    const tenant = await getPlatformDb().tenant.update({
      where: { id: tenantId },
      data: updateData,
    }).catch(async (err) => {
      // Self-heal: if a column is missing, sync schema and retry once.
      const msg = err && err.message ? err.message : String(err);
      if (/column .* does not exist|does not exist in the current database/i.test(msg)) {
        await ensureSchemaSynced();
        return getPlatformDb().tenant.update({ where: { id: tenantId }, data: updateData });
      }
      throw err;
    });

    return NextResponse.json({ tenant }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update tenant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// POST /api/tenant-admin - Create user within tenant
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
    const tenantId = decoded.tenantId as string;

    if (userRole !== 'tenant_admin' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only tenant admins can create users' }, { status: 403, headers: corsHeaders() });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant associated with user' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400, headers: corsHeaders() });
    }

    // Check for duplicate email
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409, headers: corsHeaders() });
    }

    const hashedPassword = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'employee',
        tenantId,
        status: 'active',
      },
      select: { id: true, email: true, name: true, role: true, status: true, lastLogin: true, avatar: true, createdAt: true },
    });

    return NextResponse.json({ user }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create tenant user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
