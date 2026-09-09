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

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        activeWorkflows: 0,
        policyDocs: 0,
        pendingInstances: 0,
        recentInstances: [],
        auditLogCount: 0,
        notificationCount: 0,
        totalInstances: 0,
        completedInstances: 0,
        policyCategories: [],
        message: 'Select a company from the switcher to view governance data.',
      }, { headers: corsHeaders() });
    }

    const db = await getDb(request);

    // Fetch all data in parallel — each query is wrapped in safeQuery so
    // a missing table / column won't crash the entire endpoint
    const [
      activeWorkflowsCount,
      policyDocsCount,
      pendingInstancesCount,
      recentInstances,
      auditLogCount,
      notificationCountResult,
      totalInstancesCount,
      completedInstancesCount,
      policyCategories,
    ] = await Promise.all([
      safeQuery(() => db.workflowDefinition.count({ where: { isActive: true } })),
      safeQuery(() => db.policy.count({ where: { status: 'active' } })),
      safeQuery(() => db.workflowInstance.count({ where: { status: 'pending' } })),
      safeQuery(() => db.workflowInstance.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
          workflowDefinition: { select: { name: true, module: true } },
        },
      })),
      safeQuery(() => db.auditLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      })),
      safeQuery(() => db.notification.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      })),
      safeQuery(() => db.workflowInstance.count()),
      safeQuery(() => db.workflowInstance.count({ where: { status: 'approved' } })),
      safeQuery(() => db.policy.groupBy({
        by: ['category'],
        where: { status: 'active' },
        _count: { _all: true },
      })),
    ]);

    // Compute compliance score
    const totalInst = totalInstancesCount ?? 0;
    const completedInst = completedInstancesCount ?? 0;
    const complianceScore = totalInst > 0 ? Math.min(100, Math.round((completedInst / totalInst) * 100)) : 0;

    // Build KPI data
    const kpis = {
      activeWorkflows: activeWorkflowsCount ?? 0,
      policyDocuments: policyDocsCount ?? 0,
      pendingApprovals: pendingInstancesCount ?? 0,
      complianceScore,
    };

    // Build workflow activity
    const workflowActivity = (recentInstances ?? []).map((inst: any) => ({
      id: inst.id,
      title: `${inst.workflowDefinition?.name ?? 'Workflow'} — ${(inst.entityType ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}`,
      status: inst.status === 'approved' ? 'Completed' : inst.status === 'rejected' ? 'Rejected' : inst.status === 'pending' ? 'Pending' : 'In Progress',
      time: inst.updatedAt?.toISOString?.() ?? inst.updatedAt,
      module: inst.workflowDefinition?.module ?? '',
    }));

    // Build compliance items from policy categories
    const activePolicyCount = policyDocsCount ?? 0;
    const complianceItems = (policyCategories ?? []).map((pc: any) => {
      const count = pc._count._all;
      const ratio = activePolicyCount > 0 ? count / activePolicyCount : 0;
      const percent = Math.min(100, Math.round(ratio * 100 + (count > 0 ? 60 : 0)));
      return {
        label: (pc.category ?? 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        percent,
      };
    }).sort((a: any, b: any) => b.percent - a.percent);

    // Additional metrics
    const metrics = {
      auditLogsLast30Days: auditLogCount ?? 0,
      notificationsLast30Days: notificationCountResult ?? 0,
      totalWorkflowInstances: totalInst,
      completedWorkflowInstances: completedInst,
    };

    return NextResponse.json(
      { kpis, workflowActivity, complianceItems, metrics },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Governance dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
