import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { isLiveMode } from '@/lib/site-mode';

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
    const { searchParams } = new URL(request.url);
    const isSuperAdmin = userRole === 'super_admin';
    const tenantId = searchParams.get('tenantId') || (decoded.tenantId as string);
    const status = searchParams.get('status');
    const currency = searchParams.get('currency');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};

    // Super admin: list all subscriptions across all tenants (with live/demo filtering)
    if (isSuperAdmin) {
      // BIDIRECTIONAL FILTERING: same as /api/tenants
      const tenantFilter: Record<string, unknown> = {};
      if (isLiveMode(request)) {
        tenantFilter.slug = { notIn: ['3boxes-hrms-demo', '3boxeshrms'] };
      } else {
        tenantFilter.slug = { notIn: ['marqaitechgroup'] };
      }
      where.tenant = tenantFilter;
    } else {
      where.tenantId = tenantId;
    }

    if (status) where.status = status;
    // In LIVE mode, force INR-only currency for subscriptions
    if (isSuperAdmin && isLiveMode(request)) {
      where.currency = 'INR';
    } else if (currency) {
      where.currency = currency;
    }

    const [subscriptions, total] = await Promise.all([
      getPlatformDb().subscription.findMany({
        where,
        include: {
          plan: true,
          tenant: { select: { id: true, name: true, slug: true, currency: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      getPlatformDb().subscription.count({ where }),
    ]);

    return NextResponse.json(
      { subscriptions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get subscriptions error:', error);
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
    if (userRole !== 'super_admin' && userRole !== 'tenant_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const {
      tenantId, planId, startDate, endDate, trialStart, trialEnd,
      billingCycle, amount, currency, paymentStatus, autoRenew,
    } = body;

    if (!tenantId || !planId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, planId, startDate, endDate' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const subscription = await getPlatformDb().subscription.create({
      data: {
        tenantId,
        planId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        trialStart: trialStart ? new Date(trialStart) : null,
        trialEnd: trialEnd ? new Date(trialEnd) : null,
        billingCycle: billingCycle || 'monthly',
        amount: amount ?? 0,
        // In LIVE mode, force INR currency
        currency: isLiveMode(request) ? 'INR' : (currency || 'INR'),
        paymentStatus: paymentStatus || 'pending',
        status: 'active',
        autoRenew: autoRenew ?? true,
      },
      include: { plan: true, tenant: { select: { id: true, name: true } } },
    });

    // Get tenant admin to notify
    const tenantAdmin = await db.user.findFirst({
      where: { tenantId, role: 'tenant_admin' },
    });

    if (tenantAdmin) {
      await createNotification({
        tenantId,
        userId: tenantAdmin.id,
        title: 'Subscription Assigned',
        message: `Your tenant has been assigned a ${subscription.plan?.name || 'new'} subscription plan.`,
        type: 'success',
        category: 'system',
        link: '/settings',
      });
    }

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_SUBSCRIPTION',
        module: 'subscriptions',
        details: `Assigned subscription plan ${planId} to tenant ${tenantId}`,
      },
    });

    return NextResponse.json({ subscription }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create subscription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
