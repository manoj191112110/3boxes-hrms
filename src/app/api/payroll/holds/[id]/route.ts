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
      const data = await db.payrollHold.findUnique({
        where: { id },
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
      });

      if (!data) return Response.json({ error: 'Payroll hold not found' }, { status: 404, headers: corsHeaders });

      return Response.json({ data }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching payroll hold:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching payroll hold:', error);
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

    try {
      const data = await db.payrollHold.update({
        where: { id },
        data: {
          ...(body.holdType && { holdType: body.holdType }),
          ...(body.reason && { reason: body.reason }),
          ...(body.holdFromPeriod && { holdFromPeriod: body.holdFromPeriod }),
          ...(body.holdToPeriod !== undefined && { holdToPeriod: body.holdToPeriod || null }),
          ...(body.heldComponents !== undefined && { heldComponents: body.heldComponents || null }),
        },
      });

      return Response.json({ data, message: 'Payroll hold updated successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error updating payroll hold:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error updating payroll hold:', error);
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
    const { action } = body;

    if (action === 'release') {
      try {
        const data = await db.payrollHold.update({
          where: { id },
          data: {
            status: 'released',
            releasedDate: new Date(),
            releasedBy: decoded.userId as string,
          },
        });

        return Response.json({ data, message: 'Payroll hold released successfully' }, { headers: corsHeaders });
      } catch (dbError: unknown) {
        console.error('Database error releasing payroll hold:', dbError);
        return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
      }
    }

    if (action === 'cancel') {
      try {
        const data = await db.payrollHold.update({
          where: { id },
          data: {
            status: 'cancelled',
          },
        });

        return Response.json({ data, message: 'Payroll hold cancelled successfully' }, { headers: corsHeaders });
      } catch (dbError: unknown) {
        console.error('Database error cancelling payroll hold:', dbError);
        return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
      }
    }

    return Response.json({ error: 'Invalid action. Must be release or cancel' }, { status: 400, headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating payroll hold status:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
