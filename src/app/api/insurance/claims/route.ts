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

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const policyId = searchParams.get('policyId');
    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (policyId) where.policyId = policyId;
    const claims = await db.insuranceClaim.findMany({ where, include: { policy: { select: { id: true, providerName: true, policyNumber: true } } }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ claims }, { headers: corsHeaders() });
  } catch (error) { console.error('Get claims error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { policyId, employeeId, claimAmount, billFileUrl, aiParsedRaw } = body;
    if (!policyId || !employeeId || !claimAmount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });

    // AI OCR pre-fill simulation (REQ-INS-04)
    let aiParsedJson = null, aiConfidence = 0;
    if (billFileUrl || aiParsedRaw) {
      // In production: call VLM/OCR here. For now, accept pre-parsed fields.
      aiParsedJson = aiParsedRaw || { amount: claimAmount, diagnosis: null, policyNumber: null, hospitalName: null };
      aiConfidence = 0.75;
    }
    const claim = await db.insuranceClaim.create({
      data: { policyId, employeeId, claimAmount, billFileUrl, aiParsedJson, aiConfidence, status: 'draft' },
    });
    return NextResponse.json({ claim }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create claim error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
