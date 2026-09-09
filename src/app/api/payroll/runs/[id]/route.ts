import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['INPUT_COLLECTION'],
  INPUT_COLLECTION: ['PROCESSING'],
  PROCESSING: ['REVIEW'],
  REVIEW: ['APPROVED', 'PROCESSING'],
  APPROVED: ['ACCOUNTING'],
  ACCOUNTING: ['DISBURSED'],
  DISBURSED: ['CLOSED'],
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

    let data;
    try {
      data = await db.payrollRun.findUnique({
        where: { id },
        include: {
          transactionLines: true,
          payrollInputs: true,
          complianceFilings: true,
        },
      });
    } catch (dbError: unknown) {
      console.error('PayrollRun table not available:', dbError);
      data = null;
    }

    if (!data) return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching payroll run:', error);
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
    const { runStatus, ...updateData } = body;

    let data;
    try {
      data = await db.payrollRun.update({
        where: { id },
        data: updateData,
      });
    } catch (dbError: unknown) {
      console.error('PayrollRun table not available:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }

    return Response.json({ data, message: 'Payroll run updated successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating payroll run:', error);
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
    const { runStatus } = body;

    if (!runStatus) {
      return Response.json({ error: 'runStatus is required' }, { status: 400, headers: corsHeaders });
    }

    let currentRun;
    try {
      currentRun = await db.payrollRun.findUnique({ where: { id } });
    } catch (dbError: unknown) {
      console.error('PayrollRun table not available:', dbError);
      return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });
    }

    if (!currentRun) return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });

    const allowedTransitions = STATUS_TRANSITIONS[currentRun.runStatus] || [];
    if (!allowedTransitions.includes(runStatus)) {
      return Response.json(
        { error: `Invalid status transition from ${currentRun.runStatus} to ${runStatus}. Allowed: ${allowedTransitions.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }

    let data;
    try {
      data = await db.payrollRun.update({
        where: { id },
        data: { runStatus },
      });
    } catch (dbError: unknown) {
      console.error('PayrollRun table not available:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }

    return Response.json({ data, message: `Payroll run status advanced to ${runStatus}` }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating payroll run status:', error);
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

    let run;
    try {
      run = await db.payrollRun.findUnique({ where: { id } });
    } catch (dbError: unknown) {
      console.error('PayrollRun table not available:', dbError);
      return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });
    }

    if (!run) return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });

    if (run.runStatus !== 'OPEN') {
      return Response.json({ error: 'Only payroll runs with OPEN status can be deleted' }, { status: 400, headers: corsHeaders });
    }

    try {
      await db.payrollTransactionLine.deleteMany({ where: { payrollRunId: id } });
    } catch (dbError: unknown) {
      console.error('PayrollTransactionLine table not available, skipping delete:', dbError);
    }

    try {
      await db.payrollInput.deleteMany({ where: { payrollRunId: id } });
    } catch (dbError: unknown) {
      console.error('PayrollInput table not available, skipping delete:', dbError);
    }

    try {
      await db.complianceFiling.deleteMany({ where: { payrollRunId: id } });
    } catch (dbError: unknown) {
      console.error('ComplianceFiling table not available, skipping delete:', dbError);
    }

    try {
      await db.payrollRun.delete({ where: { id } });
    } catch (dbError: unknown) {
      console.error('PayrollRun table not available:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }

    return Response.json({ message: 'Payroll run deleted successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error deleting payroll run:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
