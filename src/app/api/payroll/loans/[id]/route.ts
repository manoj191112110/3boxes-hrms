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
      const data = await db.loan.findUnique({
        where: { id },
        include: {
          employee: {
            select: { id: true, employeeId: true, firstName: true, lastName: true, email: true, salary: true },
          },
        },
      });

      if (!data) return Response.json({ error: 'Loan not found' }, { status: 404, headers: corsHeaders });

      return Response.json({ data }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching loan:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching loan:', error);
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

    // If loan amount, interest rate, or tenure is being updated, recalculate EMI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existing: any = null;
    try {
      existing = await db.loan.findUnique({ where: { id } });
    } catch (dbError: unknown) {
      console.error('Database error fetching loan for update:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
    if (!existing) return Response.json({ error: 'Loan not found' }, { status: 404, headers: corsHeaders });

    const loanAmount = body.loanAmount ? parseFloat(body.loanAmount) : existing.loanAmount;
    const interestRate = body.interestRate !== undefined ? parseFloat(body.interestRate) : existing.interestRate;
    const tenureMonths = body.tenureMonths ? parseInt(body.tenureMonths) : existing.tenureMonths;

    // Recalculate EMI if core values changed
    let emiAmount = existing.emiAmount;
    if (body.loanAmount || body.interestRate !== undefined || body.tenureMonths) {
      if (interestRate === 0) {
        emiAmount = loanAmount / tenureMonths;
      } else {
        const monthlyRate = interestRate / 12 / 100;
        const factor = Math.pow(1 + monthlyRate, tenureMonths);
        emiAmount = (loanAmount * monthlyRate * factor) / (factor - 1);
      }
      emiAmount = Math.round(emiAmount * 100) / 100;
    }

    const updateData: Record<string, unknown> = {
      ...(body.loanType && { loanType: body.loanType }),
      ...(body.loanAmount && { loanAmount }),
      ...(body.interestRate !== undefined && { interestRate }),
      ...(body.tenureMonths && { tenureMonths }),
      emiAmount,
      outstandingBalance: body.outstandingBalance !== undefined ? parseFloat(body.outstandingBalance) : existing.outstandingBalance,
      ...(body.disbursedAmount !== undefined && { disbursedAmount: parseFloat(body.disbursedAmount) }),
      ...(body.disbursedDate !== undefined && { disbursedDate: body.disbursedDate ? new Date(body.disbursedDate) : null }),
      ...(body.startDate && { startDate: new Date(body.startDate) }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
      ...(body.recoveredAmount !== undefined && { recoveredAmount: parseFloat(body.recoveredAmount) }),
      ...(body.remainingEmis !== undefined && { remainingEmis: parseInt(body.remainingEmis) }),
      ...(body.remarks !== undefined && { remarks: body.remarks }),
    };

    try {
      const data = await db.loan.update({
        where: { id },
        data: updateData,
      });

      return Response.json({ data, message: 'Loan updated successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error updating loan:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error updating loan:', error);
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

    if (!status || !['approved', 'rejected', 'active', 'completed', 'cancelled', 'defaulted'].includes(status)) {
      return Response.json({ error: 'Invalid status. Must be approved, rejected, active, completed, cancelled, or defaulted' }, { status: 400, headers: corsHeaders });
    }

    try {
      const existing = await db.loan.findUnique({ where: { id } });
      if (!existing) return Response.json({ error: 'Loan not found' }, { status: 404, headers: corsHeaders });

      const updateData: Record<string, unknown> = {
        status,
        ...(status === 'approved' && {
          approvedBy: decoded.userId as string,
          approvedAt: new Date(),
          disbursedDate: existing.disbursedDate || new Date(),
        }),
        ...(remarks && { remarks }),
      };

      const data = await db.loan.update({
        where: { id },
        data: updateData,
      });

      return Response.json({ data, message: `Loan ${status} successfully` }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error updating loan status:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error updating loan status:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    try {
      const existing = await db.loan.findUnique({ where: { id } });
      if (!existing) return Response.json({ error: 'Loan not found' }, { status: 404, headers: corsHeaders });

      if (existing.status !== 'pending') {
        return Response.json({ error: 'Only pending loans can be deleted' }, { status: 400, headers: corsHeaders });
      }

      await db.loan.delete({ where: { id } });

      return Response.json({ message: 'Loan deleted successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error deleting loan:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error deleting loan:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
