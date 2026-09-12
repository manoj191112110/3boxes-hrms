import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { assertEcosystemAccess, CORS } from '@/lib/ecosystem-access';

function corsHeaders() {
  return CORS;
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
    const { id } = await params;

    // REQ-SEC-CV-01: IDOR protection — verify caller's tenant owns this vendor
    const guard = await assertEcosystemAccess(request, 'vendor', id);
    if (guard.deny) return guard.response;

    const vendor = await db.vendor.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, code: true } },
        parentVendor: { select: { id: true, name: true, code: true } },
        childVendors: {
          select: { id: true, name: true, code: true, status: true, candidateCount: true, rating: true },
        },
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ vendor }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get vendor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const { id } = await params;

    // REQ-SEC-CV-01: IDOR protection
    const guard = await assertEcosystemAccess(request, 'vendor', id);
    if (guard.deny) return guard.response;
    const decoded = guard.decoded;

    const body = await request.json();

    const existing = await db.vendor.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};
    const fields = [
      'name', 'code', 'industry', 'website', 'contactName', 'contactEmail',
      'contactPhone', 'address', 'city', 'state', 'country', 'zipCode',
      'specialization', 'candidateCount', 'rating',
    ];
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (body.status !== undefined) updateData.status = body.status;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.parentVendorId !== undefined) updateData.parentVendorId = body.parentVendorId;

    const vendor = await db.vendor.update({
      where: { id },
      data: updateData,
      include: { company: { select: { id: true, name: true } }, parentVendor: { select: { id: true, name: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_VENDOR',
        module: 'vendors',
        details: `Updated vendor ${id}`,
      },
    });

    return NextResponse.json({ vendor }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update vendor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const { id } = await params;

    // REQ-SEC-CV-01: IDOR protection
    const guard = await assertEcosystemAccess(request, 'vendor', id);
    if (guard.deny) return guard.response;
    const decoded = guard.decoded;

    const existing = guard.record;

    // Soft delete
    const vendor = await db.vendor.update({
      where: { id },
      data: { status: 'inactive' },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_VENDOR',
        module: 'vendors',
        details: `Soft deleted vendor ${id} (${existing.name})`,
      },
    });

    return NextResponse.json({ message: 'Vendor deactivated successfully', vendor }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete vendor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
