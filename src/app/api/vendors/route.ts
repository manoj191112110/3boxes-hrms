import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { validateEmail, validatePhone } from '@/lib/validators';

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
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const companyId = searchParams.get('companyId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const parentVendorId = searchParams.get('parentVendorId');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (parentVendorId) where.parentVendorId = parentVendorId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [vendors, total] = await Promise.all([
      db.vendor.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, code: true } },
          parentVendor: { select: { id: true, name: true, code: true } },
          _count: { select: { childVendors: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.vendor.count({ where }),
    ]);

    return NextResponse.json(
      { vendors, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get vendors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const body = await request.json();
    const {
      name, code, companyId, type, parentVendorId, industry, website,
      contactName, contactEmail, contactPhone, address, city, state,
      country, zipCode, specialization, candidateCount, rating,
    } = body;

    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, companyId' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ─── Server-side validation ───
    if (contactPhone && typeof contactPhone === 'string') {
      const phoneResult = validatePhone(contactPhone);
      if (!phoneResult.valid) {
        return NextResponse.json({ error: phoneResult.error }, { status: 400, headers: corsHeaders() });
      }
    }
    if (contactEmail && typeof contactEmail === 'string') {
      const emailResult = validateEmail(contactEmail);
      if (!emailResult.valid) {
        return NextResponse.json({ error: emailResult.error }, { status: 400, headers: corsHeaders() });
      }
    }

    // If sub_vendor, validate parentVendorId
    if (type === 'sub_vendor' && !parentVendorId) {
      return NextResponse.json(
        { error: 'Sub-vendors must have a parentVendorId' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const vendor = await db.vendor.create({
      data: {
        name,
        code,
        companyId,
        type: type || 'vendor',
        parentVendorId: type === 'sub_vendor' ? parentVendorId : null,
        industry,
        website,
        contactName,
        contactEmail,
        contactPhone,
        address,
        city,
        state,
        country,
        zipCode,
        specialization,
        candidateCount: candidateCount ?? 0,
        rating: rating ?? 0,
        status: 'active',
      },
      include: {
        company: { select: { id: true, name: true } },
        parentVendor: { select: { id: true, name: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_VENDOR',
        module: 'vendors',
        details: `Created vendor ${name} (${vendor.type})`,
      },
    });

    return NextResponse.json({ vendor }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create vendor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
