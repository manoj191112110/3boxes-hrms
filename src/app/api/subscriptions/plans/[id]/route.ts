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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const plan = await getPlatformDb().subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ plan }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get subscription plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json({ error: 'Only super admins can update subscription plans' }, { status: 403, headers: corsHeaders() });
    }

    const { id } = await params;

    const existingPlan = await getPlatformDb().subscriptionPlan.findUnique({ where: { id } });
    if (!existingPlan) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404, headers: corsHeaders() });
    }

    const body = await request.json();
    const {
      name, planType, monthlyPrice, annualPrice, employeeLimit, companyLimit,
      branchLimit, storageLimit, aiInterviewLimit, aiChatbotLimit,
      payrollEnabled, recruitmentEnabled, attendanceEnabled, projectEnabled,
      clientPortalEnabled, vendorPortalEnabled, mobileAppEnabled,
      apiAccessEnabled, whiteLabelEnabled, supportLevel, status, description,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (planType !== undefined) updateData.planType = planType;
    if (monthlyPrice !== undefined) updateData.monthlyPrice = monthlyPrice;
    if (annualPrice !== undefined) updateData.annualPrice = annualPrice;
    if (employeeLimit !== undefined) updateData.employeeLimit = employeeLimit;
    if (companyLimit !== undefined) updateData.companyLimit = companyLimit;
    if (branchLimit !== undefined) updateData.branchLimit = branchLimit;
    if (storageLimit !== undefined) updateData.storageLimit = storageLimit;
    if (aiInterviewLimit !== undefined) updateData.aiInterviewLimit = aiInterviewLimit;
    if (aiChatbotLimit !== undefined) updateData.aiChatbotLimit = aiChatbotLimit;
    if (payrollEnabled !== undefined) updateData.payrollEnabled = payrollEnabled;
    if (recruitmentEnabled !== undefined) updateData.recruitmentEnabled = recruitmentEnabled;
    if (attendanceEnabled !== undefined) updateData.attendanceEnabled = attendanceEnabled;
    if (projectEnabled !== undefined) updateData.projectEnabled = projectEnabled;
    if (clientPortalEnabled !== undefined) updateData.clientPortalEnabled = clientPortalEnabled;
    if (vendorPortalEnabled !== undefined) updateData.vendorPortalEnabled = vendorPortalEnabled;
    if (mobileAppEnabled !== undefined) updateData.mobileAppEnabled = mobileAppEnabled;
    if (apiAccessEnabled !== undefined) updateData.apiAccessEnabled = apiAccessEnabled;
    if (whiteLabelEnabled !== undefined) updateData.whiteLabelEnabled = whiteLabelEnabled;
    if (supportLevel !== undefined) updateData.supportLevel = supportLevel;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) {
      const validStatuses = ['active', 'inactive', 'archived'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400, headers: corsHeaders() }
        );
      }
      updateData.status = status;
    }

    const plan = await getPlatformDb().subscriptionPlan.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_SUBSCRIPTION_PLAN',
        module: 'subscriptions',
        details: `Updated subscription plan ${id}: ${JSON.stringify(updateData)}`,
      },
    });

    return NextResponse.json({ plan }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update subscription plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json({ error: 'Only super admins can delete subscription plans' }, { status: 403, headers: corsHeaders() });
    }

    const { id } = await params;

    const existingPlan = await getPlatformDb().subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    if (!existingPlan) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404, headers: corsHeaders() });
    }

    // Check for active subscriptions using this plan
    const activeSubscriptionsCount = await getPlatformDb().subscription.count({
      where: {
        planId: id,
        status: { in: ['active', 'trial'] },
      },
    });

    if (activeSubscriptionsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete plan. ${activeSubscriptionsCount} active subscription(s) are using this plan. Deactivate or migrate them first.` },
        { status: 409, headers: corsHeaders() }
      );
    }

    await getPlatformDb().subscriptionPlan.delete({
      where: { id },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_SUBSCRIPTION_PLAN',
        module: 'subscriptions',
        details: `Deleted subscription plan ${existingPlan.name} (${existingPlan.planType})`,
      },
    });

    return NextResponse.json({ message: 'Subscription plan deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete subscription plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
