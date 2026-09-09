import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;
    // RBAC: only super_admin or tenant_admin
    if (!((decoded.role as string) && ['super_admin', 'tenant_admin'].includes(decoded.role as string))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }
    const vendor = await db.vendor.findUnique({ where: { id } });
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404, headers: corsHeaders() });

    // 1. Mask PII on vendor staff (GDPR right to erasure — keep denormalized stats)
    await db.vendorStaff.updateMany({
      where: { vendorId: id },
      data: { email: null, phone: null, name: `[PURGED_${Date.now()}]`, piiMasked: true, status: 'offboarded', offboardedAt: new Date() },
    });
    // 2. Disable all portal users
    await db.vendorPortalUser.updateMany({ where: { vendorId: id }, data: { status: 'purged', passwordHash: null, otpSecret: null } });
    // 3. Scrub vendor contact PII (mask, keep record for audit)
    await db.vendor.update({
      where: { id },
      data: {
        contactName: '[PURGED]',
        contactEmail: null,
        contactPhone: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        status: 'purged',
        piiPurgedAt: new Date(),
      },
    });
    await db.auditLog.create({ data: { userId: decoded.userId as string, action: 'VENDOR_PURGE', module: 'vendors', details: `GDPR vendor purge executed for vendor ${id} (${vendor.name})` } });
    return NextResponse.json({ purged: true, vendorId: id, purgedAt: new Date().toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Vendor purge error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
