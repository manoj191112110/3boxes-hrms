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
    const category = searchParams.get('category');
    const providerName = searchParams.get('provider');
    const search = searchParams.get('search');
    const where: Record<string, unknown> = { status: 'active' };
    if (category) where.category = category;
    if (providerName) where.providerName = providerName;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const products = await db.marketplaceProduct.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ products }, { headers: corsHeaders() });
  } catch (error) { console.error('Get marketplace products error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    if (!['super_admin', 'tenant_admin'].includes((decoded.role as string) || '')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    const body = await request.json();
    const { sku, name, description, category, providerName, publicPrice, corporatePrice, currency, allowedBuckets, imageUrl, fulfillmentMode, quantityLimitPerQuarter } = body;
    if (!sku || !name || !category || !providerName || !publicPrice || !corporatePrice) return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders() });
    const product = await db.marketplaceProduct.create({
      data: { sku, name, description, category, providerName, publicPrice: Number(publicPrice), corporatePrice: Number(corporatePrice), currency: currency || 'INR', allowedBuckets: allowedBuckets || 'general_rewards', imageUrl, fulfillmentMode: fulfillmentMode || 'digital', quantityLimitPerQuarter: quantityLimitPerQuarter || 0 },
    });
    return NextResponse.json({ product }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create product error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
