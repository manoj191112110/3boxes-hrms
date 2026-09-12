/**
 * REQ-PM-05 — Billable vs non-billable utilization report.
 *
 * GET /api/projects/utilization?projectId=X&employeeId=Y&weeks=12
 *
 * Computes utilization per project+employee by aggregating Timesheet rows
 * (using ProjectTask.isBillable to split billable/non-billable hours) and
 * persists weekly snapshots in ProjectUtilizationSnapshot for trend tracking.
 *
 * Returns: { snapshots: [{ project, employee, weekStart, billableHours,
 *                          nonBillableHours, totalHours, utilizationPct }] }
 */
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

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();  // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;  // shift to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const employeeId = searchParams.get('employeeId');
    const weeks = parseInt(searchParams.get('weeks') || '12');
    const persist = searchParams.get('persist') === '1';

    // Look back N weeks
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);
    since.setHours(0, 0, 0, 0);

    // Pull timesheets in the window, joining task for isBillable
    const where: Record<string, unknown> = {
      date: { gte: since },
    };
    if (projectId) where.projectId = projectId;
    if (employeeId) where.employeeId = employeeId;

    const timesheets = await db.timesheet.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        projectTask: { select: { id: true, isBillable: true, name: true } },
      },
      orderBy: { date: 'asc' },
      take: 5000,
    });

    // Aggregate per (projectId, employeeId, weekStart)
    const agg = new Map<string, {
      project: any;
      employee: any;
      weekStart: Date;
      billable: number;
      nonBillable: number;
    }>();

    for (const ts of timesheets) {
      if (!ts.project || !ts.employee) continue;
      const weekStart = getWeekStart(ts.date);
      const key = `${ts.projectId || 'none'}|${ts.employeeId}|${weekStart.toISOString()}`;
      if (!agg.has(key)) {
        agg.set(key, {
          project: ts.project,
          employee: ts.employee,
          weekStart,
          billable: 0,
          nonBillable: 0,
        });
      }
      const isBillable = ts.projectTask?.isBillable ?? true;  // default billable if no task
      if (isBillable) {
        agg.get(key)!.billable += ts.hours;
      } else {
        agg.get(key)!.nonBillable += ts.hours;
      }
    }

    const snapshots = Array.from(agg.values()).map(a => {
      const total = a.billable + a.nonBillable;
      const utilizationPct = total > 0 ? (a.billable / total) * 100 : 0;
      return {
        projectId: a.project.id,
        projectName: a.project.name,
        projectCode: a.project.code,
        employeeId: a.employee.id,
        employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
        weekStart: a.weekStart,
        billableHours: Math.round(a.billable * 100) / 100,
        nonBillableHours: Math.round(a.nonBillable * 100) / 100,
        totalHours: Math.round(total * 100) / 100,
        utilizationPct: Math.round(utilizationPct * 100) / 100,
      };
    });

    // Optionally persist weekly snapshots for trend tracking (idempotent via @@unique)
    if (persist) {
      for (const s of snapshots) {
        try {
          await db.projectUtilizationSnapshot.upsert({
            where: {
              projectId_employeeId_weekStart: {
                projectId: s.projectId,
                employeeId: s.employeeId,
                weekStart: s.weekStart,
              },
            },
            create: {
              projectId: s.projectId,
              employeeId: s.employeeId,
              weekStart: s.weekStart,
              billableHours: s.billableHours,
              nonBillableHours: s.nonBillableHours,
              totalHours: s.totalHours,
              utilizationPct: s.utilizationPct,
            },
            update: {
              billableHours: s.billableHours,
              nonBillableHours: s.nonBillableHours,
              totalHours: s.totalHours,
              utilizationPct: s.utilizationPct,
              snapshotAt: new Date(),
            },
          });
        } catch {
          // Non-fatal — best-effort persist
        }
      }
    }

    // Summary stats
    const summary = {
      totalSnapshots: snapshots.length,
      avgUtilizationPct: snapshots.length > 0
        ? Math.round((snapshots.reduce((a, b) => a + b.utilizationPct, 0) / snapshots.length) * 100) / 100
        : 0,
      totalBillableHours: Math.round(snapshots.reduce((a, b) => a + b.billableHours, 0) * 100) / 100,
      totalNonBillableHours: Math.round(snapshots.reduce((a, b) => a + b.nonBillableHours, 0) * 100) / 100,
      weeksCovered: weeks,
    };

    return NextResponse.json({
      snapshots,
      summary,
      generatedAt: new Date(),
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get utilization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
