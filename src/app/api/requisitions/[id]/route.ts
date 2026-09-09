import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;

    const requisition = await db.requisition.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, title: true, level: true, minSalary: true, maxSalary: true } },
        company: { select: { id: true, name: true } },
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ requisition }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get requisition error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
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
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    const body = await request.json();
    const { approvalStatus, rejectionReason, departmentId, designationId, positionType, numberOfOpenings, employmentType, skillsRequired, experienceRequired, qualification, salaryBudget, priority, expectedJoiningDate } = body;

    const existing = await db.requisition.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};

    // Handle approval status changes
    if (approvalStatus) {
      const validStatuses = ['pending', 'manager_approved', 'hr_approved', 'budget_approved', 'rejected'];
      if (!validStatuses.includes(approvalStatus)) {
        return NextResponse.json(
          { error: `Invalid approval status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400, headers: corsHeaders() }
        );
      }
      updateData.approvalStatus = approvalStatus;
      updateData.approvedBy = decoded.userId as string;
      updateData.approvedAt = new Date();

      if (approvalStatus === 'rejected') {
        updateData.status = 'cancelled';
        updateData.rejectionReason = rejectionReason;
      } else if (approvalStatus === 'budget_approved') {
        updateData.status = 'approved';
      }
    }
    if (rejectionReason) updateData.rejectionReason = rejectionReason;

    // Handle field editing
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (designationId !== undefined) updateData.designationId = designationId || null;
    if (positionType !== undefined) updateData.positionType = positionType;
    if (numberOfOpenings !== undefined) updateData.numberOfOpenings = numberOfOpenings;
    if (employmentType !== undefined) updateData.employmentType = employmentType;
    if (skillsRequired !== undefined) updateData.skillsRequired = skillsRequired || null;
    if (experienceRequired !== undefined) updateData.experienceRequired = experienceRequired || null;
    if (qualification !== undefined) updateData.qualification = qualification || null;
    if (salaryBudget !== undefined) updateData.salaryBudget = salaryBudget || null;
    if (priority !== undefined) updateData.priority = priority;
    if (expectedJoiningDate !== undefined) updateData.expectedJoiningDate = expectedJoiningDate ? new Date(expectedJoiningDate) : null;

    const requisition = await db.requisition.update({
      where: { id },
      data: updateData,
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
      },
    });

    // Notify the hiring manager or requester (only for approval changes)
    if (approvalStatus && existing.hiringManagerId) {
      await createNotification({
        tenantId: decoded.tenantId as string,
        userId: existing.hiringManagerId,
        title: 'Requisition Status Updated',
        message: `Requisition ${existing.requisitionId} has been ${approvalStatus}.`,
        type: approvalStatus === 'rejected' ? 'warning' : 'success',
        category: 'recruitment',
        link: `/requisitions/${id}`,
      });
    }

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_REQUISITION',
        module: 'requisitions',
        details: `Updated requisition ${existing.requisitionId}${approvalStatus ? ` approval status to ${approvalStatus}` : ''}`,
      },
    });

    return NextResponse.json({ requisition }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Patch requisition error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;

    const existing = await db.requisition.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404, headers: corsHeaders() });
    }

    await db.requisition.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_REQUISITION',
        module: 'requisitions',
        details: `Deleted requisition ${existing.requisitionId}`,
      },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete requisition error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
