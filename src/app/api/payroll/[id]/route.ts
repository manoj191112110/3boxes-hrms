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

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const payroll = await db.payroll.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.status === 'paid' && { paidDate: new Date() }),
      },
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
    });

    await db.auditLog.create({
      data: { userId: decoded.userId as string, action: 'UPDATE_PAYROLL', module: 'payroll', details: `Updated payroll ${id} status to ${body.status}` },
    });

    return NextResponse.json({ payroll }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update payroll error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.basicSalary !== undefined) data.basicSalary = body.basicSalary;
    if (body.hra !== undefined) data.hra = body.hra;
    if (body.da !== undefined) data.da = body.da;
    if (body.conveyance !== undefined) data.conveyance = body.conveyance;
    if (body.medical !== undefined) data.medical = body.medical;
    if (body.otherAllowances !== undefined) data.otherAllowances = body.otherAllowances;
    if (body.grossSalary !== undefined) data.grossSalary = body.grossSalary;
    if (body.pf !== undefined) data.pf = body.pf;
    if (body.esi !== undefined) data.esi = body.esi;
    if (body.tax !== undefined) data.tax = body.tax;
    if (body.professionalTax !== undefined) data.professionalTax = body.professionalTax;
    if (body.otherDeductions !== undefined) data.otherDeductions = body.otherDeductions;
    if (body.totalDeductions !== undefined) data.totalDeductions = body.totalDeductions;
    if (body.netSalary !== undefined) data.netSalary = body.netSalary;
    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === 'paid') data.paidDate = new Date();
    }

    const payroll = await db.payroll.update({
      where: { id },
      data,
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
    });

    await db.auditLog.create({
      data: { userId: decoded.userId as string, action: 'UPDATE_PAYROLL', module: 'payroll', details: `Updated payroll details for ${id}` },
    });

    return NextResponse.json({ payroll }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update payroll error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    // Check if user is admin
    const user = await db.user.findUnique({ where: { id: decoded.userId as string } });
    if (!user || !['super_admin', 'tenant_admin', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    await db.payroll.delete({ where: { id } });

    await db.auditLog.create({
      data: { userId: decoded.userId as string, action: 'DELETE_PAYROLL', module: 'payroll', details: `Deleted payroll ${id}` },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete payroll error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
