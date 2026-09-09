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

    const staff = await db.vendorStaff.findMany({ where: { vendorId: id }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ staff }, { headers: corsHeaders() });
  } catch (error) { console.error('Get vendor staff error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    // REQ-SEC-CV-01: IDOR protection
    const guard = await assertEcosystemAccess(request, 'vendor', id);
    if (guard.deny) return guard.response;

    const body = await request.json();
    const { name, email, phone, role, skillTags, billRate, costRate, currency } = body;
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400, headers: corsHeaders() });
    const staff = await db.vendorStaff.create({
      data: { vendorId: id, name, email, phone, role, skillTags, billRate, costRate, currency: currency || 'INR' },
    });
    await db.vendor.update({ where: { id }, data: { candidateCount: { increment: 1 } } });
    return NextResponse.json({ staff }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create vendor staff error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
