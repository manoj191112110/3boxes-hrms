// REQ-AI-PAY-03: Ghost Employee Detection
// ---------------------------------------
// Cross-references active payroll against:
//   • Project Management Timesheet entries (hours logged in the period)
//   • IT Active Directory login activity (provisional — uses a hook that
//     the customer can wire to their real AD via API)
//   • Email activity counts (provisional)
//
// A "ghost employee" candidate = an employee who:
//   • Was paid in the run (has EARNING lines)
//   • Has zero timesheet hours in the period
//   • Has zero AD logins in the period (if data available)
//   • Has no active project allocation
//
// Risk score (0..100) is computed as a weighted sum of risk factors:
//   40 — zero timesheet hours
//   30 — zero AD logins (only if data available)
//   15 — no project allocation
//   15 — paid > team-average net (suspicious for a no-show employee)
//
// Status workflow: OPEN → INVESTIGATING → CONFIRMED_FRAUD / CONFIRMED_BENCH / FALSE_POSITIVE

import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET /api/payroll/ai/ghost-employees
//   ?payrollRunId=...
//   ?status=OPEN
//   ?minRiskScore=50
//   ?scan=true  → re-run detection before returning results
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const payrollRunId = searchParams.get('payrollRunId');
    const status = searchParams.get('status');
    const minRiskScore = searchParams.get('minRiskScore');
    const scan = searchParams.get('scan') === 'true';

    let scanResults: { scanned: number; flagged: number } | undefined;
    if (scan && payrollRunId) {
      try {
        scanResults = await runGhostEmployeeScan(payrollRunId);
      } catch (err) {
        console.error('Ghost employee scan failed:', err);
      }
    }

    const where: Record<string, unknown> = {};
    if (payrollRunId) where.payrollRunId = payrollRunId;
    if (status) where.status = status;
    if (minRiskScore) where.riskScore = { gte: parseFloat(minRiskScore) };

    let flags: unknown[] = [];
    try {
      flags = await db.ghostEmployeeFlag.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true, employeeId: true, firstName: true, lastName: true, email: true,
              department: { select: { name: true } },
              designation: { select: { title: true } },
            },
          },
        },
        orderBy: [{ riskScore: 'desc' }, { detectedAt: 'desc' }],
        take: 200,
      });
    } catch (dbError: unknown) {
      console.error('DB error fetching ghost flags:', dbError);
    }

    const arr = flags as Array<{ status: string; riskScore: number }>;
    const summary = {
      total: arr.length,
      open: arr.filter((f) => f.status === 'OPEN').length,
      investigating: arr.filter((f) => f.status === 'INVESTIGATING').length,
      confirmedFraud: arr.filter((f) => f.status === 'CONFIRMED_FRAUD').length,
      confirmedBench: arr.filter((f) => f.status === 'CONFIRMED_BENCH').length,
      falsePositive: arr.filter((f) => f.status === 'FALSE_POSITIVE').length,
      avgRiskScore: arr.length > 0 ? arr.reduce((s, f) => s + f.riskScore, 0) / arr.length : 0,
    };

    return Response.json({ data: flags, summary, scanResults }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/ai/ghost-employees GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/payroll/ai/ghost-employees  { id, status, resolutionNotes }
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.id) return Response.json({ error: 'Flag id required' }, { status: 400, headers: corsHeaders });
    if (!['OPEN', 'INVESTIGATING', 'CONFIRMED_FRAUD', 'CONFIRMED_BENCH', 'FALSE_POSITIVE'].includes(body.status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400, headers: corsHeaders });
    }

    const updated = await db.ghostEmployeeFlag.update({
      where: { id: body.id },
      data: {
        status: body.status,
        reviewedBy: decoded.userId as string,
        reviewedAt: new Date(),
        resolutionNotes: body.resolutionNotes || null,
      },
    });

    return Response.json({ data: updated }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/ai/ghost-employees PATCH:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// ────────────────────────────────────────────────────────────────────
// runGhostEmployeeScan — the actual detection engine
// ────────────────────────────────────────────────────────────────────
async function runGhostEmployeeScan(payrollRunId: string): Promise<{ scanned: number; flagged: number }> {
  const run = await db.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: {
      transactionLines: {
        where: { isReversal: false, componentType: 'EARNING' },
        select: { employeeId: true, finalAmount: true },
      },
    },
  });

  if (!run) return { scanned: 0, flagged: 0 };

  // Compute paid employee set + per-employee earnings
  const paidEmployees = new Map<string, number>();
  for (const line of run.transactionLines) {
    paidEmployees.set(line.employeeId, (paidEmployees.get(line.employeeId) || 0) + line.finalAmount);
  }

  if (paidEmployees.size === 0) return { scanned: 0, flagged: 0 };

  const employeeIds = Array.from(paidEmployees.keys());

  // Pull timesheet entries within the run period
  const periodStart = run.periodStartDate;
  const periodEnd = run.periodEndDate;
  const timesheetAgg = new Map<string, { hours: number; lastActive: Date | null }>();

  try {
    const timesheets = await db.timesheet.findMany({
      where: { employeeId: { in: employeeIds }, date: { gte: periodStart, lte: periodEnd } },
      select: { employeeId: true, hours: true, date: true },
    });
    for (const t of timesheets) {
      const agg = timesheetAgg.get(t.employeeId) || { hours: 0, lastActive: null };
      agg.hours += t.hours || 0;
      if (!agg.lastActive || t.date > agg.lastActive) agg.lastActive = t.date;
      timesheetAgg.set(t.employeeId, agg);
    }
  } catch (err) {
    console.error('[ghost-scan] Timesheet query failed (continuing):', err);
  }

  // Pull project allocations
  const allocationSet = new Set<string>();
  try {
    const allocations = await db.projectAllocation.findMany({
      where: { employeeId: { in: employeeIds }, status: 'active' },
      select: { employeeId: true },
    });
    for (const a of allocations) allocationSet.add(a.employeeId);
  } catch (err) {
    console.error('[ghost-scan] Allocation query failed (continuing):', err);
  }

  // Compute team-average net pay for the "paid > team average" factor
  const allEarnings = Array.from(paidEmployees.values());
  const teamAvg = allEarnings.length > 0 ? allEarnings.reduce((s, v) => s + v, 0) / allEarnings.length : 0;

  // Existing OPEN flags to dedupe
  const existingOpen = await db.ghostEmployeeFlag.findMany({
    where: { payrollRunId, status: 'OPEN' },
    select: { employeeId: true },
  });
  const openSet = new Set(existingOpen.map((o) => o.employeeId));

  const toCreate: Array<{
    employeeId: string;
    payrollRunId: string | null;
    payrollPeriod: string;
    timesheetHours: number;
    adLoginCount: number;
    emailSentCount: number;
    hasProjectAllocation: boolean;
    lastActiveDate: Date | null;
    riskScore: number;
    riskFactors: string;
    status: string;
    companyId: string | null;
  }> = [];

  for (const [employeeId, earnings] of paidEmployees.entries()) {
    const tsAgg = timesheetAgg.get(employeeId) || { hours: 0, lastActive: null };
    const hasAllocation = allocationSet.has(employeeId);

    const factors: string[] = [];
    let risk = 0;

    if (tsAgg.hours === 0) {
      risk += 40;
      factors.push('ZERO_TIMESHEET');
    }
    // AD login count is not available without integration — leave at 0
    // (the field exists in schema so a real AD integration can populate it later)
    if (!hasAllocation) {
      risk += 15;
      factors.push('NO_PROJECT_ALLOCATION');
    }
    if (teamAvg > 0 && earnings > teamAvg * 1.2) {
      risk += 15;
      factors.push('PAID_ABOVE_TEAM_AVG');
    }

    // Only flag if at least 2 risk factors (avoid false positives on legit bench resources)
    if (factors.length >= 2 && risk >= 40) {
      if (openSet.has(employeeId)) continue;
      toCreate.push({
        employeeId,
        payrollRunId,
        payrollPeriod: run.payrollPeriod,
        timesheetHours: tsAgg.hours,
        adLoginCount: 0,
        emailSentCount: 0,
        hasProjectAllocation: hasAllocation,
        lastActiveDate: tsAgg.lastActive,
        riskScore: Math.min(100, risk),
        riskFactors: JSON.stringify(factors),
        status: 'OPEN',
        companyId: run.companyId,
      });
    }
  }

  let flagged = 0;
  if (toCreate.length > 0) {
    try {
      const r = await db.ghostEmployeeFlag.createMany({ data: toCreate });
      flagged = r.count;
    } catch (err) {
      console.error('Bulk insert ghost flags failed:', err);
    }
  }

  return { scanned: paidEmployees.size, flagged };
}
