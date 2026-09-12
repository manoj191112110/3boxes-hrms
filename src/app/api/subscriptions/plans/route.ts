import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const planType = searchParams.get('planType');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (planType) where.planType = planType;

    const plans = await getPlatformDb().subscriptionPlan.findMany({
      where,
      include: {
        _count: { select: { subscriptions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ plans }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get subscription plans error:', error);
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
      return NextResponse.json({ error: 'Only super admins can create subscription plans' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const {
      name, planType, monthlyPrice, annualPrice, employeeLimit, companyLimit,
      branchLimit, storageLimit, aiInterviewLimit, aiChatbotLimit,
      payrollEnabled, recruitmentEnabled, attendanceEnabled, projectEnabled,
      clientPortalEnabled, vendorPortalEnabled, mobileAppEnabled,
      apiAccessEnabled, whiteLabelEnabled, supportLevel, description,
    } = body;

    if (!name || !planType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, planType' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const plan = await getPlatformDb().subscriptionPlan.create({
      data: {
        name,
        planType,
        monthlyPrice: monthlyPrice ?? 0,
        annualPrice: annualPrice ?? 0,
        employeeLimit: employeeLimit ?? 50,
        companyLimit: companyLimit ?? 1,
        branchLimit: branchLimit ?? 5,
        storageLimit: storageLimit ?? 1000,
        aiInterviewLimit: aiInterviewLimit ?? 10,
        aiChatbotLimit: aiChatbotLimit ?? 100,
        payrollEnabled: payrollEnabled ?? true,
        recruitmentEnabled: recruitmentEnabled ?? true,
        attendanceEnabled: attendanceEnabled ?? true,
        projectEnabled: projectEnabled ?? false,
        clientPortalEnabled: clientPortalEnabled ?? false,
        vendorPortalEnabled: vendorPortalEnabled ?? false,
        mobileAppEnabled: mobileAppEnabled ?? false,
        apiAccessEnabled: apiAccessEnabled ?? false,
        whiteLabelEnabled: whiteLabelEnabled ?? false,
        supportLevel: supportLevel ?? 'email',
        description,
        status: 'active',
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_SUBSCRIPTION_PLAN',
        module: 'subscriptions',
        details: `Created subscription plan ${name} (${planType})`,
      },
    });

    return NextResponse.json({ plan }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create subscription plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
