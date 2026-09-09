import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { withSchemaSync } from '@/lib/schema-sync';
import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/** Safe wrapper — returns null on Prisma/table-missing errors instead of throwing */
async function safeQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  await withSchemaSync(() => Promise.resolve());

  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const db = await getDb(request);

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'all';
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        totalWorkflowDefs: 0,
        activeWorkflowDefs: 0,
        totalInstances: 0,
        instancesByStatus: [],
        recentExecutions: [],
        message: 'Select a company from the switcher to view governance reports.',
      }, { headers: corsHeaders() });
    }

    // ── Workflow Execution Stats ──
    const [
      totalWorkflowDefs,
      activeWorkflowDefs,
      totalInstances,
      instancesByStatus,
      recentExecutions,
    ] = await Promise.all([
      safeQuery(() => db.workflowDefinition.count()),
      safeQuery(() => db.workflowDefinition.count({ where: { isActive: true } })),
      safeQuery(() => db.workflowInstance.count()),
      safeQuery(() => db.workflowInstance.groupBy({
        by: ['status'],
        _count: { _all: true },
      })),
      safeQuery(() => db.workflowInstance.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          workflowDefinition: { select: { name: true, module: true } },
        },
      })),
    ]);

    const workflowStats = {
      totalDefinitions: totalWorkflowDefs ?? 0,
      activeDefinitions: activeWorkflowDefs ?? 0,
      totalInstances: totalInstances ?? 0,
      byStatus: (instancesByStatus ?? []).map((s: any) => ({
        status: s.status,
        count: s._count._all,
      })),
      recentExecutions: (recentExecutions ?? []).map((e: any) => ({
        id: e.id,
        workflowName: e.workflowDefinition?.name ?? 'Unknown',
        module: e.workflowDefinition?.module ?? '',
        entityType: e.entityType ?? '',
        status: e.status ?? '',
        currentStep: e.currentStep ?? 0,
        createdAt: e.createdAt?.toISOString?.() ?? e.createdAt,
        updatedAt: e.updatedAt?.toISOString?.() ?? e.updatedAt,
      })),
    };

    // ── Policy Compliance Metrics ──
    const [
      totalPolicies,
      activePolicies,
      policiesByCategory,
      policiesByStatus,
    ] = await Promise.all([
      safeQuery(() => db.policy.count()),
      safeQuery(() => db.policy.count({ where: { status: 'active' } })),
      safeQuery(() => db.policy.groupBy({
        by: ['category'],
        _count: { _all: true },
      })),
      safeQuery(() => db.policy.groupBy({
        by: ['status'],
        _count: { _all: true },
      })),
    ]);

    const policyMetrics = {
      total: totalPolicies ?? 0,
      active: activePolicies ?? 0,
      byCategory: (policiesByCategory ?? []).map((p: any) => ({
        category: p.category ?? 'uncategorized',
        count: p._count._all,
      })),
      byStatus: (policiesByStatus ?? []).map((p: any) => ({
        status: p.status ?? 'unknown',
        count: p._count._all,
      })),
    };

    // ── Audit Log Summary ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      auditLogCount,
      auditByModule,
      auditByAction,
    ] = await Promise.all([
      safeQuery(() => db.auditLog.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      })),
      safeQuery(() => db.auditLog.groupBy({
        by: ['module'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
        take: 10,
      })),
      safeQuery(() => db.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
        take: 10,
      })),
    ]);

    const auditSummary = {
      totalLast30Days: auditLogCount ?? 0,
      byModule: (auditByModule ?? []).map((a: any) => ({
        module: a.module ?? 'unknown',
        count: a._count._all,
      })),
      byAction: (auditByAction ?? []).map((a: any) => ({
        action: a.action ?? 'unknown',
        count: a._count._all,
      })),
    };

    // ── Notification Delivery Stats ──
    const [
      totalNotifications,
      unreadNotifications,
      notificationsByCategory,
      notificationsByType,
    ] = await Promise.all([
      safeQuery(() => db.notification.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      })),
      safeQuery(() => db.notification.count({
        where: { isRead: false, createdAt: { gte: thirtyDaysAgo } },
      })),
      safeQuery(() => db.notification.groupBy({
        by: ['category'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
      })),
      safeQuery(() => db.notification.groupBy({
        by: ['type'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
      })),
    ]);

    const notificationStats = {
      totalLast30Days: totalNotifications ?? 0,
      unreadLast30Days: unreadNotifications ?? 0,
      byCategory: (notificationsByCategory ?? []).map((n: any) => ({
        category: n.category ?? 'unknown',
        count: n._count._all,
      })),
      byType: (notificationsByType ?? []).map((n: any) => ({
        type: n.type ?? 'unknown',
        count: n._count._all,
      })),
    };

    // Filter by requested report type
    const result: Record<string, unknown> = {};

    if (reportType === 'all' || reportType === 'workflow-analytics') {
      result.workflowStats = workflowStats;
    }
    if (reportType === 'all' || reportType === 'compliance-audit') {
      result.policyMetrics = policyMetrics;
      result.auditSummary = auditSummary;
    }
    if (reportType === 'all' || reportType === 'policy-adherence') {
      result.policyMetrics = policyMetrics;
      result.notificationStats = notificationStats;
    }

    // Always include all for the "all" type
    if (reportType === 'all') {
      result.notificationStats = notificationStats;
    }

    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (error) {
    console.error('Governance reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
