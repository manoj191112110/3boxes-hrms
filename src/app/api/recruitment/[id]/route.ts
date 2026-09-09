import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/**
 * Tenant-scoped where clause for JobPosting (enforces REQ-SEC-CAND-05).
 * Chain: JobPosting → Department → Company → CompanyGroup → Tenant.
 * Super admins bypass.
 */
function tenantJobPostingFilter(id: string, decoded: Record<string, any> | null) {
  if (!decoded) return { id };
  if (decoded.role === 'super_admin') return { id };
  return {
    id,
    department: {
      company: {
        companyGroup: { tenantId: decoded.tenantId as string },
      },
    },
  };
}

/** Tenant-scoped where clause for JobApplication (via JobPosting → Department → ... → Tenant). */
function tenantApplicationFilter(id: string, decoded: Record<string, any> | null) {
  if (!decoded) return { id };
  if (decoded.role === 'super_admin') return { id };
  return {
    id,
    jobPosting: {
      department: {
        company: {
          companyGroup: { tenantId: decoded.tenantId as string },
        },
      },
    },
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const jobPosting = await db.jobPosting.findFirst({
      where: tenantJobPostingFilter(id, decodedRec),
      include: {
        department: {
          select: { id: true, name: true },
        },
        applications: {
          orderBy: { appliedDate: 'desc' },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!jobPosting) {
      return NextResponse.json(
        { error: 'Job posting not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { jobPosting },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get job posting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
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
      status,
    } = body;

    // Check if job posting exists AND belongs to caller's tenant
    const existing = await db.jobPosting.findFirst({
      where: tenantJobPostingFilter(id, decodedRec),
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Job posting not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // If moving to a new department, verify it's in the same tenant
    if (departmentId && departmentId !== existing.departmentId) {
      const newDept = await db.department.findFirst({
        where: {
          id: departmentId,
          company: {
            companyGroup: { tenantId: decodedRec.tenantId as string },
          },
        },
      });
      if (!newDept) {
        return NextResponse.json(
          { error: 'Target department not found in your tenant' },
          { status: 404, headers: corsHeaders() }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (position !== undefined) updateData.position = position;
    if (location !== undefined) updateData.location = location;
    if (type !== undefined) updateData.type = type;
    if (experience !== undefined) updateData.experience = experience;
    if (salary !== undefined) updateData.salary = salary;
    if (description !== undefined) updateData.description = description;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (vacancies !== undefined) updateData.vacancies = parseInt(String(vacancies)) || 1;
    if (closingDate !== undefined) updateData.closingDate = closingDate ? new Date(closingDate) : null;
    if (status !== undefined) updateData.status = status;

    const jobPosting = await db.jobPosting.update({
      where: { id },
      data: updateData,
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_JOB_POSTING',
        module: 'recruitment',
        details: `Updated job posting: ${jobPosting.title}`,
      },
    });

    return NextResponse.json(
      { jobPosting },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Update job posting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { status, feedback, aiFeedbackDraft } = body;

    // Try to update as job posting first (tenant-scoped)
    const jobPosting = await db.jobPosting.findFirst({
      where: tenantJobPostingFilter(id, decodedRec),
    });
    if (jobPosting) {
      const updateData: Record<string, unknown> = {};
      if (status !== undefined) updateData.status = status;

      const updated = await db.jobPosting.update({
        where: { id },
        data: updateData,
        include: {
          department: {
            select: { id: true, name: true },
          },
        },
      });

      return NextResponse.json(
        { jobPosting: updated },
        { headers: corsHeaders() }
      );
    }

    // Try to update as application (tenant-scoped via jobPosting → department → company → group → tenant)
    const application = await db.jobApplication.findFirst({
      where: tenantApplicationFilter(id, decodedRec),
    });
    if (application) {
      const updateData: Record<string, unknown> = {};
      if (status !== undefined) updateData.status = status;
      // AI-generated rejection feedback stored as JSON in `notes` field
      // (REQ-STAT-05/06 — HR can review the AI draft before publishing)
      if (aiFeedbackDraft !== undefined) {
        updateData.notes = JSON.stringify({
          ...(application.notes ? tryParseNotes(application.notes) : {}),
          aiFeedbackDraft,
          aiFeedbackReviewed: false,
          aiFeedbackPublishedAt: null,
        });
      }
      if (feedback !== undefined) {
        // HR has approved + published the AI feedback
        updateData.notes = JSON.stringify({
          ...(application.notes ? tryParseNotes(application.notes) : {}),
          aiFeedback: feedback,
          aiFeedbackReviewed: true,
          aiFeedbackPublishedAt: new Date().toISOString(),
        });
      }

      const updated = await db.jobApplication.update({
        where: { id },
        data: updateData,
      });

      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'UPDATE_APPLICATION_STATUS',
          module: 'recruitment',
          details: `Updated application status for ${updated.candidateName} to ${status}`,
        },
      });

      return NextResponse.json(
        { application: updated },
        { headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { error: 'Record not found' },
      { status: 404, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Patch recruitment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

function tryParseNotes(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return { raw: s }; }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Check if job posting exists AND belongs to caller's tenant
    const existing = await db.jobPosting.findFirst({
      where: tenantJobPostingFilter(id, decodedRec),
      include: { _count: { select: { applications: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Job posting not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Delete associated applications first
    await db.jobApplication.deleteMany({
      where: { jobPostingId: id },
    });

    // Delete the job posting
    await db.jobPosting.delete({
      where: { id },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_JOB_POSTING',
        module: 'recruitment',
        details: `Deleted job posting: ${existing.title}`,
      },
    });

    return NextResponse.json(
      { message: 'Job posting deleted successfully' },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Delete job posting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
