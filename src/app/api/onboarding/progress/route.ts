/**
 * Onboarding Progress Dashboard API
 *
 *   GET /api/onboarding/progress
 *
 * Per-employee onboarding completion aggregates for HR / line managers:
 * total tasks, completed, in-progress, pending, overdue, completion %, plus
 * next pending milestone. Powers the progress dashboard on /onboarding.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getAuthInfo } from '@/lib/companyScope';

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

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const tasks = await db.onboardingTask.findMany({
      select: {
        employeeId: true, task: true, category: true, status: true,
        dueDate: true, priority: true, completedDate: true, kra: true, trainingModule: true,
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, avatar: true, employeeStatus: true, dateOfJoining: true, department: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3000,
    });

    type Row = {
      employeeId: string; name: string; code: string; department?: string | null;
      employeeStatus?: string | null; dateOfJoining?: Date | string | null;
      total: number; completed: number; inProgress: number; pending: number; overdue: number;
      completionPct: number; nextDue: { task: string; dueDate: Date | string | null } | null;
      trainings: string[]; kras: string[];
    };

    const byEmployee = new Map<string, Row>();
    const now = Date.now();
    for (const t of tasks) {
      const emp = (t as Record<string, unknown>).employee as Record<string, unknown> | undefined;
      if (!emp) continue;
      let row = byEmployee.get(t.employeeId);
      if (!row) {
        row = {
          employeeId: t.employeeId,
          name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown',
          code: String(emp.employeeId || '—'),
          department: (emp.department as { name?: string } | null)?.name || null,
          employeeStatus: emp.employeeStatus as string | null,
          dateOfJoining: emp.dateOfJoining as Date | string | null,
          total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0, completionPct: 0, nextDue: null,
          trainings: [], kras: [],
        };
        byEmployee.set(t.employeeId, row);
      }
      row.total++;
      if (t.status === 'completed') row.completed++;
      else if (t.status === 'in_progress') row.inProgress++;
      else row.pending++;

      if (t.status !== 'completed' && t.dueDate && new Date(t.dueDate).getTime() < now) row.overdue++;

      if (t.status !== 'completed' && t.dueDate) {
        if (!row.nextDue || new Date(t.dueDate) < new Date(row.nextDue.dueDate as Date)) {
          row.nextDue = { task: t.task, dueDate: t.dueDate };
        }
      }
      if (t.trainingModule) row.trainings.push(t.trainingModule);
      if (t.kra) row.kras.push(t.kra);
    }

    const rows = [...byEmployee.values()].map((r) => ({
      ...r,
      completionPct: r.total ? Math.round((r.completed / r.total) * 100) : 0,
    })).sort((a, b) => a.completionPct - b.completionPct);

    const summary = {
      newHires: rows.length,
      avgCompletion: rows.length ? Math.round(rows.reduce((s, r) => s + r.completionPct, 0) / rows.length) : 0,
      overdueTasks: rows.reduce((s, r) => s + r.overdue, 0),
      fullyComplete: rows.filter((r) => r.total > 0 && r.completed === r.total).length,
    };

    return NextResponse.json({ summary, rows }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Onboarding progress GET error:', error);
    return NextResponse.json({ summary: { newHires: 0, avgCompletion: 0, overdueTasks: 0, fullyComplete: 0 }, rows: [] }, { headers: corsHeaders() });
  }
}
