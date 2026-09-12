/**
 * Project Reports API — Aggregated analytics for project management.
 *  GET /api/project-reports
 *
 * Computes from the database:
 *  - revenueByType:   Budget grouped by projectType (client, internal, r_and_d, support)
 *  - monthlyStarts:   Project count by month (last 6 months)
 *  - budgetVsActual:  Per-project budget/actual/progress comparison
 *  - resourceUtilization: Allocation % by department
 *  - summaryStats:    Total/active/completed projects, total budget, avg progress
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { withSchemaSync } from '@/lib/schema-sync';
import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';

async function safeQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

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

const TYPE_COLORS: Record<string, string> = {
  client: '#10B981',
  internal: '#3B82F6',
  r_and_d: '#8B5CF6',
  support: '#F59E0B',
};

const TYPE_LABELS: Record<string, string> = {
  client: 'Client',
  internal: 'Internal',
  r_and_d: 'R&D',
  support: 'Support',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  const platformDb = getPlatformDb();
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    await withSchemaSync(() => Promise.resolve());

    const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        revenueByType: [],
        monthlyStarts: [],
        budgetVsActual: [],
        resourceUtilization: [],
        summaryStats: { totalProjects: 0, activeProjects: 0, completedProjects: 0, totalBudget: 0, avgProgress: 0 },
        message: 'Select a company from the switcher to view project reports.',
      }, { headers: corsHeaders() });
    }

    // ── 1. Fetch all projects ──
    const projects = (await safeQuery(() => db.project.findMany({
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { allocations: true, tasks: true } },
        allocations: {
          select: {
            allocationPct: true,
            employee: {
              select: {
                id: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
          where: { status: 'active' },
        },
      },
    }))) ?? [];

    // ── 2. Revenue (budget) by project type ──
    const budgetByType: Record<string, number> = {};
    for (const p of projects) {
      const type = p.projectType || 'internal';
      budgetByType[type] = (budgetByType[type] || 0) + (p.budgetAmount || 0);
    }
    const revenueByType = Object.entries(budgetByType).map(([type, value]) => ({
      name: TYPE_LABELS[type] || type,
      value: Math.round(value),
      color: TYPE_COLORS[type] || '#94A3B8',
    }));

    // ── 3. Monthly project starts (last 6 months) ──
    const now = new Date();
    const monthStarts: { month: string; projects: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = MONTH_NAMES[d.getMonth()];
      const count = projects.filter(p => {
        const ps = new Date(p.startDate);
        return `${ps.getFullYear()}-${String(ps.getMonth() + 1).padStart(2, '0')}` === monthKey;
      }).length;
      monthStarts.push({ month: label, projects: count });
    }

    // ── 4. Budget vs Actual ──
    const budgetVsActual = projects.map(p => {
      const budget = p.budgetAmount || 0;
      const progress = p.progress || 0;
      const actual = Math.round(budget * progress / 100);
      return {
        id: p.id,
        name: p.name,
        type: p.projectType || 'internal',
        budget: Math.round(budget),
        actual,
        progress,
      };
    });

    // ── 5. Resource utilization by department ──
    const deptMap = new Map<string, { totalAllocationPct: number; headcount: Set<string> }>();
    for (const p of projects) {
      for (const alloc of p.allocations) {
        const deptName = alloc.employee.department?.name || 'Unassigned';
        if (!deptMap.has(deptName)) {
          deptMap.set(deptName, { totalAllocationPct: 0, headcount: new Set() });
        }
        const entry = deptMap.get(deptName)!;
        entry.totalAllocationPct += alloc.allocationPct || 0;
        entry.headcount.add(alloc.employee.id);
      }
    }
    const resourceUtilization = Array.from(deptMap.entries()).map(([name, data]) => {
      const headcount = data.headcount.size;
      const allocated = headcount > 0 ? Math.min(100, Math.round(data.totalAllocationPct / headcount)) : 0;
      const available = 100 - allocated;
      return { name, allocated, available, headcount };
    });

    // ── 6. Summary stats ──
    const total = projects.length;
    const active = projects.filter(p => p.status === 'active').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const totalBudget = projects.reduce((a, p) => a + (p.budgetAmount || 0), 0);
    const avgProgress = total > 0 ? Math.round(projects.reduce((a, p) => a + (p.progress || 0), 0) / total) : 0;

    // ── 7. Task status distribution (across all projects) ──
    const tasks = (await safeQuery(() => db.projectTask.findMany({
      select: { status: true, assignedToId: true, priority: true },
    }))) ?? [];

    const taskDist: Record<string, number> = {};
    for (const t of tasks) {
      taskDist[t.status] = (taskDist[t.status] || 0) + 1;
    }

    // Overdue tasks (tasks past due date that aren't done)
    const overdueTasks = (await safeQuery(() => db.projectTask.findMany({
      where: {
        plannedEnd: { lt: new Date() },
        status: { notIn: ['done', 'cancelled'] },
      },
      select: {
        id: true,
        name: true,
        priority: true,
        project: { select: { name: true } },
      },
      take: 20,
    }))) ?? [];

    return NextResponse.json({
      revenueByType,
      monthlyStarts: monthStarts,
      budgetVsActual,
      resourceUtilization,
      summaryStats: {
        total,
        active,
        completed,
        totalBudget: Math.round(totalBudget),
        avgProgress,
      },
      taskDistribution: taskDist,
      overdueTasks,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('GET project-reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
