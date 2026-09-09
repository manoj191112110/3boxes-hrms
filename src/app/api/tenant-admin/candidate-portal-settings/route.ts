/**
 * Tenant Admin — Candidate Portal Settings (REQ-STAT-05/06, REQ-INT-07, REQ-SEC-CAND-03)
 *
 * GET  /api/tenant-admin/candidate-portal-settings
 *   Returns the current candidate-portal settings for the caller's tenant.
 *
 * PUT  /api/tenant-admin/candidate-portal-settings
 *   body: {
 *     aiFeedbackEnabled?: boolean,                // REQ-STAT-05/06 toggle
 *     resumeScoreThreshold?: number,              // REQ-AI-RES-03 — bypass HR screen
 *     talentPoolCrossCompanyEnabled?: boolean,    // REQ-STAT-01 — cross-sub-company search
 *     videoInterviewRetakeLimit?: number,         // REQ-INT-07
 *     videoRetentionDays?: number,                // REQ-SEC-CAND-03
 *   }
 *
 * Only tenant_admin and super_admin can call this endpoint.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: CORS });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
    const decodedRec = decoded as unknown as Record<string, any>;

    if (!['super_admin', 'tenant_admin'].includes(decodedRec.role)) {
      return NextResponse.json({ error: 'Tenant admin only' }, { status: 403, headers: CORS });
    }

    // For super_admin with no tenantId, allow specifying one via query
    const url = new URL(request.url);
    const tenantId = decodedRec.role === 'super_admin'
      ? (url.searchParams.get('tenantId') || decodedRec.tenantId)
      : decodedRec.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 400, headers: CORS });
    }

    const tenant = await getPlatformDb().tenant.findUnique({
      where: { id: tenantId as string },
      select: {
        id: true,
        name: true,
        aiFeedbackEnabled: true,
        resumeScoreThreshold: true,
        talentPoolCrossCompanyEnabled: true,
        videoInterviewRetakeLimit: true,
        videoRetentionDays: true,
      },
    });

    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404, headers: CORS });

    return NextResponse.json({ settings: tenant }, { headers: CORS });
  } catch (error) {
    console.error('Candidate portal settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}

export async function PUT(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: CORS });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
    const decodedRec = decoded as unknown as Record<string, any>;

    if (!['super_admin', 'tenant_admin'].includes(decodedRec.role)) {
      return NextResponse.json({ error: 'Tenant admin only' }, { status: 403, headers: CORS });
    }

    const url = new URL(request.url);
    const tenantId = decodedRec.role === 'super_admin'
      ? (url.searchParams.get('tenantId') || decodedRec.tenantId)
      : decodedRec.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 400, headers: CORS });
    }

    const body = await request.json().catch(() => ({}));
    const updateData: Record<string, unknown> = {};

    if (typeof body.aiFeedbackEnabled === 'boolean') updateData.aiFeedbackEnabled = body.aiFeedbackEnabled;
    if (typeof body.resumeScoreThreshold === 'number') {
      updateData.resumeScoreThreshold = Math.max(0, Math.min(100, body.resumeScoreThreshold));
    }
    if (typeof body.talentPoolCrossCompanyEnabled === 'boolean') updateData.talentPoolCrossCompanyEnabled = body.talentPoolCrossCompanyEnabled;
    if (typeof body.videoInterviewRetakeLimit === 'number') {
      updateData.videoInterviewRetakeLimit = Math.max(0, Math.min(10, body.videoInterviewRetakeLimit));
    }
    if (typeof body.videoRetentionDays === 'number') {
      updateData.videoRetentionDays = Math.max(0, Math.min(3650, body.videoRetentionDays));
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400, headers: CORS });
    }

    const updated = await getPlatformDb().tenant.update({
      where: { id: tenantId as string },
      data: updateData,
      select: {
        id: true,
        name: true,
        aiFeedbackEnabled: true,
        resumeScoreThreshold: true,
        talentPoolCrossCompanyEnabled: true,
        videoInterviewRetakeLimit: true,
        videoRetentionDays: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: decodedRec.userId as string,
        action: 'UPDATE_CANDIDATE_PORTAL_SETTINGS',
        module: 'tenant_admin',
        details: `Updated candidate portal settings: ${JSON.stringify(updateData)}`,
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, settings: updated }, { headers: CORS });
  } catch (error) {
    console.error('Candidate portal settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}
