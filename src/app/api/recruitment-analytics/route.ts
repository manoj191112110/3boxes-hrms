import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';
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

// Hard-coded INR-first currency conversion table (fallback when
// CurrencyConfig / ExchangeRate tables are empty).
// Values represent how many INR equal 1 unit of the foreign currency.
const INR_RATE: Record<string, number> = {
  INR: 1,
  USD: 83,
  EUR: 90,
  GBP: 105,
  AED: 22.6,
  SAR: 22.1,
  SGD: 61.5,
  AUD: 54.5,
  CAD: 60.5,
  JPY: 0.55,
  CNY: 11.5,
  ZAR: 4.5,
  MYR: 17.8,
  HKD: 10.6,
  CHF: 93,
};

function toINR(amount: number, currency: string | null | undefined): number {
  if (!amount || isNaN(amount)) return 0;
  const cur = (currency || 'INR').toUpperCase();
  const rate = INR_RATE[cur] ?? 1;
  return amount * rate;
}

function daysBetween(a: Date | string | null | undefined, b: Date | string | null | undefined): number | null {
  if (!a || !b) return null;
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Ensure the JobBoardPosting table exists in production
    await ensureSchemaSynced();

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        totalJobPostings: 0,
        activeJobs: 0,
        totalApplications: 0,
        pendingApplications: 0,
        interviewsScheduled: 0,
        offersExtended: 0,
        offersAccepted: 0,
        hiresThisMonth: 0,
        openPositions: 0,
        funnelConversion: 0,
        avgTimeToHire: 0,
        costPerHire: 0,
        sourceBreakdown: [],
        monthlyTrend: [],
        departmentBreakdown: [],
        message: 'Select a company from the switcher to view recruitment analytics.',
      }, { headers: corsHeaders() });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 86400000);

    // ── Parallel fetch of raw data ──
    const [
      jobPostings,
      applications,
      offers,
      employees,
      requisitions,
      boardPostings,
    ] = await Promise.all([
      db.jobPosting.findMany({
        include: {
          department: { select: { id: true, name: true } },
          applications: { select: { id: true, status: true, appliedDate: true, source: true } },
        },
      }),
      db.jobApplication.findMany({
        select: {
          id: true,
          status: true,
          appliedDate: true,
          source: true,
          jobPostingId: true,
          jobPosting: { select: { id: true, title: true, departmentId: true, department: { select: { id: true, name: true } } } },
        },
      }),
      db.offer.findMany({
        select: {
          id: true,
          status: true,
          offeredSalary: true,
          offeredCurrency: true,
          candidateId: true,
          candidateName: true,
          jobPostingId: true,
          createdAt: true,
          respondedAt: true,
        },
      }),
      db.employee.findMany({
        select: {
          id: true,
          dateOfJoining: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      }),
      db.requisition.findMany({
        select: { id: true, status: true, numberOfOpenings: true },
      }),
      db.jobBoardPosting.findMany({
        select: { id: true, jobPostingId: true, board: true, status: true, postedAt: true, closedAt: true },
      }),
    ]);

    // ── Funnel by stage ──
    const funnelByStage = {
      applied: 0,
      screening: 0,
      interview: 0,
      offered: 0,
      hired: 0,
      rejected: 0,
    };
    (applications || []).forEach((a) => {
      const s = a.status as keyof typeof funnelByStage;
      if (s in funnelByStage) funnelByStage[s] += 1;
    });

    // ── Offers accepted / rejected ──
    const offersAccepted = (offers || []).filter((o) => o.status === 'accepted').length;
    const offersRejected = (offers || []).filter((o) => o.status === 'rejected').length;
    const totalOfferResponses = offersAccepted + offersRejected;
    const offerAcceptanceRate = totalOfferResponses > 0
      ? Math.round((offersAccepted / totalOfferResponses) * 1000) / 10
      : 0;

    // ── Cost per Hire ──
    // Hires in the last 30 days — employees joined in last 30 days.
    const recentHires = (employees || []).filter((e) => {
      if (!e.dateOfJoining) return false;
      const dj = e.dateOfJoining instanceof Date ? e.dateOfJoining : new Date(e.dateOfJoining);
      return dj >= thirtyDaysAgo;
    });

    // Match each recent hire to an offer by candidateId (best effort).
    // Use accepted offers in the last 30 days if direct match unavailable.
    const recentAcceptedOffers = (offers || []).filter((o) => {
      if (o.status !== 'accepted') return false;
      const created = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt);
      return created >= thirtyDaysAgo;
    });

    // Per-hire cost = offeredSalary * 0.1 (hiring cost) + 50000 (fixed)
    let totalHiringCostINR = 0;
    const hireCount = Math.max(recentHires.length, recentAcceptedOffers.length, 0);

    // Use accepted offers as the basis for cost calculation (since they tie directly to salary).
    const offersUsedForCost = recentAcceptedOffers.length > 0
      ? recentAcceptedOffers
      : (offers || []).filter((o) => o.status === 'accepted');
    (offersUsedForCost || []).forEach((o) => {
      const salaryINR = toINR(o.offeredSalary || 0, o.offeredCurrency);
      totalHiringCostINR += salaryINR * 0.1 + 50000;
    });

    const costPerHireAmount = hireCount > 0 ? Math.round(totalHiringCostINR / hireCount) : 0;

    const costPerHire = {
      amount: costPerHireAmount,
      currency: 'INR' as const,
      breakdown: {
        fixedCostPerHire: 50000,
        variableCostRate: 0.1,
        hiresConsidered: hireCount,
        offersConsidered: (offersUsedForCost || []).length,
        totalHiringCostINR: Math.round(totalHiringCostINR),
      },
    };

    // ── Time to Fill ──
    // For filled jobs: avg(closingDate - postedDate) for jobs with status='filled'
    const filledJobs = (jobPostings || []).filter((j) => j.status === 'filled' && j.postedDate);
    const ttfValues: number[] = [];
    (filledJobs || []).forEach((j) => {
      const days = daysBetween(j.postedDate, j.closingDate);
      if (days !== null && days >= 0) ttfValues.push(days);
    });
    const timeToFillAvg = ttfValues.length > 0
      ? Math.round((ttfValues.reduce((s, v) => s + v, 0) / ttfValues.length) * 10) / 10
      : 0;

    // Time to Fill by department
    const ttfByDeptMap = new Map<string, number[]>();
    (filledJobs || []).forEach((j) => {
      const days = daysBetween(j.postedDate, j.closingDate);
      if (days === null || days < 0) return;
      const deptName = j.department?.name || 'Unknown';
      const arr = ttfByDeptMap.get(deptName) || [];
      arr.push(days);
      ttfByDeptMap.set(deptName, arr);
    });
    const timeToFillByDepartment = Array.from(ttfByDeptMap.entries()).map(([department, values]) => ({
      department,
      avgDays: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10,
      filledCount: values.length,
    }));

    // ── Time to Hire ──
    // avg(Employee.dateOfJoining - JobApplication.appliedDate) for hired candidates.
    // Link via Offer.candidateId == Employee.id (Offer.candidateId is a free-form string
    // but in practice often Employee.id for hires created via the preboarding cascade).
    const employeeById = new Map((employees || []).map((e) => [e.id, e]));
    const tthValues: number[] = [];
    const tthByDeptMap = new Map<string, number[]>();

    (applications || []).filter((a) => a.status === 'hired').forEach((a) => {
      const matchingOffer = (offers || []).find(
        (o) => o.jobPostingId === a.jobPostingId && o.status === 'accepted'
      );
      if (matchingOffer && employeeById.has(matchingOffer.candidateId)) {
        const emp = employeeById.get(matchingOffer.candidateId)!;
        const days = daysBetween(a.appliedDate, emp.dateOfJoining);
        if (days !== null && days >= 0) {
          tthValues.push(days);
          const deptName = emp.department?.name || (a.jobPosting?.department?.name ?? 'Unknown');
          const arr = tthByDeptMap.get(deptName) || [];
          arr.push(days);
          tthByDeptMap.set(deptName, arr);
        }
      }
    });

    const timeToHireAvg = tthValues.length > 0
      ? Math.round((tthValues.reduce((s, v) => s + v, 0) / tthValues.length) * 10) / 10
      : 0;

    const timeToHireByDepartment = Array.from(tthByDeptMap.entries()).map(([department, values]) => ({
      department,
      avgDays: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10,
      hiresCount: values.length,
    }));

    // ── Active jobs + open requisitions ──
    const activeJobs = (jobPostings || []).filter((j) => j.status === 'open').length;
    const openRequisitions = (requisitions || []).filter((r) => r.status === 'open' || r.status === 'approved').length;

    // ── By source ──
    const bySourceMap = new Map<string, number>();
    (applications || []).forEach((a) => {
      const s = a.source || 'website';
      bySourceMap.set(s, (bySourceMap.get(s) || 0) + 1);
    });
    const bySource: Record<string, number> = {};
    bySourceMap.forEach((v, k) => { bySource[k] = v; });

    // ── By department ──
    const deptAggMap = new Map<string, { open: number; filled: number; ttfDays: number[] }>();
    (jobPostings || []).forEach((j) => {
      const dept = j.department?.name || 'Unknown';
      const agg = deptAggMap.get(dept) || { open: 0, filled: 0, ttfDays: [] };
      if (j.status === 'open') agg.open += 1;
      if (j.status === 'filled') {
        agg.filled += 1;
        const days = daysBetween(j.postedDate, j.closingDate);
        if (days !== null && days >= 0) agg.ttfDays.push(days);
      }
      deptAggMap.set(dept, agg);
    });
    const byDepartment = Array.from(deptAggMap.entries()).map(([department, agg]) => ({
      department,
      open: agg.open,
      filled: agg.filled,
      avgTimeToFill: agg.ttfDays.length > 0
        ? Math.round((agg.ttfDays.reduce((s, v) => s + v, 0) / agg.ttfDays.length) * 10) / 10
        : 0,
    }));

    // ── Monthly trend (last 6 months) ──
    const monthlyMap = new Map<string, { hires: number; applications: number }>();
    // Initialize the 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
      monthlyMap.set(monthKey(d), { hires: 0, applications: 0 });
    }

    (applications || []).forEach((a) => {
      if (!a.appliedDate) return;
      const d = a.appliedDate instanceof Date ? a.appliedDate : new Date(a.appliedDate);
      if (d >= sixMonthsAgo) {
        const k = monthKey(d);
        const e = monthlyMap.get(k);
        if (e) e.applications += 1;
      }
    });

    (employees || []).forEach((e) => {
      if (!e.dateOfJoining) return;
      const d = e.dateOfJoining instanceof Date ? e.dateOfJoining : new Date(e.dateOfJoining);
      if (d >= sixMonthsAgo) {
        const k = monthKey(d);
        const entry = monthlyMap.get(k);
        if (entry) entry.hires += 1;
      }
    });

    const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, v]) => ({
      month,
      hires: v.hires,
      applications: v.applications,
    }));

    // ── Board postings summary (bonus context) ──
    const boardPostingsSummary = {
      total: Array.isArray(boardPostings) ? boardPostings.length : 0,
      posted: Array.isArray(boardPostings) ? boardPostings.filter((b) => b.status === 'posted').length : 0,
      closed: Array.isArray(boardPostings) ? boardPostings.filter((b) => b.status === 'closed').length : 0,
      failed: Array.isArray(boardPostings) ? boardPostings.filter((b) => b.status === 'failed').length : 0,
      pending: Array.isArray(boardPostings) ? boardPostings.filter((b) => b.status === 'pending').length : 0,
    };

    return NextResponse.json(
      {
        costPerHire,
        timeToFill: { avgDays: timeToFillAvg, byDepartment: timeToFillByDepartment },
        timeToHire: { avgDays: timeToHireAvg, byDepartment: timeToHireByDepartment },
        funnelByStage,
        offersAccepted,
        offersRejected,
        offerAcceptanceRate,
        activeJobs,
        openRequisitions,
        bySource,
        byDepartment,
        monthlyTrend,
        boardPostings: boardPostingsSummary,
        generatedAt: now.toISOString(),
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Recruitment analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
