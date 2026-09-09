import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// GET: Check if the current tenant has completed the setup wizard
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const token = getTokenFromHeaders(req);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const tenantId = decoded.tenantId as string;
    if (!tenantId) {
      return NextResponse.json({ completed: false }, { headers: corsHeaders() });
    }

    // Check for a setupCompleted setting in the tenant's metadata
    // We store this in the tenant's domain field as a JSON flag, or use a separate approach
    // For now, we check if the tenant has at least 1 department, 1 designation, and 1 branch
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: {
        companyGroups: {
          include: {
            companies: {
              include: {
                _count: { select: { departments: true, designations: true, branches: true } },
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ completed: false }, { headers: corsHeaders() });
    }

    // Check if setup was explicitly marked as completed via domain field hack
    // We use a convention: if domain contains "setup=completed", it's done
    const explicitlyCompleted = tenant.domain?.includes('setup=completed') || false;

    // Also check if there's organizational data
    let hasOrgData = false;
    for (const group of tenant.companyGroups) {
      for (const company of group.companies) {
        if (
          company._count.departments > 0 &&
          company._count.designations > 0 &&
          company._count.branches > 0
        ) {
          hasOrgData = true;
          break;
        }
      }
      if (hasOrgData) break;
    }

    const completed = explicitlyCompleted || hasOrgData;

    return NextResponse.json({ completed }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Setup wizard status GET error:', error);
    return NextResponse.json({ completed: false }, { headers: corsHeaders() });
  }
}

// POST: Mark setup as completed for the tenant
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const token = getTokenFromHeaders(req);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const userRole = decoded.role as string;
    if (!['super_admin', 'tenant_admin', 'admin'].includes(userRole)) {
      return NextResponse.json({ error: 'Only admins can mark setup as completed' }, { status: 403, headers: corsHeaders() });
    }

    const tenantId = decoded.tenantId as string;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400, headers: corsHeaders() });
    }

    // Mark setup as completed by appending setup=completed to the domain field
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404, headers: corsHeaders() });
    }

    const currentDomain = tenant.domain || '';
    if (!currentDomain.includes('setup=completed')) {
      const newDomain = currentDomain
        ? `${currentDomain}|setup=completed`
        : 'setup=completed';
      await db.tenant.update({
        where: { id: tenantId },
        data: { domain: newDomain },
      });
    }

    return NextResponse.json({ success: true, completed: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Setup wizard status POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
