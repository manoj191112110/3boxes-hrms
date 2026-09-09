/**
 * GET /api/analytics/candidate-flow
 *
 * Aggregated candidate-acquisition analytics for Super Admin + HR Admin.
 *
 * Returns:
 *   - summary: total candidates, total applications, conversion rates,
 *     resume upload stats, parse success rate
 *   - registrationsOverTime: daily buckets of new candidate emails
 *     (first-applied date as proxy for registration date)
 *   - applicationsOverTime: daily buckets of all applications
 *   - funnel: applied → screening → interview → offered → hired → rejected counts
 *   - byCompany: top companies by application count
 *   - byDepartment: top departments by application count
 *   - byJobPosting: top job postings by application count
 *   - bySource: website / referral / job-board / etc.
 *   - resumeStats: total resumes uploaded, parse success count, parse failure count,
 *     avg confidence, by source format
 *   - topSkills: most-common skills across all parsed resumes
 *
 * Optionally scoped via query params:
 *   - tenantId (super_admin only — defaults to all tenants)
 *   - companyId (restrict to one company)
 *   - days (time window — default 90 days)
 *
 * Auth: requires employee JWT (super_admin / tenant_admin / hr_admin / recruiter).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

interface ParsedResumeShape {
  name?: string;
  email?: string;
  skills?: string[];
  experience?: Array<{ company?: string; role?: string; duration?: string }>;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  const token = getTokenFromHeaders(request);
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: CORS });
  const decoded = await verifyToken(token);
  if (!decoded || (decoded as any).kind === 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403, headers: CORS });
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '90', 10);
    const sinceDate = new Date(Date.now() - days * 86400000);
    const companyId = url.searchParams.get('companyId');
    const tenantId = url.searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        summary: { totalCandidates: 0, totalApplications: 0, conversionRate: 0, resumeUploadRate: 0, parseSuccessRate: 0 },
        registrationsOverTime: [],
        applicationsOverTime: [],
        funnel: { applied: 0, screening: 0, interview: 0, offered: 0, hired: 0, rejected: 0 },
        byCompany: [],
        byDepartment: [],
        byJobPosting: [],
        bySource: [],
        resumeStats: { total: 0, parsed: 0, failed: 0, avgConfidence: 0 },
        topSkills: [],
        message: 'Select a company from the switcher to view candidate flow.',
      }, { headers: CORS });
    }

    // Fetch all applications in the window with related data
    const applications = await db.jobApplication.findMany({
      where: { appliedDate: { gte: sinceDate } },
      include: {
        jobPosting: {
          select: {
            id: true,
            title: true,
            department: {
              select: {
                id: true,
                name: true,
                company: { select: { id: true, name: true, companyGroup: { select: { tenant: { select: { id: true, name: true } } } } } },
              },
            },
          },
        },
        resumeParses: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { appliedDate: 'desc' },
      take: 5000,
    });

    // ─── Summary stats ───
    const uniqueEmails = new Set<string>();
    const statusCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    const byCompany: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    const byJobPosting: Record<string, { id: string; title: string; count: number; company?: string }> = {};
    const byTenant: Record<string, { id: string; name: string; count: number }> = {};
    const registrationsOverTime: Record<string, number> = {};
    const applicationsOverTime: Record<string, number> = {};
    const firstSeenByEmail: Record<string, Date> = {};

    let resumeUploadCount = 0;
    let parseSuccessCount = 0;
    let parseFailureCount = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;
    const sourceFormatCounts: Record<string, number> = {};
    const skillFrequency: Record<string, number> = {};

    for (const app of applications) {
      const email = (app.candidateEmail || '').toLowerCase().trim();
      if (!email) continue;
      uniqueEmails.add(email);

      // Status aggregation
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;

      // Source aggregation
      const src = app.source || 'unknown';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;

      // Company / department / job posting aggregation
      const companyName = app.jobPosting?.department?.company?.name || 'Unknown';
      const deptName = app.jobPosting?.department?.name || 'Unknown';
      const tenantId = app.jobPosting?.department?.company?.companyGroup?.tenant?.id || 'unknown';
      const tenantName = app.jobPosting?.department?.company?.companyGroup?.tenant?.name || 'Unknown Tenant';
      byCompany[companyName] = (byCompany[companyName] || 0) + 1;
      byDepartment[deptName] = (byDepartment[deptName] || 0) + 1;
      byTenant[tenantId] = { id: tenantId, name: tenantName, count: (byTenant[tenantId]?.count || 0) + 1 };
      const jobId = app.jobPosting?.id || 'unknown';
      const jobTitle = app.jobPosting?.title || 'Unknown';
      if (!byJobPosting[jobId]) {
        byJobPosting[jobId] = { id: jobId, title: jobTitle, count: 0, company: companyName };
      }
      byJobPosting[jobId].count++;

      // Time-series — bucket by day
      const appliedDay = dayKey(new Date(app.appliedDate));
      applicationsOverTime[appliedDay] = (applicationsOverTime[appliedDay] || 0) + 1;

      // Track first-seen date per email (for registrations-over-time)
      const appliedDate = new Date(app.appliedDate);
      if (!firstSeenByEmail[email] || appliedDate < firstSeenByEmail[email]) {
        firstSeenByEmail[email] = appliedDate;
      }

      // Resume stats
      if (app.resume) resumeUploadCount++;
      const parse = app.resumeParses[0];
      if (parse) {
        if (parse.parseError) {
          parseFailureCount++;
        } else {
          parseSuccessCount++;
        }
        if (typeof parse.confidence === 'number') {
          confidenceSum += parse.confidence;
          confidenceCount++;
        }
        const sf = parse.sourceFormat || 'unknown';
        sourceFormatCounts[sf] = (sourceFormatCounts[sf] || 0) + 1;

        // Extract skills
        try {
          const parsed = JSON.parse(parse.parsedData as string) as ParsedResumeShape;
          if (Array.isArray(parsed?.skills)) {
            for (const skill of parsed.skills) {
              const slug = String(skill || '').toLowerCase().trim();
              if (slug) skillFrequency[slug] = (skillFrequency[slug] || 0) + 1;
            }
          }
        } catch { /* ignore */ }
      }
    }

    // Build registrations-over-time from first-seen dates
    for (const email of Object.keys(firstSeenByEmail)) {
      const day = dayKey(firstSeenByEmail[email]);
      registrationsOverTime[day] = (registrationsOverTime[day] || 0) + 1;
    }

    // Funnel: applied → screening → interview → offered → hired (and rejected)
    const funnel = {
      applied: statusCounts.applied || 0,
      screening: statusCounts.screening || 0,
      interview: statusCounts.interview || 0,
      offered: statusCounts.offered || 0,
      hired: statusCounts.hired || 0,
      rejected: statusCounts.rejected || 0,
      talent_pool: statusCounts.talent_pool || 0,
    };

    // Conversion rates
    const totalApps = applications.length;
    const conversion = {
      applied_to_screening: totalApps > 0 ? Math.round((funnel.screening / totalApps) * 1000) / 10 : 0,
      screening_to_interview: funnel.screening > 0 ? Math.round((funnel.interview / funnel.screening) * 1000) / 10 : 0,
      interview_to_offer: funnel.interview > 0 ? Math.round((funnel.offered / funnel.interview) * 1000) / 10 : 0,
      offer_to_hire: funnel.offered > 0 ? Math.round((funnel.hired / funnel.offered) * 1000) / 10 : 0,
      overall_applied_to_hire: totalApps > 0 ? Math.round((funnel.hired / totalApps) * 1000) / 10 : 0,
    };

    // Top skills
    const topSkills = Object.entries(skillFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([skill, count]) => ({ skill, count }));

    // Sort & slice the by-X buckets for the response
    const sortedByCompany = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count }));
    const sortedByDepartment = Object.entries(byDepartment).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count }));
    const sortedByJob = Object.values(byJobPosting).sort((a, b) => b.count - a.count).slice(0, 15);
    const sortedByTenant = Object.values(byTenant).sort((a, b) => b.count - a.count).slice(0, 15);
    const sortedBySource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

    // Sort time-series ascending by date
    const sortedDays = Array.from(new Set([...Object.keys(registrationsOverTime), ...Object.keys(applicationsOverTime)])).sort();
    const registrationsSeries = sortedDays.map(d => ({ date: d, count: registrationsOverTime[d] || 0 }));
    const applicationsSeries = sortedDays.map(d => ({ date: d, count: applicationsOverTime[d] || 0 }));

    return NextResponse.json({
      window: { days, since: sinceDate.toISOString(), until: new Date().toISOString() },
      summary: {
        uniqueCandidates: uniqueEmails.size,
        totalApplications: applications.length,
        applicationsPerCandidate: uniqueEmails.size > 0 ? Math.round((applications.length / uniqueEmails.size) * 10) / 10 : 0,
        resumeUploadCount,
        resumeUploadRate: applications.length > 0 ? Math.round((resumeUploadCount / applications.length) * 1000) / 10 : 0,
        parseSuccessCount,
        parseFailureCount,
        parseSuccessRate: (parseSuccessCount + parseFailureCount) > 0
          ? Math.round((parseSuccessCount / (parseSuccessCount + parseFailureCount)) * 1000) / 10
          : null,
        avgParseConfidence: confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) * 1000) / 10 : null,
      },
      funnel,
      conversion,
      registrationsOverTime: registrationsSeries,
      applicationsOverTime: applicationsSeries,
      byCompany: sortedByCompany,
      byDepartment: sortedByDepartment,
      byJobPosting: sortedByJob,
      byTenant: sortedByTenant,
      bySource: sortedBySource,
      resumeBySourceFormat: Object.entries(sourceFormatCounts).map(([format, count]) => ({ format, count })),
      topSkills,
    }, { headers: CORS });
  } catch (e: unknown) {
    console.error('GET /api/analytics/candidate-flow error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500, headers: CORS },
    );
  }
}
