import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders, hashPassword } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

interface InvitationResult {
  email: string;
  success: boolean;
  error?: string;
  userId?: string;
}

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
      return NextResponse.json({ error: 'Only admins can send invitations' }, { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { emails, tenantId, role } = body as {
      emails: string[];
      tenantId: string;
      role: string;
    };

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Emails array is required' }, { status: 400, headers: corsHeaders() });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400, headers: corsHeaders() });
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404, headers: corsHeaders() });
    }

    const defaultRole = role || 'employee';
    const tempPassword = await hashPassword('Welcome@123');
    const results: InvitationResult[] = [];

    for (const email of emails) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) continue;

      try {
        // Check if user already exists
        const existing = await db.user.findUnique({ where: { email: trimmedEmail } });
        if (existing) {
          results.push({ email: trimmedEmail, success: false, error: 'User already exists' });
          continue;
        }

        // Create invited user with inactive status
        const userName = trimmedEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const user = await db.user.create({
          data: {
            email: trimmedEmail,
            password: tempPassword,
            name: userName,
            tenantId,
            role: defaultRole,
            status: 'invited',
          },
        });

        results.push({ email: trimmedEmail, success: true, userId: user.id });
      } catch (err) {
        console.error(`Failed to invite ${trimmedEmail}:`, err);
        results.push({ email: trimmedEmail, success: false, error: 'Failed to create user' });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json(
      {
        invitations: results,
        summary: { total: results.length, success: successCount, failed: failCount },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Invitations POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
