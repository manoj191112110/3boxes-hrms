import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { validateEmail, validatePhone } from '@/lib/validators';
import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/**
 * Build a Prisma `where` clause that restricts JobPosting results to the
 * authenticated user's tenant. This enforces REQ-SEC-CAND-05 (Cross-Tenant
 * Blindness) so an HR user from Company A cannot list / read / edit job
 * postings belonging to Company B (a different tenant).
 *
 * The chain is:
 *   JobPosting → Department → Company → CompanyGroup → Tenant
 *
 * Super admins bypass the filter (they can see all tenants).
 */
function tenantWhere(decoded: Record<string, any> | null): Record<string, unknown> {
  if (!decoded) return {};
  if (decoded.role === 'super_admin') return {};
  return {
    department: {
      company: {
        companyGroup: { tenantId: decoded.tenantId as string },
      },
    },
  };
}

/** Same filter but for a single-record lookup by id. */
function tenantScopedJobPostingFilter(id: string, decoded: Record<string, any> | null) {
  return {
    id,
    ...tenantWhere(decoded),
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
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
    const decodedRec = decoded as unknown as Record<string, any>;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const departmentId = searchParams.get('departmentId');
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        jobPostings: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }, { headers: corsHeaders() });
    }

    // Start with the tenant filter (critical for cross-tenant blindness)
    const where: Record<string, unknown> = tenantWhere(decodedRec);
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;

    const [jobPostings, total] = await Promise.all([
      db.jobPosting.findMany({
        where,
        include: {
          department: {
            select: { id: true, name: true },
          },
          applications: {
            select: {
              id: true,
              candidateName: true,
              candidateEmail: true,
              candidatePhone: true,
              source: true,
              status: true,
              appliedDate: true,
              rating: true,
              expectedSalary: true,
              notes: true,
              jobPostingId: true,
            },
            orderBy: { appliedDate: 'desc' },
          },
          _count: {
            select: { applications: true },
          },
        },
        orderBy: { postedDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.jobPosting.count({ where }),
    ]);

    return NextResponse.json(
      {
        jobPostings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get recruitment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: Request) {
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
    const decodedRec = decoded as unknown as Record<string, any>;

    const body = await request.json();

    // Handle application submission (HR-side manual apply on behalf of candidate)
    if (body.action === 'apply') {
      const { jobPostingId, candidateName, candidateEmail, candidatePhone, source, expectedSalary } = body;

      if (!jobPostingId || !candidateName || !candidateEmail) {
        return NextResponse.json(
          { error: 'Missing required fields: jobPostingId, candidateName, candidateEmail' },
          { status: 400, headers: corsHeaders() }
        );
      }

      // ─── Server-side validation ───
      if (candidatePhone && typeof candidatePhone === 'string') {
        const phoneResult = validatePhone(candidatePhone);
        if (!phoneResult.valid) {
          return NextResponse.json({ error: phoneResult.error }, { status: 400, headers: corsHeaders() });
        }
      }
      if (candidateEmail && typeof candidateEmail === 'string') {
        const emailResult = validateEmail(candidateEmail);
        if (!emailResult.valid) {
          return NextResponse.json({ error: emailResult.error }, { status: 400, headers: corsHeaders() });
        }
      }

      // Verify job posting exists AND belongs to the caller's tenant
      const jobExists = await db.jobPosting.findFirst({
        where: tenantScopedJobPostingFilter(jobPostingId, decodedRec),
      });
      if (!jobExists) {
        return NextResponse.json(
          { error: 'Job posting not found' },
          { status: 404, headers: corsHeaders() }
        );
      }

      const application = await db.jobApplication.create({
        data: {
          jobPostingId,
          candidateName,
          candidateEmail,
          candidatePhone,
          source: source || 'website',
          expectedSalary,
          status: 'applied',
        },
      });

      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'SUBMIT_APPLICATION',
          module: 'recruitment',
          details: `Application submitted by ${candidateName} for job: ${jobExists.title}`,
        },
      });

      return NextResponse.json(
        { application },
        { status: 201, headers: corsHeaders() }
      );
    }

    // Handle job posting creation
    const {
      title,
      departmentId,
      position,
      location,
      type,
      experience,
      salary,
      description,
      requirements,
      closingDate,
      vacancies,
    } = body;

    if (!title || !departmentId || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: title, departmentId, description' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Verify the department belongs to the caller's tenant (prevent cross-tenant job creation)
    const department = await db.department.findFirst({
      where: {
        id: departmentId,
        company: {
          companyGroup: { tenantId: decodedRec.tenantId as string },
        },
      },
    });
    if (!department) {
      return NextResponse.json(
        { error: 'Department not found in your tenant' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const jobPosting = await db.jobPosting.create({
      data: {
        title,
        departmentId,
        position: position || title,
        location,
        type: type || 'full-time',
        experience,
        salary,
        description,
        requirements,
        closingDate: closingDate ? new Date(closingDate) : null,
        vacancies: vacancies || 1,
        status: 'open',
      },
      include: {
        department: {
          select: { name: true },
        },
      },
    });

    // Notify HR admins about the new job posting
    const hrAdmins = await db.user.findMany({
      where: {
        tenantId: decodedRec.tenantId as string,
        role: { in: ['super_admin', 'tenant_admin', 'admin'] },
      },
    });

    for (const admin of hrAdmins) {
      await createNotification({
        tenantId: decodedRec.tenantId as string,
        userId: admin.id,
        title: 'New Job Posting Created',
        message: `A new job posting "${title}" has been created for ${jobPosting.department.name} department.`,
        type: 'info',
        category: 'recruitment',
        link: `/recruitment/${jobPosting.id}`,
      });
    }

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_JOB_POSTING',
        module: 'recruitment',
        details: `Created job posting: ${title}`,
      },
    });

    return NextResponse.json(
      { jobPosting },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create job posting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
