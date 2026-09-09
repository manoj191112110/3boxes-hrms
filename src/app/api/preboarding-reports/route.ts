import { NextRequest, NextResponse } from 'next/server';
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

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/** GET /api/preboarding-reports — aggregate from PreboardingCandidate */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    await ensureSchemaSynced();

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'summary';
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        summary: { total: 0, active: 0, joined: 0, pending: 0 },
        byStage: [],
        message: 'Select a company from the switcher to view preboarding reports.',
      }, { headers: corsHeaders() });
    }

    // Fetch all candidates for aggregation
    const candidates = (await safeQuery(() => db.preboardingCandidate.findMany({
      select: {
        id: true,
        status: true,
        offerDate: true,
        joiningDate: true,
        backgroundCheckStatus: true,
        hrVerified: true,
        accountProvisioned: true,
        createdAt: true,
      },
    }))) ?? [];

    if (reportType === 'summary') {
      // Summary: totals, by stage, completion rates
      const total = candidates.length;
      const byStatus: Record<string, number> = {};
      for (const c of candidates) {
        byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      }

      const completedCount = candidates.filter(c => c.status === 'joined').length;
      const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

      // Average onboarding time (days from offerDate to joiningDate for joined candidates)
      const joinedWithDates = candidates.filter(c => c.status === 'joined' && c.joiningDate && c.offerDate);
      let avgOnboardingDays = 0;
      if (joinedWithDates.length > 0) {
        const totalDays = joinedWithDates.reduce((sum, c) => {
          const diff = (new Date(c.joiningDate!).getTime() - new Date(c.offerDate).getTime()) / (1000 * 60 * 60 * 24);
          return sum + Math.max(0, diff);
        }, 0);
        avgOnboardingDays = Math.round(totalDays / joinedWithDates.length);
      }

      // BGV stats
      const bgvByStatus: Record<string, number> = {};
      for (const c of candidates) {
        bgvByStatus[c.backgroundCheckStatus] = (bgvByStatus[c.backgroundCheckStatus] || 0) + 1;
      }

      return NextResponse.json({
        reportType: 'summary',
        data: {
          total,
          byStatus,
          completionRate,
          avgOnboardingDays,
          bgvByStatus,
          hrVerifiedCount: candidates.filter(c => c.hrVerified).length,
          accountProvisionedCount: candidates.filter(c => c.accountProvisioned).length,
        },
      }, { headers: corsHeaders() });
    }

    if (reportType === 'documents') {
      // Document status: candidates with their document/bgv/hr status
      const documentStatus = candidates.map(c => ({
        id: c.id,
        status: c.status,
        backgroundCheckStatus: c.backgroundCheckStatus,
        hrVerified: c.hrVerified,
        accountProvisioned: c.accountProvisioned,
      }));

      const docSummary = {
        total: candidates.length,
        bgvCleared: candidates.filter(c => c.backgroundCheckStatus === 'cleared').length,
        bgvPending: candidates.filter(c => c.backgroundCheckStatus === 'pending').length,
        bgvInProgress: candidates.filter(c => c.backgroundCheckStatus === 'in_progress').length,
        bgvFailed: candidates.filter(c => c.backgroundCheckStatus === 'failed').length,
        hrVerified: candidates.filter(c => c.hrVerified).length,
        hrPending: candidates.filter(c => !c.hrVerified).length,
        accountsProvisioned: candidates.filter(c => c.accountProvisioned).length,
        accountsPending: candidates.filter(c => !c.accountProvisioned).length,
      };

      return NextResponse.json({
        reportType: 'documents',
        data: { summary: docSummary, items: documentStatus },
      }, { headers: corsHeaders() });
    }

    if (reportType === 'pipeline') {
      // Monthly joining pipeline based on joiningDate
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const monthlyData: Record<string, { joined: number; expected: number; cancelled: number }> = {};

      // Initialize last 6 months
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = { joined: 0, expected: 0, cancelled: 0 };
      }

      for (const c of candidates) {
        const dateRef = c.joiningDate || c.offerDate;
        if (!dateRef) continue;
        const d = new Date(dateRef);
        if (d < sixMonthsAgo) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = { joined: 0, expected: 0, cancelled: 0 };

        if (c.status === 'joined') monthlyData[key].joined++;
        else if (c.status === 'cancelled') monthlyData[key].cancelled++;
        else monthlyData[key].expected++;
      }

      // Upcoming joinings (next 30 days)
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const upcoming = candidates.filter(c =>
        c.joiningDate &&
        new Date(c.joiningDate) >= now &&
        new Date(c.joiningDate) <= thirtyDaysLater &&
        c.status !== 'cancelled' &&
        c.status !== 'joined'
      ).length;

      return NextResponse.json({
        reportType: 'pipeline',
        data: { monthly: monthlyData, upcomingJoinings30d: upcoming },
      }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Unknown report type. Use: summary, documents, pipeline' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('GET preboarding-reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
