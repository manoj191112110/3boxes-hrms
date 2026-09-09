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

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    try {
      const data = await db.fNFCalculation.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              department: { select: { name: true } },
              designation: { select: { title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return Response.json({ data }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching F&F calculations:', dbError);
      return Response.json({ data: [] }, { headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching F&F calculations:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();

    // Auto-calculate totals
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
      const data = await db.fNFCalculation.create({
        data: {
          employeeId: body.employeeId,
          separationId: body.separationId || null,
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
          currency: body.currency || 'INR',
          status: body.status || 'pending',
          remarks: body.remarks || null,
        },
      });

      return Response.json({ data, message: 'F&F calculation created successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error creating F&F calculation:', dbError);
      return Response.json({ error: 'Service temporarily unavailable' }, { status: 503, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error creating F&F calculation:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
