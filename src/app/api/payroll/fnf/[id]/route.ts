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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    try {
      const data = await db.fNFCalculation.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              dateOfJoining: true,
              department: { select: { name: true } },
              designation: { select: { title: true } },
              bankName: true,
              bankAccountNo: true,
              bankIfscCode: true,
              panNumber: true,
            },
          },
        },
      });

      if (!data) return Response.json({ error: 'F&F calculation not found' }, { status: 404, headers: corsHeaders });

      // Also fetch separation details if separationId exists
      let separation = null;
      if (data.separationId) {
        try {
          separation = await db.separation.findUnique({
            where: { id: data.separationId },
          });
        } catch (dbError: unknown) {
          console.error('Database error fetching separation for F&F:', dbError);
          separation = null;
        }
      }

      return Response.json({ data: { ...data, separation } }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching F&F calculation:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching F&F calculation:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();

    // Auto-recalculate totals if any earning/deduction fields are provided
    const pendingSalary = Number(body.pendingSalary) || 0;
    const leaveEncashment = Number(body.leaveEncashment) || 0;
    const bonus = Number(body.bonus) || 0;
    const incentives = Number(body.incentives) || 0;
    const reimbursements = Number(body.reimbursements) || 0;
    const noticeRecovery = Number(body.noticeRecovery) || 0;
    const assetRecovery = Number(body.assetRecovery) || 0;
    const loanRecovery = Number(body.loanRecovery) || 0;
    const taxDeduction = Number(body.taxDeduction) || 0;
    const otherRecoveries = Number(body.otherRecoveries) || 0;

    const totalEarnings = pendingSalary + leaveEncashment + bonus + incentives + reimbursements;
    const totalDeductions = noticeRecovery + assetRecovery + loanRecovery + taxDeduction + otherRecoveries;
    const netAmount = totalEarnings - totalDeductions;

    try {
      const data = await db.fNFCalculation.update({
        where: { id },
        data: {
          ...(body.separationId !== undefined && { separationId: body.separationId || null }),
          pendingSalary,
          leaveEncashment,
          bonus,
          incentives,
          reimbursements,
          noticeRecovery,
          assetRecovery,
          loanRecovery,
          taxDeduction,
          otherRecoveries,
          totalEarnings,
          totalDeductions,
          netAmount,
          ...(body.currency && { currency: body.currency }),
          ...(body.remarks !== undefined && { remarks: body.remarks }),
        },
      });

      return Response.json({ data, message: 'F&F calculation updated successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error updating F&F calculation:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error updating F&F calculation:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const { status, remarks } = body;

    if (!status || !['approved', 'paid', 'cancelled'].includes(status)) {
      return Response.json({ error: 'Invalid status. Must be approved, paid, or cancelled' }, { status: 400, headers: corsHeaders });
    }

    const updateData: Record<string, unknown> = { status };
    if (status === 'approved') {
      updateData.approvedBy = decoded.userId as string;
      updateData.approvedAt = new Date();
    }
    if (status === 'paid') {
      updateData.paidAt = new Date();
      // Also set approved info if not already approved
      updateData.approvedBy = (decoded.userId as string);
      updateData.approvedAt = new Date();
    }
    if (remarks) updateData.remarks = remarks;

    try {
      const data = await db.fNFCalculation.update({
        where: { id },
        data: updateData,
      });

      return Response.json({ data, message: `F&F calculation ${status} successfully` }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error updating F&F calculation status:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error updating F&F calculation status:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
