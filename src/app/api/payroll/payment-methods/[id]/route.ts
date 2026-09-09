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
      const data = await db.employeePaymentMethod.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              email: true,
            },
          },
        },
      });

      if (!data) return Response.json({ error: 'Employee payment method not found' }, { status: 404, headers: corsHeaders });

      return Response.json({ data }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching employee payment method:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching employee payment method:', error);
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

    // If this is set as primary, unset other primary methods for the same employee
    if (body.isPrimary) {
      try {
        const existing = await db.employeePaymentMethod.findUnique({ where: { id } });
        if (existing) {
          await db.employeePaymentMethod.updateMany({
            where: { employeeId: existing.employeeId, isPrimary: true, id: { not: id } },
            data: { isPrimary: false },
          });
        }
      } catch (dbError: unknown) {
        console.error('Database error clearing primary payment methods:', dbError);
        // Continue with update even if clearing primary fails
      }
    }

    try {
      const data = await db.employeePaymentMethod.update({
        where: { id },
        data: body,
      });

      return Response.json({ data, message: 'Employee payment method updated successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error updating employee payment method:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error updating employee payment method:', error);
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
      // Soft delete - set status to inactive
      const data = await db.employeePaymentMethod.update({
        where: { id },
        data: { status: 'inactive' },
      });

      return Response.json({ data, message: 'Employee payment method deactivated successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error deleting employee payment method:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error deleting employee payment method:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
