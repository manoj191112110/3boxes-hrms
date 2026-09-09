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

    const fnfCalculation = await db.fNFCalculation.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeId: true,
            email: true, department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!fnfCalculation) {
      return NextResponse.json({ error: 'FNF calculation not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ fnfCalculation }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get FNF detail error:', error);
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
    const { status, remarks, pendingSalary, leaveEncashment, bonus, incentives, noticeRecovery, assetRecovery, loanRecovery, taxDeduction, otherRecoveries, totalEarnings, totalDeductions, netAmount } = body;

    const existing = await db.fNFCalculation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'FNF calculation not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};

    // Handle status changes
    if (status) {
      const validStatuses = ['pending', 'approved', 'paid', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400, headers: corsHeaders() }
        );
      }
      updateData.status = status;

      if (status === 'approved') {
        updateData.approvedBy = decoded.userId as string;
        updateData.approvedAt = new Date();
      }
      if (status === 'paid') {
        updateData.paidAt = new Date();
        if (!existing.approvedAt) {
          updateData.approvedBy = decoded.userId as string;
          updateData.approvedAt = new Date();
        }
      }
    }
    if (remarks !== undefined) updateData.remarks = remarks;

    // Handle field editing
    if (pendingSalary !== undefined) updateData.pendingSalary = pendingSalary;
    if (leaveEncashment !== undefined) updateData.leaveEncashment = leaveEncashment;
    if (bonus !== undefined) updateData.bonus = bonus;
    if (incentives !== undefined) updateData.incentives = incentives;
    if (noticeRecovery !== undefined) updateData.noticeRecovery = noticeRecovery;
    if (assetRecovery !== undefined) updateData.assetRecovery = assetRecovery;
    if (loanRecovery !== undefined) updateData.loanRecovery = loanRecovery;
    if (taxDeduction !== undefined) updateData.taxDeduction = taxDeduction;
    if (otherRecoveries !== undefined) updateData.otherRecoveries = otherRecoveries;
    if (totalEarnings !== undefined) updateData.totalEarnings = totalEarnings;
    if (totalDeductions !== undefined) updateData.totalDeductions = totalDeductions;
    if (netAmount !== undefined) updateData.netAmount = netAmount;

    const fnfCalculation = await db.fNFCalculation.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true, userId: true },
        },
      },
    });

    // Notify employee on status change only
    if (status && status !== existing.status) {
      if (fnfCalculation.employee.userId) {
        await createNotification({
          tenantId: decoded.tenantId as string,
          userId: fnfCalculation.employee.userId,
          title: 'FNF Status Updated',
          message: `Your Full & Final settlement has been ${status}. Net amount: ${fnfCalculation.netAmount} ${fnfCalculation.currency}.`,
          type: status === 'paid' ? 'success' : status === 'approved' ? 'success' : status === 'cancelled' ? 'warning' : 'info',
          category: 'payroll',
          link: `/fnf/${id}`,
        });
      }
    }

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_FNF',
        module: 'fnf',
        details: `Updated FNF ${id} status to ${status || existing.status}`,
      },
    });

    return NextResponse.json({ fnfCalculation }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Patch FNF error:', error);
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

    const existing = await db.fNFCalculation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'FNF calculation not found' }, { status: 404, headers: corsHeaders() });
    }

    await db.fNFCalculation.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_FNF',
        module: 'fnf',
        details: `Deleted FNF calculation ${id}`,
      },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete FNF error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
