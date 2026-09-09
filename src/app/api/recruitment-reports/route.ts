import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';
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

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET — Compute recruitment report data from database.
 * Returns: hiringSummary, timeToHire, sourceAnalytics, offerAcceptance
 */
export async function GET(request: Request) {
  try {
    await ensureSchemaSynced();

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
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        hiringSummary: { totalOpen: 0, totalApplications: 0, totalInterviews: 0, totalOffers: 0, totalHires: 0, totalRequisitions: 0 },
        overall: { totalOpenPositions: 0, totalApplications: 0, totalOffersMade: 0, totalHired: 0, hiringRate: 0, timeToFillAvg: 0, timeToHireAvg: 0, openRequisitions: 0 },
        timeToHire: [],
        sourceAnalytics: [],
        offerAcceptance: [],
        monthlyTrend: [],
        message: 'Select a company from the switcher to view recruitment reports.',
      }, { headers: corsHeaders() });
    }

    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 86400000);

    // Parallel data fetch with safeQuery so one failure doesn't crash the batch
    const [
      jobPostings,
      applications,
      offers,
      requisitions,
    ] = await Promise.all([
      safeQuery(() => db.jobPosting.findMany({
        include: {
          department: { select: { id: true, name: true } },
          applications: { select: { id: true, status: true, appliedDate: true, source: true } },
        },
      })),
      safeQuery(() => db.jobApplication.findMany({
        select: {
          id: true,
          status: true,
          appliedDate: true,
          source: true,
          jobPostingId: true,
          jobPosting: { select: { id: true, title: true, departmentId: true, department: { select: { id: true, name: true } } } },
        },
      })),
      safeQuery(() => db.offer.findMany({
        select: {
          id: true,
          status: true,
          candidateName: true,
          createdAt: true,
          respondedAt: true,
        },
      })),
      safeQuery(() => db.requisition.findMany({
        select: { id: true, status: true, numberOfOpenings: true },
      })),
    ]);

    const _jobPostings = jobPostings ?? [];
    const _applications = applications ?? [];
    const _offers = offers ?? [];
    const _requisitions = requisitions ?? [];

    // ── Hiring Summary (by department) ──
    const deptMap = new Map<string, { open: number; inProgress: number; hired: number }>();
    // Initialize departments from job postings
    _jobPostings.forEach((j) => {
      const dept = j.department?.name || 'Unknown';
      if (!deptMap.has(dept)) deptMap.set(dept, { open: 0, inProgress: 0, hired: 0 });
      const agg = deptMap.get(dept)!;
      if (j.status === 'open') agg.open += 1;
      // In-progress: jobs with at least one non-terminal application
      const inProgressApps = (j.applications || []).filter(
        (a) => !['rejected', 'hired'].includes(a.status)
      );
      if (inProgressApps.length > 0 && j.status !== 'filled') agg.inProgress += inProgressApps.length;
    });

    // Count hired applications by department
    _applications.filter((a) => a.status === 'hired').forEach((a) => {
      const dept = a.jobPosting?.department?.name || 'Unknown';
      if (!deptMap.has(dept)) deptMap.set(dept, { open: 0, inProgress: 0, hired: 0 });
      deptMap.get(dept)!.hired += 1;
    });

    const hiringSummary = Array.from(deptMap.entries()).map(([department, v]) => ({
      department,
      ...v,
    }));

    // ── Overall Summary ──
    const totalOpenPositions = _jobPostings.filter((j) => j.status === 'open').length;
    const totalApplications = _applications.length;
    const totalOffersMade = _offers.length;
    const totalHired = _applications.filter((a) => a.status === 'hired').length;
    const hiringRate = totalApplications > 0 ? Math.round((totalHired / totalApplications) * 1000) / 10 : 0;

    // ── Time to Hire ──
    // Average days from application to hire for hired candidates
    const tthValues: number[] = [];
    const tthByDeptMap = new Map<string, number[]>();
    _applications.filter((a) => a.status === 'hired' && a.appliedDate).forEach((a) => {
      // Use the latest interview or offer date as proxy for "hire date"
      // In absence of a direct hireDate on the application, we look at corresponding offer
      const matchingOffer = _offers.find(
        (o) => o.jobPostingId === a.jobPostingId && o.status === 'accepted'
      );
      if (matchingOffer?.respondedAt) {
        const days = daysBetween(a.appliedDate, matchingOffer.respondedAt);
        if (days !== null && days >= 0) {
          tthValues.push(days);
          const dept = a.jobPosting?.department?.name || 'Unknown';
          const arr = tthByDeptMap.get(dept) || [];
          arr.push(days);
          tthByDeptMap.set(dept, arr);
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

    // ── Time to Fill ──
    const ttfValues: number[] = [];
    _jobPostings.filter((j) => j.status === 'filled' && j.postedDate).forEach((j) => {
      const days = daysBetween(j.postedDate, j.closingDate);
      if (days !== null && days >= 0) ttfValues.push(days);
    });
    const timeToFillAvg = ttfValues.length > 0
      ? Math.round((ttfValues.reduce((s, v) => s + v, 0) / ttfValues.length) * 10) / 10
      : 0;

    // ── Source Analytics ──
    const bySourceMap = new Map<string, { applications: number; hired: number }>();
    _applications.forEach((a) => {
      const src = a.source || 'website';
      if (!bySourceMap.has(src)) bySourceMap.set(src, { applications: 0, hired: 0 });
      const agg = bySourceMap.get(src)!;
      agg.applications += 1;
      if (a.status === 'hired') agg.hired += 1;
    });

    const sourceAnalytics = Array.from(bySourceMap.entries()).map(([source, v]) => ({
      source,
      ...v,
      conversionRate: v.applications > 0 ? Math.round((v.hired / v.applications) * 1000) / 10 : 0,
    }));

    // ── Offer Acceptance ──
    const offersAccepted = _offers.filter((o) => o.status === 'accepted').length;
    const offersRejected = _offers.filter((o) => o.status === 'rejected').length;
    const offersPending = _offers.filter((o) => !['accepted', 'rejected', 'withdrawn'].includes(o.status)).length;
    const totalOfferResponses = offersAccepted + offersRejected;
    const offerAcceptanceRate = totalOfferResponses > 0
      ? Math.round((offersAccepted / totalOfferResponses) * 1000) / 10
      : 0;

    // ── Monthly Trend (last 6 months) ──
    const monthlyMap = new Map<string, { applications: number; hires: number; offers: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
      monthlyMap.set(monthKey(d), { applications: 0, hires: 0, offers: 0 });
    }

    _applications.forEach((a) => {
      if (!a.appliedDate) return;
      const d = a.appliedDate instanceof Date ? a.appliedDate : new Date(a.appliedDate);
      if (d >= sixMonthsAgo) {
        const k = monthKey(d);
        const e = monthlyMap.get(k);
        if (e) e.applications += 1;
        if (a.status === 'hired' && e) e.hires += 1;
      }
    });

    _offers.forEach((o) => {
      const d = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt);
      if (d >= sixMonthsAgo) {
        const k = monthKey(d);
        const e = monthlyMap.get(k);
        if (e) e.offers += 1;
      }
    });

    const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, v]) => ({
      month,
      ...v,
    }));

    // ── Open Requisitions ──
    const openRequisitions = _requisitions.filter(
      (r) => r.status === 'open' || r.status === 'approved'
    ).length;

    return NextResponse.json(
      {
        hiringSummary,
        overall: {
          totalOpenPositions,
          totalApplications,
          totalOffersMade,
          totalHired,
          hiringRate,
          timeToFillAvg,
          timeToHireAvg,
          openRequisitions,
        },
        timeToHire: {
          avgDays: timeToHireAvg,
          byDepartment: timeToHireByDepartment,
        },
        sourceAnalytics,
        offerAcceptance: {
          accepted: offersAccepted,
          rejected: offersRejected,
          pending: offersPending,
          acceptanceRate: offerAcceptanceRate,
        },
        monthlyTrend,
        generatedAt: now.toISOString(),
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('GET recruitment-reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
