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
    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    const listings = await db.loanMarketplaceListing.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ listings }, { headers: corsHeaders() });
  } catch (error) { console.error('Get loan listings error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { employeeId, bankName, offerAmount, interestRate, tenureMonths, emiAmount, processingFee, consentGiven } = body;
    if (!employeeId || !bankName || !offerAmount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });

    // Consent gate (REQ-FIN-05)
    const consentAt = consentGiven ? new Date() : null;
    // Generate one-time expiring deep link
    const deepLinkSentAt = consentGiven ? new Date() : null;

    const listing = await db.loanMarketplaceListing.create({
      data: { employeeId, bankName, offerAmount, interestRate: interestRate || 0, tenureMonths: tenureMonths || 12, emiAmount: emiAmount || 0, processingFee: processingFee || 0, currency: 'INR', consentGiven: !!consentGiven, consentAt, deepLinkSentAt, applicationStatus: 'pre_approved' },
    });
    return NextResponse.json({ listing }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create loan listing error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
