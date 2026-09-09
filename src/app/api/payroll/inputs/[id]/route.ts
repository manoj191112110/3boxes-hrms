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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    let data;
    try {
      data = await db.payrollInput.update({
        where: { id },
        data: body,
      });
    } catch (dbError: unknown) {
      console.error('PayrollInput table not available:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }

    return Response.json({ data, message: 'Payroll input updated successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating payroll input:', error);
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
    const { approvalStatus, remarks } = body;

    if (!approvalStatus || !['APPROVED', 'REJECTED'].includes(approvalStatus)) {
      return Response.json({ error: 'Invalid approval status. Must be APPROVED or REJECTED' }, { status: 400, headers: corsHeaders });
    }

    let data;
    try {
      data = await db.payrollInput.update({
        where: { id },
        data: {
          approvalStatus,
          approvedBy: decoded.userId as string,
          approvalDate: new Date(),
          ...(remarks && { remarks }),
        },
      });
    } catch (dbError: unknown) {
      console.error('PayrollInput table not available:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }

    return Response.json({ data, message: `Payroll input ${approvalStatus.toLowerCase()} successfully` }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating payroll input status:', error);
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
      await db.payrollInput.delete({ where: { id } });
    } catch (dbError: unknown) {
      console.error('PayrollInput table not available:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }

    return Response.json({ message: 'Payroll input deleted successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error deleting payroll input:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
