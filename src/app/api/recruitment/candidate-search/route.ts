/**
 * GET /api/recruitment/candidate-search
 *
 * Talent Acquisition — Job Search Matrix
 *
 * Lets a recruiter shortlist candidates across ALL applications (not just
 * one job) by filtering on:
 *   - skills (comma-separated; candidate must have ALL of them)
 *   - minExperienceYears (parsed from resume experience entries)
 *   - maxExperienceYears
 *   - minSalary / maxSalary (expectedSalary string → numeric LPA parse)
 *   - status (application status filter; default: exclude rejected)
 *   - jobPostingId (optional — restrict to candidates who applied to this job)
 *   - q (free-text search across name/email/skills)
 *
 * Returns aggregated candidate rows with their parsed resume data, match
 * score (if any), and the list of jobs they've applied to.
 *
 * The endpoint is read-only and tenant-scoped via the JWT.
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
  phone?: string;
  skills?: string[];
  experience?: Array<{ company?: string; role?: string; duration?: string }>;
  education?: Array<{ degree?: string; institution?: string; year?: string }>;
  summary?: string;
}

/** Parse "Mar 2020 - Present" / "2 years 3 months" / "3.5 years" → number of years. */
function parseDurationYears(duration: string | undefined): number {
  if (!duration) return 0;
  const d = duration.toLowerCase();
  // Range form: "Mar 2020 - Present" or "Jan 2018 - Dec 2021"
  const rangeMatch = d.match(/(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\s*\d{4})\s*[-–to]+\s*(present|current|now|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\s*\d{4})/);
  if (rangeMatch) {
    const startStr = rangeMatch[1];
    const endStr = rangeMatch[2];
    const startYear = parseInt(startStr.match(/\d{4}/)?.[0] || '0', 10);
    const endYear = endStr.match(/present|current|now/i)
      ? new Date().getFullYear()
      : parseInt(endStr.match(/\d{4}/)?.[0] || String(new Date().getFullYear()), 10);
    if (startYear && endYear && endYear >= startYear) {
      return endYear - startYear;
    }
  }
  // "X years" / "X years Y months"
  const yearsMatch = d.match(/(\d+(?:\.\d+)?)\s*(?:yrs|years|year)/);
  if (yearsMatch) return parseFloat(yearsMatch[1]);
  const monthsMatch = d.match(/(\d+)\s*(?:months|month|mos)/);
  if (monthsMatch) return parseInt(monthsMatch[1], 10) / 12;
  return 0;
}

/** Parse "₹12 LPA" / "12,00,000" / "1200000" / "$80,000" → numeric LPA. */
function parseSalaryLPA(s: string | null | undefined): number | null {
  if (!s) return null;
  const cleaned = s.toLowerCase().replace(/[,\s]/g, '');
  // "12lpa" / "12l"
  const lpaMatch = cleaned.match(/(\d+(?:\.\d+)?)l(?:pa)?/);
  if (lpaMatch) return parseFloat(lpaMatch[1]);
  // raw rupees: "1200000" → 12 LPA
  const rawNum = parseInt(cleaned.replace(/[^\d]/g, ''), 10);
  if (rawNum && rawNum > 100000) {
    return rawNum / 100000;
  }
  if (rawNum && rawNum > 0) {
    // Likely already in LPA form (e.g. "12")
    return rawNum;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  // Auth — require an employee JWT (recruiters + admins)
  const token = getTokenFromHeaders(request);
  if (!token) {
    return NextResponse.json({ error: 'No token' }, { status: 401, headers: CORS });
  }
  const decoded = await verifyToken(token);
  if (!decoded || (decoded as any).kind === 'candidate') {
    return NextResponse.json({ error: 'Candidate tokens cannot access this endpoint' }, { status: 403, headers: CORS });
  }

  try {
    const url = new URL(request.url);
    const skillsParam = url.searchParams.get('skills') || '';
    const minExp = url.searchParams.get('minExperienceYears');
    const maxExp = url.searchParams.get('maxExperienceYears');
    const minSalary = url.searchParams.get('minSalary');
    const maxSalary = url.searchParams.get('maxSalary');
    const status = url.searchParams.get('status') || '';
    const jobPostingId = url.searchParams.get('jobPostingId') || '';
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
    const companyId = url.searchParams.get('companyId');
    const tenantId = url.searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({ candidates: [], total: 0 }, { headers: CORS });
    }

    const requiredSkills = skillsParam
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const minExpYears = minExp ? parseFloat(minExp) : null;
    const maxExpYears = maxExp ? parseFloat(maxExp) : null;
    const minSalaryLpa = minSalary ? parseFloat(minSalary) : null;
    const maxSalaryLpa = maxSalary ? parseFloat(maxSalary) : null;

    // Build Prisma where-clause for JobApplication
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (jobPostingId) where.jobPostingId = jobPostingId;
    if (status) {
      where.status = status;
    } else {
      // Default: exclude rejected candidates
      where.status = { not: 'rejected' };
    }

    // Fetch applications with their resume parse + job posting context.
    // Note: the Prisma relation is `resumeOptimization` (singular) per schema.prisma
    // line 615 — JobApplication has one CandidateResumeOptimization, not many.
    const applications = await db.jobApplication.findMany({
      where,
      include: {
        jobPosting: {
          select: {
            id: true,
            title: true,
            position: true,
            department: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
          },
        },
        resumeParses: { orderBy: { createdAt: 'desc' }, take: 1 },
        resumeOptimization: { select: { matchScore: true, updatedAt: true } },
      },
      orderBy: { appliedDate: 'desc' },
      take: limit * 3, // over-fetch because we filter in JS after parsing
    });

    // Aggregate by candidateEmail — a candidate may have applied to multiple jobs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byCandidate = new Map<string, any>();
    for (const app of applications) {
      const email = (app.candidateEmail || '').toLowerCase().trim();
      if (!email) continue;

      // Parse the latest resume parse JSON
      let parsed: ParsedResumeShape | null = null;
      if (app.resumeParses[0]?.parsedData) {
        try {
          parsed = JSON.parse(app.resumeParses[0].parsedData as string) as ParsedResumeShape;
        } catch { /* ignore */ }
      }

      const experienceEntries = parsed?.experience || [];
      // Total years of experience = sum across all entries
      const totalYears = experienceEntries.reduce((sum, e) => sum + parseDurationYears(e.duration), 0);
      const candidateSkills = (parsed?.skills || []).map(s => s.toLowerCase());

      const expectedSalaryLpa = parseSalaryLPA(app.expectedSalary);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let entry = byCandidate.get(email) as any;
      if (!entry) {
        entry = {
          candidateEmail: email,
          candidateName: app.candidateName,
          candidatePhone: app.candidatePhone,
          skills: candidateSkills,
          totalExperienceYears: totalYears,
          expectedSalaryLpa,
          latestStatus: app.status,
          latestAppliedDate: app.appliedDate,
          parsedResume: parsed,
          matchScore: app.resumeOptimization?.matchScore ?? null,
          applications: [],
        };
        byCandidate.set(email, entry);
      } else {
        // Merge — keep the max experience, latest salary, latest status
        entry.totalExperienceYears = Math.max(entry.totalExperienceYears, totalYears);
        if (expectedSalaryLpa !== null) entry.expectedSalaryLpa = expectedSalaryLpa;
        // Take the highest match score across all their applications
        if (app.resumeOptimization?.matchScore != null) {
          entry.matchScore = Math.max(entry.matchScore ?? 0, app.resumeOptimization.matchScore);
        }
        // Merge skills (union)
        for (const s of candidateSkills) {
          if (!entry.skills.includes(s)) entry.skills.push(s);
        }
      }
      entry.applications.push({
        id: app.id,
        jobPostingId: app.jobPosting.id,
        jobTitle: app.jobPosting.title,
        position: app.jobPosting.position,
        department: app.jobPosting.department?.name,
        company: app.jobPosting.department?.company?.name,
        status: app.status,
        appliedDate: app.appliedDate,
      });
    }

    // Apply filters in JS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let candidates = Array.from(byCandidate.values()) as any[];

    // Skills filter — candidate must have ALL required skills (case-insensitive substring match)
    if (requiredSkills.length > 0) {
      candidates = candidates.filter(c =>
        requiredSkills.every(req => c.skills.some((s: string) => s.includes(req) || req.includes(s)))
      );
    }

    // Experience filter
    if (minExpYears !== null) {
      candidates = candidates.filter(c => c.totalExperienceYears >= minExpYears!);
    }
    if (maxExpYears !== null) {
      candidates = candidates.filter(c => c.totalExperienceYears <= maxExpYears!);
    }

    // Salary filter
    if (minSalaryLpa !== null) {
      candidates = candidates.filter(c => c.expectedSalaryLpa !== null && c.expectedSalaryLpa >= minSalaryLpa!);
    }
    if (maxSalaryLpa !== null) {
      candidates = candidates.filter(c => c.expectedSalaryLpa !== null && c.expectedSalaryLpa <= maxSalaryLpa!);
    }

    // Free-text search across name / email / skills
    if (q) {
      candidates = candidates.filter(c =>
        c.candidateName.toLowerCase().includes(q) ||
        c.candidateEmail.toLowerCase().includes(q) ||
        c.skills.some((s: string) => s.includes(q))
      );
    }

    // Truncate to limit
    candidates = candidates.slice(0, limit);

    // Compute summary stats
    const summary = {
      totalMatches: candidates.length,
      avgExperienceYears: candidates.length > 0
        ? Math.round(candidates.reduce((s, c) => s + c.totalExperienceYears, 0) / candidates.length * 10) / 10
        : 0,
      avgExpectedSalaryLpa: candidates.filter(c => c.expectedSalaryLpa !== null).length > 0
        ? Math.round(candidates.filter(c => c.expectedSalaryLpa !== null).reduce((s, c) => s + c.expectedSalaryLpa, 0) / candidates.filter(c => c.expectedSalaryLpa !== null).length * 10) / 10
        : null,
      uniqueSkills: Array.from(new Set(candidates.flatMap(c => c.skills))).sort().slice(0, 50),
    };

    return NextResponse.json({
      candidates,
      summary,
      filters: {
        skills: requiredSkills,
        minExperienceYears: minExpYears,
        maxExperienceYears: maxExpYears,
        minSalary: minSalaryLpa,
        maxSalary: maxSalaryLpa,
        status: status || null,
        jobPostingId: jobPostingId || null,
        q: q || null,
      },
    }, { headers: CORS });
  } catch (e: unknown) {
    console.error('GET /api/recruitment/candidate-search error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500, headers: CORS },
    );
  }
}
