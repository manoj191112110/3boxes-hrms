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

    // Assign asset to employee
    if (body.action === 'assign' && body.employeeId) {
      const assignment = await db.assetAssignment.create({
        data: {
          assetId: id,
          employeeId: body.employeeId,
          expectedReturn: body.expectedReturn ? new Date(body.expectedReturn) : null,
          condition: body.condition || 'good',
        },
        include: {
          asset: { select: { name: true, assetTag: true } },
          employee: { select: { firstName: true, lastName: true, employeeId: true } },
        },
      });
      await db.asset.update({ where: { id }, data: { status: 'assigned' } });
      return NextResponse.json({ assignment }, { status: 201, headers: corsHeaders() });
    }

    // Return asset
    if (body.action === 'return' && body.assignmentId) {
      const assignment = await db.assetAssignment.update({
        where: { id: body.assignmentId },
        data: {
          returnDate: new Date(),
          condition: body.condition || 'good',
          status: 'returned',
        },
      });
      // Check if asset has other active assignments
      const activeAssignments = await db.assetAssignment.count({
        where: { assetId: id, status: 'assigned' },
      });
      if (activeAssignments === 0) {
        await db.asset.update({ where: { id }, data: { status: 'available' } });
      }
      return NextResponse.json({ assignment }, { headers: corsHeaders() });
    }

    // Update asset - support all fields
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.status !== undefined) data.status = body.status;
    if (body.condition !== undefined) data.condition = body.condition;
    if (body.brand !== undefined) data.brand = body.brand;
    if (body.model !== undefined) data.model = body.model;
    if (body.serialNumber !== undefined) data.serialNumber = body.serialNumber;
    if (body.category !== undefined) data.category = body.category;
    if (body.purchaseDate !== undefined) data.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null;
    if (body.purchaseCost !== undefined) data.purchaseCost = body.purchaseCost;
    if (body.location !== undefined) data.location = body.location;
    if (body.warrantyExpiry !== undefined) data.warrantyExpiry = body.warrantyExpiry ? new Date(body.warrantyExpiry) : null;
    if (body.notes !== undefined) data.notes = body.notes;

    const asset = await db.asset.update({
      where: { id },
      data,
      include: {
        assignments: {
          where: { status: 'assigned' },
          include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
        },
      },
    });

    return NextResponse.json({ asset }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update asset error:', error);
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

    // Delete asset assignments first
    await db.assetAssignment.deleteMany({ where: { assetId: id } });

    // Delete the asset
    await db.asset.delete({ where: { id } });

    return NextResponse.json({ message: 'Asset deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
