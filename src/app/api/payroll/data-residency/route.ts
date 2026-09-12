// REQ-SEC-PAY-04: GDPR / Data Localization Enforcement
// ----------------------------------------------------
// Per-company policy that controls where payroll processing logic is
// permitted to execute. The PayrollRun API checks the company's residency
// policy and refuses to execute if the request originates from a non-compliant
// region (returned via x-region header from the gateway / Vercel's
// x-vercel-ip-country-style headers).
//
// Use cases:
//   • EU sub-company → data must stay in eu-west-1 / eu-central-1
//   • India sub-company (DPDP Act 2023) → primary region ap-south-1
//   • US sub-company → no restriction (replicationAllowed=true)

import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET /api/payroll/data-residency
//   ?companyId=...
//   Returns the residency policy for the company (or a default policy if none set)
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      // List all policies
      let policies: unknown[] = [];
      try {
        policies = await getPlatformDb().dataResidencyPolicy.findMany({ take: 200 });
      } catch (dbError: unknown) {
        console.error('DB error fetching residency policies:', dbError);
      }
      return Response.json({ data: policies }, { headers: corsHeaders });
    }

    let policy = null;
    try {
      policy = await getPlatformDb().dataResidencyPolicy.findUnique({ where: { companyId } });
    } catch (dbError: unknown) {
      console.error('DB error fetching residency policy:', dbError);
    }

    if (!policy) {
      // Return a default (permissive) policy
      return Response.json({
        data: {
          companyId,
          allowedRegions: ['*'],
          primaryRegion: null,
          replicationAllowed: true,
          piiFieldsMasked: true,
          crossBorderTransferApproved: true,
          legalBasis: 'DEFAULT — no explicit policy configured. Tenant Admin should configure per REQ-SEC-PAY-04.',
        },
        message: 'No explicit data residency policy — using permissive defaults.',
      }, { headers: corsHeaders });
    }

    // Parse allowedRegions JSON
    let allowedRegions: string[] = [];
    try { allowedRegions = JSON.parse(policy.allowedRegions as string); } catch { allowedRegions = [String(policy.allowedRegions)]; }

    return Response.json({
      data: { ...policy, allowedRegions },
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/data-residency GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/payroll/data-residency
//   body: { companyId, allowedRegions (array), primaryRegion, replicationAllowed,
//           piiFieldsMasked, crossBorderTransferApproved, legalBasis?,
//           policyDocumentUrl? }
// Creates OR updates a policy (upsert keyed on companyId).
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    // Only super_admin / tenant_admin can set residency policy
    if (!['super_admin', 'tenant_admin'].includes(decoded.role as string)) {
      return Response.json({ error: 'Only super_admin or tenant_admin can configure data residency' }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json();
    if (!body.companyId) return Response.json({ error: 'companyId required' }, { status: 400, headers: corsHeaders });
    if (!body.primaryRegion) return Response.json({ error: 'primaryRegion required' }, { status: 400, headers: corsHeaders });
    if (!Array.isArray(body.allowedRegions) || body.allowedRegions.length === 0) {
      return Response.json({ error: 'allowedRegions must be a non-empty array' }, { status: 400, headers: corsHeaders });
    }

    const created = await getPlatformDb().dataResidencyPolicy.upsert({
      where: { companyId: body.companyId },
      create: {
        companyId: body.companyId,
        allowedRegions: JSON.stringify(body.allowedRegions),
        primaryRegion: body.primaryRegion,
        replicationAllowed: !!body.replicationAllowed,
        piiFieldsMasked: body.piiFieldsMasked !== false,
        crossBorderTransferApproved: !!body.crossBorderTransferApproved,
        legalBasis: body.legalBasis || null,
        policyDocumentUrl: body.policyDocumentUrl || null,
        reviewedBy: decoded.userId as string,
        reviewedAt: new Date(),
      },
      update: {
        allowedRegions: JSON.stringify(body.allowedRegions),
        primaryRegion: body.primaryRegion,
        replicationAllowed: !!body.replicationAllowed,
        piiFieldsMasked: body.piiFieldsMasked !== false,
        crossBorderTransferApproved: !!body.crossBorderTransferApproved,
        legalBasis: body.legalBasis || null,
        policyDocumentUrl: body.policyDocumentUrl || null,
        reviewedBy: decoded.userId as string,
        reviewedAt: new Date(),
      },
    });

    return Response.json({ data: created, message: 'Data residency policy saved' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/data-residency POST:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/payroll/data-residency  { companyId, ... }
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  // Same logic as POST — both go through upsert
  return POST(request);
}

// ────────────────────────────────────────────────────────────────────
// Helper used by other payroll APIs to enforce residency at runtime.
// Returns { allowed: boolean, reason?: string }.
// ────────────────────────────────────────────────────────────────────
export async function checkResidencyCompliance(
  companyId: string,
  requestRegion: string | null,
): Promise<{ allowed: boolean; reason?: string; policy?: unknown }> {
  try {
    const policy = await getPlatformDb().dataResidencyPolicy.findUnique({ where: { companyId } });
    if (!policy) return { allowed: true }; // no policy = no restriction

    let allowedRegions: string[] = [];
    try { allowedRegions = JSON.parse(policy.allowedRegions as string); } catch { allowedRegions = [String(policy.allowedRegions)]; }

    if (allowedRegions.includes('*')) return { allowed: true, policy };
    if (!requestRegion) {
      return { allowed: false, reason: 'No request region header present; company policy requires region-aware routing', policy };
    }
    if (!allowedRegions.includes(requestRegion)) {
      return { allowed: false, reason: `Region '${requestRegion}' is not in the allowed regions list [${allowedRegions.join(', ')}] for this company`, policy };
    }
    return { allowed: true, policy };
  } catch (err) {
    console.error('Residency check failed (defaulting to allowed):', err);
    return { allowed: true }; // fail open to avoid blocking all payroll
  }
}
