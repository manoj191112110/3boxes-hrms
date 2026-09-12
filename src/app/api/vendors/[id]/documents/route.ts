import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { assertEcosystemAccess, CORS } from '@/lib/ecosystem-access';

function corsHeaders() {
  return CORS;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    // REQ-SEC-CV-01: IDOR protection — verify caller's tenant owns this vendor
    const guard = await assertEcosystemAccess(request, 'vendor', id);
    if (guard.deny) return guard.response;

    const documents = await db.vendorDocument.findMany({ where: { vendorId: id }, orderBy: { createdAt: 'desc' } });
    // Compute current expiry status
    const now = new Date();
    const docs = documents.map(d => {
      let status = d.status;
      if (d.expiryDate) {
        const daysToExpiry = Math.floor((d.expiryDate.getTime() - now.getTime()) / 86400000);
        if (daysToExpiry < 0) status = 'expired';
        else if (daysToExpiry <= 30) status = 'expiring';
        else status = 'valid';
      }
      return { ...d, status, daysToExpiry: d.expiryDate ? Math.floor((d.expiryDate.getTime() - now.getTime()) / 86400000) : null };
    });
    return NextResponse.json({ documents: docs }, { headers: corsHeaders() });
  } catch (error) { console.error('Get vendor docs error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    // REQ-SEC-CV-01: IDOR protection
    const guard = await assertEcosystemAccess(request, 'vendor', id);
    if (guard.deny) return guard.response;
    const decoded = guard.decoded;

    const body = await request.json();
    const { name, type, fileUrl, issuedAt, expiryDate } = body;
    if (!name || !type) return NextResponse.json({ error: 'Missing name or type' }, { status: 400, headers: corsHeaders() });
    const doc = await db.vendorDocument.create({
      data: { vendorId: id, name, type, fileUrl, issuedAt: issuedAt ? new Date(issuedAt) : null, expiryDate: expiryDate ? new Date(expiryDate) : null, uploadedById: decoded.userId as string },
    });
    await db.auditLog.create({ data: { userId: decoded.userId as string, action: 'UPLOAD_VENDOR_DOC', module: 'vendors', details: `Uploaded ${type} doc for vendor ${id}` } });
    return NextResponse.json({ document: doc }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create vendor doc error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
